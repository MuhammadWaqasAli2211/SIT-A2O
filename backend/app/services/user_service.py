"""User administration: the directory, role changes, and staff provisioning.

Supabase owns credentials, so anything touching a password or an email address
goes out to the GoTrue admin API; everything else is a local `profiles` write.
Where both are involved, the remote call happens first — a failed local write
can be rolled back, a created auth user cannot.
"""

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.integrations import supabase_auth
from app.models.application import Application
from app.models.bootcamp import BootcampAdmin
from app.models.enums import UserRole
from app.models.user import CandidateProfile, Profile
from app.schemas.user import (
    ActiveChange,
    PasswordReset,
    ProfileUpdate,
    RoleChange,
    SelfProfileUpdate,
    StaffCreate,
    UserDetail,
    UserRow,
)
from app.services import audit_service, bootcamp_service


def get_user(db: Session, profile_id: uuid.UUID) -> Profile:
    profile = db.scalar(
        select(Profile)
        .where(Profile.id == profile_id)
        .options(selectinload(Profile.candidate_profile))
    )
    if profile is None:
        raise NotFoundError("User not found.")
    return profile


def _assert_not_self(actor: Profile, profile_id: uuid.UUID, action: str) -> None:
    """Guard against an administrator locking themselves out.

    Demoting or deactivating your own account leaves nobody able to undo it if
    you were the last super admin, so it is refused outright rather than
    warned about.
    """
    if actor.id == profile_id:
        raise ConflictError(f"You cannot {action} your own account.")


def _assert_not_last_super_admin(db: Session, profile_id: uuid.UUID) -> None:
    remaining = db.scalar(
        select(func.count())
        .select_from(Profile)
        .where(
            Profile.role == UserRole.SUPER_ADMIN,
            Profile.is_active.is_(True),
            Profile.id != profile_id,
        )
    )
    if not remaining:
        raise ConflictError(
            "This is the last active super admin. Promote another account first."
        )


# ------------------------------------------------------------- directory --


def _row_query() -> Select:
    """Counts as correlated scalar subqueries rather than joins.

    Two LEFT JOINs onto one-to-many tables would multiply rows against each
    other and inflate both counts.
    """
    applications = (
        select(func.count())
        .select_from(Application)
        .where(Application.profile_id == Profile.id)
        .scalar_subquery()
    )
    bootcamps = (
        select(func.count())
        .select_from(BootcampAdmin)
        .where(BootcampAdmin.profile_id == Profile.id)
        .scalar_subquery()
    )
    return select(Profile, applications, bootcamps)


