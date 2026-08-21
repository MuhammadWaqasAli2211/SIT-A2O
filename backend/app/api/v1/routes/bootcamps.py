import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import AdminUser, DbSession, SuperAdminUser, require_super_admin
from app.models.bootcamp import Bootcamp
from app.models.enums import ApplicationStage, PhaseType
from app.schemas.application import ApplicantPage
from app.schemas.bootcamp import (
    BootcampCreate,
    BootcampDetail,
    BootcampOut,
    BootcampUpdate,
    PhaseOut,
    PhaseUpdate,
    ProgramOut,
    PublicBootcampOut,
)
from app.schemas.dashboard import BootcampStats
from app.schemas.ops import AuditEntry, Page
from app.schemas.user import ProfileOut
from app.services import application_service, audit_service, bootcamp_service, dashboard_service

router = APIRouter(prefix="/bootcamps", tags=["bootcamps"])


def _to_detail(db: Session, bootcamp: Bootcamp) -> BootcampDetail:
    return BootcampDetail(
        **BootcampOut.model_validate(bootcamp).model_dump(),
        programs=[ProgramOut.model_validate(bp.program) for bp in bootcamp.programs],
        phases=[PhaseOut.model_validate(p) for p in bootcamp.phases],
        application_count=bootcamp_service.application_count(db, bootcamp.id),
    )


# ---------------------------------------------------------------- public --
# Unauthenticated: the marketing site needs to show what is open right now.


@router.get("/open", response_model=list[PublicBootcampOut], tags=["public"])
def list_open_bootcamps(db: DbSession) -> list[PublicBootcampOut]:
    """Intakes currently accepting applications."""
    result: list[PublicBootcampOut] = []
    for bootcamp in bootcamp_service.open_for_registration(db):
        registration = bootcamp_service.get_phase(db, bootcamp.id, PhaseType.REGISTRATION)
        result.append(
            PublicBootcampOut(
                id=bootcamp.id,
                bootcamp_number=bootcamp.bootcamp_number,
                name=bootcamp.name,
                description=bootcamp.description,
                starts_at=bootcamp.starts_at,
                registration_deadline=registration.deadline_at,
                programs=[ProgramOut.model_validate(bp.program) for bp in bootcamp.programs],
            )
        )
    return result


# ----------------------------------------------------------------- admin --


@router.get("", response_model=list[BootcampOut])
def list_bootcamps(user: AdminUser, db: DbSession) -> list[BootcampOut]:
    """Super admins see every intake; admins see only those assigned to them."""
    return [
        BootcampOut.model_validate(b) for b in bootcamp_service.visible_bootcamps(db, user)
    ]


@router.post("", response_model=BootcampDetail, status_code=status.HTTP_201_CREATED)
def create_bootcamp(
    payload: BootcampCreate, user: SuperAdminUser, db: DbSession
) -> BootcampDetail:
    return _to_detail(db, bootcamp_service.create_bootcamp(db, user, payload))


@router.get("/{bootcamp_id}", response_model=BootcampDetail)
def get_bootcamp(bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession) -> BootcampDetail:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    return _to_detail(db, bootcamp_service.get_bootcamp(db, bootcamp_id))


@router.patch("/{bootcamp_id}", response_model=BootcampDetail)
def update_bootcamp(
    bootcamp_id: uuid.UUID, payload: BootcampUpdate, user: AdminUser, db: DbSession
) -> BootcampDetail:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    return _to_detail(db, bootcamp_service.update_bootcamp(db, bootcamp_id, payload, user))


@router.delete(
    "/{bootcamp_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_super_admin)],
)
def delete_bootcamp(bootcamp_id: uuid.UUID, user: SuperAdminUser, db: DbSession) -> None:
    """Only while no one has applied — the service refuses otherwise."""
    bootcamp_service.delete_bootcamp(db, bootcamp_id, user)


@router.get("/{bootcamp_id}/stats", response_model=BootcampStats)
def bootcamp_stats(bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession) -> BootcampStats:
    return dashboard_service.bootcamp_stats(db, bootcamp_id, user)


# ---------------------------------------------------------------- admins --


@router.get("/{bootcamp_id}/admins", response_model=list[ProfileOut])
def list_bootcamp_admins(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> list[ProfileOut]:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    return [ProfileOut.model_validate(p) for p in bootcamp_service.admins_for(db, bootcamp_id)]


@router.post(
    "/{bootcamp_id}/admins/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_super_admin)],
)
def assign_admin(
    bootcamp_id: uuid.UUID, profile_id: uuid.UUID, user: SuperAdminUser, db: DbSession
) -> None:
    bootcamp_service.assign_admin(db, bootcamp_id, profile_id, user)


@router.delete(
    "/{bootcamp_id}/admins/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_super_admin)],
)
def unassign_admin(
    bootcamp_id: uuid.UUID, profile_id: uuid.UUID, user: SuperAdminUser, db: DbSession
) -> None:
    bootcamp_service.unassign_admin(db, bootcamp_id, profile_id, user)


# ---------------------------------------------------------------- phases --


@router.patch("/{bootcamp_id}/phases/{phase}", response_model=PhaseOut)
def update_phase(
    bootcamp_id: uuid.UUID,
    phase: PhaseType,
    payload: PhaseUpdate,
    user: AdminUser,
    db: DbSession,
) -> PhaseOut:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    row = bootcamp_service.update_phase_window(db, bootcamp_id, phase, payload, user)
    return PhaseOut.model_validate(row)


@router.post("/{bootcamp_id}/phases/{phase}/open", response_model=PhaseOut)
def open_phase(
    bootcamp_id: uuid.UUID, phase: PhaseType, user: AdminUser, db: DbSession
) -> PhaseOut:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    return PhaseOut.model_validate(
        bootcamp_service.set_phase_open(db, bootcamp_id, phase, is_open=True, actor=user)
    )


@router.post("/{bootcamp_id}/phases/{phase}/close", response_model=PhaseOut)
def close_phase(
    bootcamp_id: uuid.UUID, phase: PhaseType, user: AdminUser, db: DbSession
) -> PhaseOut:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    return PhaseOut.model_validate(
        bootcamp_service.set_phase_open(db, bootcamp_id, phase, is_open=False, actor=user)
    )


# ------------------------------------------------------------ applicants --


@router.get("/{bootcamp_id}/applications", response_model=ApplicantPage)
def list_applicants(
    bootcamp_id: uuid.UUID,
    user: AdminUser,
    db: DbSession,
    stage: ApplicationStage | None = None,
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ApplicantPage:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    items, total = application_service.list_for_bootcamp(
        db, bootcamp_id, stage=stage, search=search, limit=limit, offset=offset
    )
    return ApplicantPage(items=items, total=total, limit=limit, offset=offset)


# ----------------------------------------------------------------- audit --


@router.get("/{bootcamp_id}/audit", response_model=Page[AuditEntry])
def bootcamp_audit(
    bootcamp_id: uuid.UUID,
    user: AdminUser,
    db: DbSession,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[AuditEntry]:
    """Activity for this intake, so an admin sees their own history in scope."""
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    items, total = audit_service.list_entries(
        db, entity_type="bootcamp", entity_id=bootcamp_id, limit=limit, offset=offset
    )
    return Page(items=items, total=total, limit=limit, offset=offset)
