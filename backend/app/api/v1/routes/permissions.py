"""Granting and revoking AI Interviewer write scopes.

Assignment is super-admin only. `/me/permissions` is the one route an admin
can reach, so the UI can disable a write control rather than offering it and
failing at the click.
"""

import uuid

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.deps import AdminUser, DbSession, SuperAdminUser
from app.models.enums import AiScope, UserRole
from app.models.user import Profile
from app.schemas.ai_interview import KeyScopes
from app.schemas.permission import AdminGrants, GrantIn, ScopeOut
from app.services import ai_interview_service, permission_service

router = APIRouter(tags=["permissions"])


@router.get("/me/permissions", response_model=list[AiScope])
def my_permissions(user: AdminUser, db: DbSession) -> list[AiScope]:
    """Which writes the signed-in admin may perform. A super admin gets the
    full set, which is what the service already reports for them."""
    return sorted(permission_service.granted_scopes(db, user), key=lambda s: s.value)


@router.get("/admin-permissions/scopes", response_model=list[ScopeOut])
def list_grantable_scopes(user: SuperAdminUser) -> list[ScopeOut]:
    """The scopes that exist to grant. Reads are absent by design — every
    admin already has them."""
    return [
        ScopeOut(scope=scope, label=scope.label, external=scope.external) for scope in AiScope
    ]


@router.get("/admin-permissions/key", response_model=KeyScopes)
def get_key_scopes(user: SuperAdminUser) -> KeyScopes:
    """What our own API key can do, so the screen never offers to delegate a
    power the key itself lacks."""
    return KeyScopes.model_validate(ai_interview_service.key_scopes())


@router.get("/admin-permissions", response_model=list[AdminGrants])
def list_admin_grants(user: SuperAdminUser, db: DbSession) -> list[AdminGrants]:
    """Every administrator and the scopes they hold, including admins with
    none — the screen needs the whole roster to grant against, not just the
    rows that already exist."""
    admins = list(
        db.scalars(
            select(Profile).where(Profile.role == UserRole.ADMIN).order_by(Profile.email)
        )
    )
    return [
        AdminGrants(
            profile_id=admin.id,
            full_name=admin.full_name,
            email=admin.email,
            scopes=sorted(permission_service.scopes_for(db, admin.id), key=lambda s: s.value),
        )
        for admin in admins
    ]


@router.post(
    "/users/{profile_id}/permissions",
    response_model=list[AiScope],
    status_code=status.HTTP_201_CREATED,
)
def grant_permission(
    profile_id: uuid.UUID, payload: GrantIn, user: SuperAdminUser, db: DbSession
) -> list[AiScope]:
    permission_service.grant(db, user, profile_id, payload.scope)
    return sorted(permission_service.scopes_for(db, profile_id), key=lambda s: s.value)


@router.delete("/users/{profile_id}/permissions/{scope}", response_model=list[AiScope])
def revoke_permission(
    profile_id: uuid.UUID, scope: AiScope, user: SuperAdminUser, db: DbSession
) -> list[AiScope]:
    permission_service.revoke(db, user, profile_id, scope)
    return sorted(permission_service.scopes_for(db, profile_id), key=lambda s: s.value)