def list_users(
    db: Session,
    *,
    role: UserRole | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> tuple[list[UserRow], int]:
    stmt = _row_query()
    if role is not None:
        stmt = stmt.where(Profile.role == role)
    if is_active is not None:
        stmt = stmt.where(Profile.is_active.is_(is_active))
    if search:
        needle = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            func.lower(Profile.full_name).like(needle)
            | func.lower(Profile.email).like(needle)
            | func.lower(Profile.phone).like(needle)
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(
        stmt.order_by(Profile.created_at.desc()).limit(limit).offset(offset)
    ).all()

    return [
        UserRow(
            id=profile.id,
            email=profile.email,
            full_name=profile.full_name,
            phone=profile.phone,
            role=profile.role,
            is_active=profile.is_active,
            application_count=app_count,
            bootcamp_count=bootcamp_count,
            created_at=profile.created_at,
        )
        for profile, app_count, bootcamp_count in rows
    ], total


def get_detail(db: Session, profile_id: uuid.UUID) -> UserDetail:
    profile = get_user(db, profile_id)
    managed = list(
        db.scalars(
            select(BootcampAdmin.bootcamp_id).where(BootcampAdmin.profile_id == profile_id)
        )
    )
    count = db.scalar(
        select(func.count()).select_from(Application).where(Application.profile_id == profile_id)
    )
    return UserDetail(
        **{
            field: getattr(profile, field)
            for field in ("id", "email", "full_name", "phone", "role", "is_active", "created_at")
        },
        candidate_profile=profile.candidate_profile,
        application_count=count or 0,
        managed_bootcamp_ids=managed,
    )


# ----------------------------------------------------------------- edits --

_CANDIDATE_FIELDS = ("cnic", "date_of_birth", "city", "education")


def update_profile(
    db: Session, profile_id: uuid.UUID, payload: ProfileUpdate, actor: Profile
) -> Profile:
    profile = get_user(db, profile_id)
    changes = payload.model_dump(exclude_unset=True)

    candidate_changes = {k: changes.pop(k) for k in _CANDIDATE_FIELDS if k in changes}
    before = {field: getattr(profile, field) for field in changes}

    for field, value in changes.items():
        setattr(profile, field, value)

    if candidate_changes:
        _apply_candidate_fields(db, profile, candidate_changes, before, changes)

    audit_service.record(
        db,
        actor=actor,
        action="profile.update",
        entity_type="profile",
        entity_id=profile.id,
        summary=f"Updated {profile.email}",
        metadata={"changes": audit_service.diff(before, changes)},
    )
    db.flush()
    return get_user(db, profile_id)


def _apply_candidate_fields(
    db: Session,
    profile: Profile,
    candidate_changes: dict,
    before: dict,
    changes: dict,
) -> None:
    """Create the candidate row on demand — admins were never given one."""
    record = profile.candidate_profile
    if record is None:
        record = CandidateProfile(profile_id=profile.id)
        db.add(record)

    for field, value in candidate_changes.items():
        before[field] = getattr(record, field)
        setattr(record, field, value)
        changes[field] = value

    # Unique index on cnic; surface the clash as a 409 rather than a 500.
    if "cnic" in candidate_changes and candidate_changes["cnic"]:
        clash = db.scalar(
            select(CandidateProfile).where(
                CandidateProfile.cnic == candidate_changes["cnic"],
                CandidateProfile.profile_id != profile.id,
            )
        )
        if clash is not None:
            raise ConflictError("That CNIC is already recorded against another candidate.")


def update_own_profile(db: Session, user: Profile, payload: SelfProfileUpdate) -> Profile:
    """Self-service edit. The actor and the subject are the same person.

    Shares `_apply_candidate_fields` with the admin path so the CNIC
    uniqueness check cannot be bypassed by going through this route instead.
    """
    changes = payload.model_dump(exclude_unset=True)
    candidate_changes = {k: changes.pop(k) for k in _CANDIDATE_FIELDS if k in changes}
    before = {field: getattr(user, field) for field in changes}

    for field, value in changes.items():
        setattr(user, field, value)

    if candidate_changes:
        _apply_candidate_fields(db, user, candidate_changes, before, changes)

    audit_service.record(
        db,
        actor=user,
        action="profile.self_update",
        entity_type="profile",
        entity_id=user.id,
        summary=f"{user.email} updated their own details",
        metadata={"changes": audit_service.diff(before, changes)},
    )
    db.flush()
    return user


def change_role(
    db: Session, profile_id: uuid.UUID, payload: RoleChange, actor: Profile
) -> Profile:
    profile = get_user(db, profile_id)
    _assert_not_self(actor, profile_id, "change the role of")

    if profile.role == payload.role:
        raise ConflictError(f"{profile.email} is already {payload.role.value}.")
    if profile.role == UserRole.SUPER_ADMIN:
        _assert_not_last_super_admin(db, profile_id)

    # Demoting to CANDIDATE strips the bootcamp assignments that role can no
    # longer act on; leaving them would grant access back on any re-promotion.
    removed = 0
    if payload.role == UserRole.CANDIDATE:
        removed = db.query(BootcampAdmin).filter(BootcampAdmin.profile_id == profile_id).delete()

    previous = profile.role
    profile.role = payload.role

    audit_service.record(
        db,
        actor=actor,
        action="profile.role_change",
        entity_type="profile",
        entity_id=profile.id,
        summary=f"{profile.email}: {previous.value} to {payload.role.value}",
        metadata={
            "from": previous.value,
            "to": payload.role.value,
            "reason": payload.reason,
            "assignments_removed": removed,
        },
    )
    db.flush()
    return profile


def set_active(
    db: Session, profile_id: uuid.UUID, payload: ActiveChange, actor: Profile
) -> Profile:
    profile = get_user(db, profile_id)
    if not payload.is_active:
        _assert_not_self(actor, profile_id, "deactivate")
        if profile.role == UserRole.SUPER_ADMIN:
            _assert_not_last_super_admin(db, profile_id)

    if profile.is_active == payload.is_active:
        state = "active" if payload.is_active else "deactivated"
        raise ConflictError(f"{profile.email} is already {state}.")

    profile.is_active = payload.is_active

    audit_service.record(
        db,
        actor=actor,
        action="profile.activate" if payload.is_active else "profile.deactivate",
        entity_type="profile",
        entity_id=profile.id,
        summary=f"{'Reactivated' if payload.is_active else 'Deactivated'} {profile.email}",
        metadata={"reason": payload.reason},
    )
    db.flush()
    return profile


# --------------------------------------------------- staff provisioning --


def create_staff(db: Session, payload: StaffCreate, actor: Profile) -> Profile:
    """Create an ADMIN or SUPER_ADMIN account.

    The provisioning trigger hardcodes CANDIDATE, so the role is corrected here
    after GoTrue creates the user and the trigger has produced the profile row.
    """
    if payload.role == UserRole.CANDIDATE:
        raise ConflictError("Use self-service signup for candidate accounts.")

    existing = db.scalar(select(Profile).where(Profile.email == payload.email))
    if existing is not None:
        raise ConflictError("An account with this email already exists.")

    created = supabase_auth.admin_create_user(
        email=payload.email,
        password=payload.password,
        metadata={"full_name": payload.full_name, "phone": payload.phone},
    )
    user_id = uuid.UUID(created["id"])

    # The trigger fires inside GoTrue's own transaction, which has committed by
    # the time we get here — but this session may hold an older snapshot.
    db.commit()
    profile = db.scalar(select(Profile).where(Profile.id == user_id))
    if profile is None:
        raise ConflictError(
            "The account was created but its profile has not appeared. "
            "Check the handle_new_user trigger."
        )

    profile.role = payload.role
    profile.full_name = payload.full_name
    profile.phone = payload.phone

    for bootcamp_id in payload.bootcamp_ids:
        bootcamp_service.assign_admin(db, bootcamp_id, profile.id, actor)

    audit_service.record(
        db,
        actor=actor,
        action="profile.create_staff",
        entity_type="profile",
        entity_id=profile.id,
        summary=f"Provisioned {payload.role.value} {payload.email}",
        metadata={"role": payload.role.value, "bootcamps": len(payload.bootcamp_ids)},
    )
    db.flush()
    return profile


def reset_password(
    db: Session, profile_id: uuid.UUID, payload: PasswordReset, actor: Profile
) -> None:
    profile = get_user(db, profile_id)
    supabase_auth.admin_update_user(str(profile_id), {"password": payload.password})

    audit_service.record(
        db,
        actor=actor,
        action="profile.reset_password",
        entity_type="profile",
        entity_id=profile.id,
        # Deliberately records only that it happened, never the value.
        summary=f"Reset the password for {profile.email}",
        metadata={},
    )
    db.flush()


def delete_user(db: Session, profile_id: uuid.UUID, actor: Profile) -> None:
    """Delete the auth user; `profiles` follows by ON DELETE CASCADE."""
    profile = get_user(db, profile_id)
    _assert_not_self(actor, profile_id, "delete")
    if profile.role == UserRole.SUPER_ADMIN:
        _assert_not_last_super_admin(db, profile_id)

    count = db.scalar(
        select(func.count()).select_from(Application).where(Application.profile_id == profile_id)
    )
    if count:
        raise ConflictError(
            f"{profile.email} has {count} application(s). "
            "Deactivate the account instead of deleting it."
        )

    audit_service.record(
        db,
        actor=actor,
        action="profile.delete",
        entity_type="profile",
        entity_id=profile.id,
        summary=f"Deleted the account {profile.email}",
        metadata={"email": profile.email, "role": profile.role.value},
    )
    db.flush()
    supabase_auth.admin_delete_user(str(profile_id))
