import uuid

from fastapi import APIRouter, BackgroundTasks, status

from app.api.deps import AdminUser, CandidateUser, DbSession, SuperAdminUser
from app.schemas.application import (
    AdminApplicationDetail,
    ApplicationCreate,
    ApplicationDetail,
    ApplicationEdit,
    ApplicationOut,
    RegistrationResult,
    StageAdvance,
    StageTransitionOut,
)
from app.schemas.bootcamp import PhaseOut, ProgramOut
from app.services import application_service, email_service

router = APIRouter(prefix="/applications", tags=["applications"])


def _to_detail(application) -> ApplicationDetail:
    return ApplicationDetail(
        **ApplicationOut.model_validate(application).model_dump(),
        program=ProgramOut.model_validate(application.program),
        bootcamp_name=application.bootcamp.name,
        timeline=[StageTransitionOut.model_validate(t) for t in application.transitions],
        phases=[PhaseOut.model_validate(p) for p in application.bootcamp.phases],
    )


@router.post("", response_model=RegistrationResult, status_code=status.HTTP_201_CREATED)
def submit_application(
    payload: ApplicationCreate,
    user: CandidateUser,
    db: DbSession,
    background: BackgroundTasks,
) -> RegistrationResult:
    """Register for a bootcamp.

    Writes the person-level answers to candidate_profiles and the
    intake-specific ones to applications, in one transaction, and mints the
    candidate code.

    Returns the narrow RegistrationResult rather than the full application:
    the success modal needs a code and a confirmation, and a wider response
    would be one more thing to keep in step with the form.
    """
    application = application_service.submit(db, user, payload)

    result = RegistrationResult(
        application_id=application.id,
        candidate_code=application.candidate_code,
        bootcamp_name=application.bootcamp.name,
        program_title=application.program.title,
        email=user.email,
    )

    # Queued, not awaited. Background tasks run after the session dependency
    # has committed, so the registration is already durable — and a Gmail
    # outage cannot turn a successful registration into a 500.
    background.add_task(
        email_service.send_registration_confirmation,
        to=user.email,
        full_name=payload.full_name,
        candidate_code=application.candidate_code,
        bootcamp_name=application.bootcamp.name,
        program_title=application.program.title,
    )
    return result


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
    application_id: uuid.UUID, payload: StageAdvance, user: SuperAdminUser, db: DbSession
) -> ApplicationDetail:
    """Move a candidate to any stage, by hand. Scope is checked in the service.

    Super admin only (2026-09-03). This is the unrestricted override — it can
    put any application at any stage, skipping every gate the ordinary flow
    enforces. The routine paths an ADMIN needs all have their own endpoints
    that move stages as a *consequence* of a real decision: announcing AI
    interview results, and recording a Physical Interview outcome. Both call
    `application_service.advance_stage` internally, so restricting this route
    restricts the manual override without touching those.
    """
    application_service.advance_stage(
        db, application_id, to_stage=payload.to_stage, actor=user, reason=payload.reason
    )
    return _to_detail(application_service.get_detail(db, application_id))


@router.post("/{application_id}/reinstate", response_model=ApplicationDetail)
def reinstate(
    application_id: uuid.UUID, payload: StageAdvance, user: SuperAdminUser, db: DbSession
) -> ApplicationDetail:
    """Reopen a rejected or withdrawn application at the given stage.

    Without this a mistaken rejection was permanent: the candidate could not
    reapply either, because one application per person per intake is a unique
    index.

    Super admin only, alongside the stage override above: they are the two
    halves of the same manual control and are driven by the same dropdown.
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
