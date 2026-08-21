"""User administration.

Reads are open to any administrator; anything that changes a role, a password,
or an account's existence is super-admin only. That split is deliberate: a
bootcamp admin needs to look candidates up, but privilege changes are how an
account takes over the platform.
"""

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import AdminUser, DbSession, SuperAdminUser, require_super_admin
from app.models.enums import UserRole
from app.schemas.ops import AuditEntry, Page
from app.schemas.user import (
    ActiveChange,
    PasswordReset,
    ProfileOut,
    ProfileUpdate,
    RoleChange,
    StaffCreate,
    UserDetail,
    UserRow,
)
from app.services import audit_service, user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=Page[UserRow])
def list_users(
    user: AdminUser,
    db: DbSession,
    role: UserRole | None = None,
    is_active: bool | None = None,
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[UserRow]:
    items, total = user_service.list_users(
        db, role=role, is_active=is_active, search=search, limit=limit, offset=offset
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "",
    response_model=ProfileOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_super_admin)],
)
def create_staff(payload: StaffCreate, user: SuperAdminUser, db: DbSession) -> ProfileOut:
    """Provision an ADMIN or SUPER_ADMIN, with the email pre-confirmed."""
    return ProfileOut.model_validate(user_service.create_staff(db, payload, user))


@router.get("/{profile_id}", response_model=UserDetail)
def get_user(profile_id: uuid.UUID, user: AdminUser, db: DbSession) -> UserDetail:
    return user_service.get_detail(db, profile_id)


@router.patch("/{profile_id}", response_model=ProfileOut)
def update_user(
    profile_id: uuid.UUID, payload: ProfileUpdate, user: AdminUser, db: DbSession
) -> ProfileOut:
    """Correct a name, phone, or candidate detail. Role and status live elsewhere."""
    return ProfileOut.model_validate(user_service.update_profile(db, profile_id, payload, user))


@router.post(
    "/{profile_id}/role",
    response_model=ProfileOut,
    dependencies=[Depends(require_super_admin)],
)
def change_role(
    profile_id: uuid.UUID, payload: RoleChange, user: SuperAdminUser, db: DbSession
) -> ProfileOut:
    return ProfileOut.model_validate(user_service.change_role(db, profile_id, payload, user))


@router.post(
    "/{profile_id}/active",
    response_model=ProfileOut,
    dependencies=[Depends(require_super_admin)],
)
def set_active(
    profile_id: uuid.UUID, payload: ActiveChange, user: SuperAdminUser, db: DbSession
) -> ProfileOut:
    """Deactivation takes effect on the next request — role is read per call."""
    return ProfileOut.model_validate(user_service.set_active(db, profile_id, payload, user))


@router.post(
    "/{profile_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_super_admin)],
)
def reset_password(
    profile_id: uuid.UUID, payload: PasswordReset, user: SuperAdminUser, db: DbSession
) -> None:
    user_service.reset_password(db, profile_id, payload, user)


@router.delete(
    "/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_super_admin)],
)
def delete_user(profile_id: uuid.UUID, user: SuperAdminUser, db: DbSession) -> None:
    """Refused once the account has applications — deactivate those instead."""
    user_service.delete_user(db, profile_id, user)


@router.get(
    "/{profile_id}/audit",
    response_model=Page[AuditEntry],
    dependencies=[Depends(require_super_admin)],
)
def user_audit(
    profile_id: uuid.UUID,
    user: SuperAdminUser,
    db: DbSession,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[AuditEntry]:
    """Everything done *to* this account."""
    items, total = audit_service.list_entries(
        db, entity_type="profile", entity_id=profile_id, limit=limit, offset=offset
    )
    return Page(items=items, total=total, limit=limit, offset=offset)
