"""Per-admin write permissions on the AI Interviewer API.

The access model, in one place:

    CANDIDATE    no access to this API at all, ever.
    ADMIN        every read, scoped to their own bootcamps. No writes,
                 unless a super admin has granted the specific scope.
    SUPER_ADMIN  everything, unconditionally, with nothing stored.

Reads are not represented in the table — an admin has them by virtue of
being an admin, so a row always means "may write". Storing read grants would
imply they could be withheld, which they cannot be.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.models.admin_permission import AdminPermission
from app.models.enums import AiScope, UserRole
from app.models.user import Profile
from app.services import audit_service


def granted_scopes(db: Session, user: Profile) -> set[AiScope]:
    """Every write scope this user holds.

    A super admin holds all of them by role. Anyone who is not staff holds
    none regardless of what rows exist — a stale grant left behind by a
    demotion must not keep working.
    """
    if user.role == UserRole.SUPER_ADMIN:
        return set(AiScope)
    if user.role != UserRole.ADMIN:
        return set()
    return set(
        db.scalars(select(AdminPermission.scope).where(AdminPermission.profile_id == user.id))
    )


def has_scope(db: Session, user: Profile, scope: AiScope) -> bool:
    return scope in granted_scopes(db, user)


def assert_scope(db: Session, user: Profile, scope: AiScope) -> None:
    """Gate a write. Raises rather than returning a bool so a caller cannot
    forget to check the result."""
    if not has_scope(db, user, scope):
        raise PermissionDeniedError(
            f"You do not have the '{scope.label}' permission. A super admin can grant it."
        )


# ------------------------------------------------------------ assignment --


def _get_admin(db: Session, profile_id: uuid.UUID) -> Profile:
    profile = db.get(Profile, profile_id)
    if profile is None:
        raise NotFoundError("User not found.")
    if profile.role != UserRole.ADMIN:
        # A super admin already holds every scope, and a candidate must never
        # hold one. Refusing here keeps the table meaning exactly one thing.
        raise ConflictError(
            "Permissions can only be granted to an administrator. "
            f"This account is {profile.role.value.replace('_', ' ').lower()}."
        )
    return profile


def list_grants(db: Session) -> list[AdminPermission]:
    """Every grant, for the super admin's assignment screen."""
    return list(
        db.scalars(
            select(AdminPermission)
            .options(selectinload(AdminPermission.profile))
            .order_by(AdminPermission.granted_at.desc())
        )
    )


def scopes_for(db: Session, profile_id: uuid.UUID) -> list[AiScope]:
    return list(
        db.scalars(select(AdminPermission.scope).where(AdminPermission.profile_id == profile_id))
    )


def grant(db: Session, actor: Profile, profile_id: uuid.UUID, scope: AiScope) -> AdminPermission:
    target = _get_admin(db, profile_id)

    existing = db.scalar(
        select(AdminPermission).where(
            AdminPermission.profile_id == profile_id, AdminPermission.scope == scope
        )
    )
    # Idempotent: re-granting is not an error, it is a no-op. The unique
    # constraint would otherwise surface as a 500 on a double-click.
    if existing is not None:
        return existing

    permission = AdminPermission(profile_id=profile_id, scope=scope, granted_by=actor.id)
    db.add(permission)

    audit_service.record(
        db,
        actor=actor,
        action="admin_permission.grant",
        entity_type="profile",
        entity_id=profile_id,
        summary=f"Granted '{scope.label}' to {target.email}",
        metadata={"scope": scope.value, "external_scope": scope.external},
    )
    db.flush()
    return permission


def revoke(db: Session, actor: Profile, profile_id: uuid.UUID, scope: AiScope) -> None:
    target = _get_admin(db, profile_id)

    permission = db.scalar(
        select(AdminPermission).where(
            AdminPermission.profile_id == profile_id, AdminPermission.scope == scope
        )
    )
    if permission is None:
        # Same reasoning as grant(): the desired end state is "not granted",
        # and it already holds.
        return

    db.delete(permission)
    audit_service.record(
        db,
        actor=actor,
        action="admin_permission.revoke",
        entity_type="profile",
        entity_id=profile_id,
        summary=f"Revoked '{scope.label}' from {target.email}",
        metadata={"scope": scope.value, "external_scope": scope.external},
    )
    db.flush()
