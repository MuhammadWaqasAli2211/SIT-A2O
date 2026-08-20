"""Applications: submission, listing, and stage transitions."""

import uuid

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.models.application import Application, StageTransition
from app.models.bootcamp import BootcampProgram, Program
from app.models.enums import ApplicationStage, ApplicationStatus, PhaseType
from app.models.user import Profile
from app.schemas.application import ApplicantRow, ApplicationCreate
from app.services import bootcamp_service


def _mint_candidate_code(db: Session, bootcamp_id: uuid.UUID) -> str:
    """Delegate to the SQL function, which holds a row lock while it increments.

    Deliberately not computed in Python: `count(*) + 1` would let two
    simultaneous applicants receive the same code.
    """
    return db.execute(
        text("select public.mint_candidate_code(:bootcamp_id)"),
        {"bootcamp_id": str(bootcamp_id)},
    ).scalar_one()


def submit(db: Session, applicant: Profile, payload: ApplicationCreate) -> Application:
    # Server-side gate. The UI hides the button when registration is shut, but
    # hiding a button is not enforcement.
    bootcamp_service.assert_phase_open(db, payload.bootcamp_id, PhaseType.REGISTRATION)

    existing = db.scalar(
        select(Application).where(
            Application.bootcamp_id == payload.bootcamp_id,
            Application.profile_id == applicant.id,
        )
    )
    if existing is not None:
        raise ConflictError(
            "You have already applied to this bootcamp.", details=existing.candidate_code
        )

    offered = db.get(
        BootcampProgram,
        {"bootcamp_id": payload.bootcamp_id, "program_id": payload.program_id},
    )
    if offered is None:
        raise ConflictError("That program is not offered in this bootcamp.")

    application = Application(
        bootcamp_id=payload.bootcamp_id,
        profile_id=applicant.id,
        program_id=payload.program_id,
        candidate_code=_mint_candidate_code(db, payload.bootcamp_id),
        stage=ApplicationStage.APPLIED,
        status=ApplicationStatus.ACTIVE,
        statement=payload.statement,
    )
    db.add(application)
    db.flush()

    # Record the opening entry too, so the timeline starts at submission
    # rather than at the first admin action.
    db.add(
        StageTransition(
            application_id=application.id,
            from_stage=None,
            to_stage=ApplicationStage.APPLIED,
            actor_id=applicant.id,
            reason="Application submitted",
        )
    )
    db.flush()
    return get_detail(db, application.id)


def get_detail(db: Session, application_id: uuid.UUID) -> Application:
    application = db.scalar(
        select(Application)
        .where(Application.id == application_id)
        .options(
            selectinload(Application.program),
            selectinload(Application.bootcamp),
            selectinload(Application.transitions),
        )
    )
    if application is None:
        raise NotFoundError("Application not found.")
    return application


def my_applications(db: Session, applicant: Profile) -> list[Application]:
    return list(
        db.scalars(
            select(Application)
            .where(Application.profile_id == applicant.id)
            .options(
                selectinload(Application.program),
                selectinload(Application.bootcamp),
                selectinload(Application.transitions),
            )
            .order_by(Application.applied_at.desc())
        )
    )


def get_own(db: Session, applicant: Profile, application_id: uuid.UUID) -> Application:
    application = get_detail(db, application_id)
    if application.profile_id != applicant.id:
        # 404 rather than 403: confirming the row exists would leak that
        # somebody else holds this application id.
        raise NotFoundError("Application not found.")
    return application


def list_for_bootcamp(
    db: Session,
    bootcamp_id: uuid.UUID,
    *,
    stage: ApplicationStage | None = None,
    search: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> tuple[list[ApplicantRow], int]:
    filters = [Application.bootcamp_id == bootcamp_id]
    if stage is not None:
        filters.append(Application.stage == stage)
    if search:
        needle = f"%{search.strip().lower()}%"
        filters.append(
            func.lower(Profile.full_name).like(needle)
            | func.lower(Profile.email).like(needle)
            | func.lower(Application.candidate_code).like(needle)
        )

    base = (
        select(Application, Profile, Program)
        .join(Profile, Profile.id == Application.profile_id)
        .join(Program, Program.id == Application.program_id)
        .where(*filters)
    )

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    rows = db.execute(
        base.order_by(Application.candidate_code).limit(limit).offset(offset)
    ).all()

    items = [
        ApplicantRow(
            id=app.id,
            candidate_code=app.candidate_code,
            full_name=profile.full_name,
            email=profile.email,
            program_title=program.title,
            stage=app.stage,
            status=app.status,
            applied_at=app.applied_at,
        )
        for app, profile, program in rows
    ]
    return items, total


def advance_stage(
    db: Session,
    application_id: uuid.UUID,
    *,
    to_stage: ApplicationStage,
    actor: Profile,
    reason: str | None = None,
) -> Application:
    application = get_detail(db, application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)

    if application.stage == to_stage:
        raise ConflictError(f"Application is already at {to_stage.value}.")
    if application.status != ApplicationStatus.ACTIVE:
        raise PermissionDeniedError(
            f"This application is {application.status.value.lower()} and cannot be advanced."
        )

    previous = application.stage
    application.stage = to_stage
    if to_stage == ApplicationStage.REJECTED:
        application.status = ApplicationStatus.REJECTED

    db.add(
        StageTransition(
            application_id=application.id,
            from_stage=previous,
            to_stage=to_stage,
            actor_id=actor.id,
            reason=reason,
        )
    )
    db.flush()
    return application
