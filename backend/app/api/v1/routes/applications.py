import uuid

from fastapi import APIRouter, status

from app.api.deps import AdminUser, CandidateUser, DbSession
from app.schemas.application import (
    AdminApplicationDetail,
    ApplicationCreate,
    ApplicationDetail,
    ApplicationEdit,
    ApplicationOut,
    StageAdvance,
    StageTransitionOut,
)
from app.schemas.bootcamp import ProgramOut
from app.services import application_service

router = APIRouter(prefix="/applications", tags=["applications"])


def _to_detail(application) -> ApplicationDetail:
    return ApplicationDetail(
        **ApplicationOut.model_validate(application).model_dump(),
        program=ProgramOut.model_validate(application.program),
        bootcamp_name=application.bootcamp.name,
        timeline=[StageTransitionOut.model_validate(t) for t in application.transitions],
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


@router.post("/{application_id}/reinstate", response_model=ApplicationDetail)
def reinstate(
    application_id: uuid.UUID, payload: StageAdvance, user: AdminUser, db: DbSession
) -> ApplicationDetail:
    """Reopen a rejected or withdrawn application at the given stage.

    Without this a mistaken rejection was permanent: the candidate could not
    reapply either, because one application per person per intake is a unique
    index.
    """
    application_service.reinstate(
        db, application_id, to_stage=payload.to_stage, actor=user, reason=payload.reason
    )
    return _to_detail(application_service.get_detail(db, application_id))


@router.get("/{application_id}/admin", response_model=AdminApplicationDetail)
def get_for_admin(
    application_id: uuid.UUID, user: AdminUser, db: DbSession
) -> AdminApplicationDetail:
    """The full record, including the candidate's contact details.

    Separate from the candidate's own `/{id}` route so the two never share a
    response shape: this one carries personal data that route must not leak.
    """
    application = application_service.get_admin_detail(db, application_id, user)
    return application


@router.patch("/{application_id}", response_model=ApplicationDetail)
def update_application(
    application_id: uuid.UUID, payload: ApplicationEdit, user: AdminUser, db: DbSession
) -> ApplicationDetail:
    """Correct the track or statement. Stage moves have their own endpoint."""
    return _to_detail(
        application_service.update_application(
            db,
            application_id,
            actor=user,
            program_id=payload.program_id,
            statement=payload.statement,
        )
    )


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: uuid.UUID, user: AdminUser, db: DbSession) -> None:
    """Hard delete for genuine mistakes. The candidate code is not reused."""
    application_service.delete_application(db, application_id, user)
