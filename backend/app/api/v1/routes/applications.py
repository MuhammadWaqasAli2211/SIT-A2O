import uuid

from fastapi import APIRouter, status

from app.api.deps import AdminUser, CandidateUser, DbSession
from app.schemas.application import (
    ApplicationCreate,
    ApplicationDetail,
    ApplicationOut,
    StageAdvance,
    StageTransitionOut,
)
from app.schemas.bootcamp import PhaseOut, ProgramOut
from app.services import application_service

router = APIRouter(prefix="/applications", tags=["applications"])


def _to_detail(application) -> ApplicationDetail:
    return ApplicationDetail(
        **ApplicationOut.model_validate(application).model_dump(),
        program=ProgramOut.model_validate(application.program),
        bootcamp_name=application.bootcamp.name,
        timeline=[StageTransitionOut.model_validate(t) for t in application.transitions],
        phases=[PhaseOut.model_validate(p) for p in application.bootcamp.phases],
    )


@router.post("", response_model=ApplicationDetail, status_code=status.HTTP_201_CREATED)
def submit_application(
    payload: ApplicationCreate, user: CandidateUser, db: DbSession
) -> ApplicationDetail:
    """Apply to an open bootcamp. Mints the candidate code."""
    return _to_detail(application_service.submit(db, user, payload))


@router.get("/mine", response_model=list[ApplicationDetail])
def my_applications(user: CandidateUser, db: DbSession) -> list[ApplicationDetail]:
    return [_to_detail(a) for a in application_service.my_applications(db, user)]


@router.get("/{application_id}", response_model=ApplicationDetail)
def get_my_application(
    application_id: uuid.UUID, user: CandidateUser, db: DbSession
) -> ApplicationDetail:
    return _to_detail(application_service.get_own(db, user, application_id))


@router.post("/{application_id}/stage", response_model=ApplicationDetail)
def advance_stage(
    application_id: uuid.UUID, payload: StageAdvance, user: AdminUser, db: DbSession
) -> ApplicationDetail:
    """Move a candidate to another stage. Scope is checked in the service."""
    application_service.advance_stage(
        db, application_id, to_stage=payload.to_stage, actor=user, reason=payload.reason
    )
    return _to_detail(application_service.get_detail(db, application_id))
