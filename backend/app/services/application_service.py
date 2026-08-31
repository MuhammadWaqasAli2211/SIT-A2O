"""Applications: submission, listing, and stage transitions."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.models.application import Application, StageTransition
from app.models.bootcamp import Bootcamp, BootcampProgram, Program
from app.models.enums import ApplicationStage, ApplicationStatus, PhaseType
from app.models.interview import Interview
from app.models.user import CandidateProfile, Profile
from app.schemas.application import (
    AdminApplicationDetail,
    ApplicantRow,
    ApplicationCreate,
    ApplicationOut,
    StageTransitionOut,
)
from app.schemas.bootcamp import ProgramOut
from app.services import audit_service, bootcamp_service, notification_service

# Set by the unique (bootcamp_id, profile_id) index on applications.
_DUPLICATE_APPLICATION_CONSTRAINT = "applications_bootcamp_id_profile_id_key"


def _is_duplicate_application(exc: IntegrityError) -> bool:
    constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    return constraint == _DUPLICATE_APPLICATION_CONSTRAINT


# The two stored stages that render as the single "Interview" node.
_INTERVIEW_STAGES = (
    ApplicationStage.INTERVIEW_SCHEDULED,
    ApplicationStage.INTERVIEWED,
)


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

    _upsert_candidate_profile(db, applicant, payload)

    application = Application(
        bootcamp_id=payload.bootcamp_id,
        profile_id=applicant.id,
        program_id=payload.program_id,
        candidate_code=_mint_candidate_code(db, payload.bootcamp_id),
        stage=ApplicationStage.APPLIED,
        status=ApplicationStatus.ACTIVE,
        statement=payload.statement,
        prior_course=payload.prior_course,
        prior_course_status=payload.prior_course_status,
        campus=payload.campus,
        computer_proficiency=payload.computer_proficiency,
        last_qualification=payload.last_qualification,
        referral_source=payload.referral_source,
        has_laptop=payload.has_laptop,
        is_university_student=payload.is_university_student,
        university_name=payload.university_name,
        university_semester=payload.university_semester,
        university_timing=payload.university_timing,
        # Stamped server-side. A client-supplied timestamp is a claim, not a
        # record.
        terms_accepted_at=datetime.now(timezone.utc),
        terms_version=payload.terms_version,
    )
    db.add(application)

    # The SELECT above is not a lock, so two simultaneous submissions can both
    # pass it. The unique (bootcamp_id, profile_id) index is the real guard —
    # translate its violation into the same 409 the non-racing path returns,
    # rather than letting it surface as an opaque 500.
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        if _is_duplicate_application(exc):
            raise ConflictError("You have already applied to this bootcamp.") from exc
        raise

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


# Everything ApplicationDetail serialises, eager-loaded in one place so the
# detail and list paths cannot drift into different query plans. Phases come
# along because the candidate tracker renders their deadlines.
_DETAIL_LOADS = (
    selectinload(Application.program),
    selectinload(Application.bootcamp).selectinload(Bootcamp.phases),
    selectinload(Application.transitions),
)


def _upsert_candidate_profile(
    db: Session, applicant: Profile, payload: ApplicationCreate
) -> CandidateProfile:
    """Write the person-level half of the registration.

    Upsert rather than insert: a candidate applying to a second intake already
    has a row, and their details may have changed since. Runs in the caller's
    transaction, so a failure here rolls the application back with it — a
    half-written registration is worse than none.
    """
    profile = db.get(CandidateProfile, applicant.id)
    if profile is None:
        profile = CandidateProfile(profile_id=applicant.id)
        db.add(profile)

    profile.full_name = payload.full_name
    profile.father_name = payload.father_name
    profile.gender = payload.gender
    profile.date_of_birth = payload.date_of_birth
    profile.city = payload.city
    profile.phone = payload.phone
    profile.father_phone = payload.father_phone
    profile.cnic = payload.cnic
    # Derived from the date of birth beside it, not taken from the client.
    profile.id_document_type = payload.id_document_type
    profile.father_cnic = payload.father_cnic
    profile.address = payload.address
    profile.saylani_roll_number = payload.saylani_roll_number
    profile.education = payload.last_qualification

    # Keep the account's own name and phone in step, so the portal header and
    # /auth/me stop showing a blank or stale name after registering.
    applicant.full_name = payload.full_name
    applicant.phone = payload.phone

    db.flush()
    return profile


def get_detail(db: Session, application_id: uuid.UUID) -> Application:
    application = db.scalar(
        select(Application).where(Application.id == application_id).options(*_DETAIL_LOADS)
    )
    if application is None:
        raise NotFoundError("Application not found.")
    return application


def get_admin_detail(
    db: Session, application_id: uuid.UUID, actor: Profile
) -> AdminApplicationDetail:
    """The full record, with the contact details an admin needs to act on it."""
    application = get_detail(db, application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)

    profile = db.scalar(
        select(Profile)
        .where(Profile.id == application.profile_id)
        .options(selectinload(Profile.candidate_profile))
    )
    if profile is None:
        raise NotFoundError("The applicant's profile no longer exists.")

    candidate = profile.candidate_profile
    interviews = db.scalar(
        select(func.count())
        .select_from(Interview)
        .where(Interview.application_id == application_id)
    )

    return AdminApplicationDetail(
        **ApplicationOut.model_validate(application).model_dump(),
        program=ProgramOut.model_validate(application.program),
        bootcamp_name=application.bootcamp.name,
        bootcamp_number=application.bootcamp.bootcamp_number,
        timeline=[StageTransitionOut.model_validate(t) for t in application.transitions],
        full_name=profile.full_name,
        email=profile.email,
        phone=profile.phone,
        city=candidate.city if candidate else None,
        education=candidate.education if candidate else None,
        date_of_birth=candidate.date_of_birth if candidate else None,
        interview_count=interviews or 0,
    )


def get_date_of_birth(db: Session, application: Application) -> date:
    """The applicant's DOB, for the age-conditional onboarding rules.

    Registration requires it, so a missing row here means the data is
    corrupt, not merely absent — raised rather than returned as None so a
    caller cannot silently treat a data problem as "treat them as a minor".
    """
    candidate = db.get(CandidateProfile, application.profile_id)
    if candidate is None or candidate.date_of_birth is None:
        raise ConflictError("This candidate has no date of birth on file.")
    return candidate.date_of_birth


def my_applications(db: Session, applicant: Profile) -> list[Application]:
    return list(
        db.scalars(
            select(Application)
            .where(Application.profile_id == applicant.id)
            .options(*_DETAIL_LOADS)
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
        select(Application, Profile, Program, CandidateProfile.cnic)
        .join(Profile, Profile.id == Application.profile_id)
        .join(Program, Program.id == Application.program_id)
        # Outer: a profile with no registration yet has no candidate_profiles
        # row at all, and that must not drop the applicant from the list.
        .outerjoin(CandidateProfile, CandidateProfile.profile_id == Profile.id)
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
            has_cnic=cnic is not None,
            course_completed=app.prior_course_status == "Completed",
        )
        for app, profile, program, cnic in rows
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

    # A closed application is a state conflict, not a permissions problem — the
    # same admin may reopen it via reinstate(). Returning 403 here (as this once
    # did) told the caller to go find someone with more rights, which was wrong.
    if application.status != ApplicationStatus.ACTIVE:
        raise ConflictError(
            f"This application is {application.status.value.lower()}. "
            "Reinstate it before moving it to another stage."
        )

    previous = application.stage
    application.stage = to_stage

    # Selection is derived from the transition rather than passed in, so the
    # flag can never disagree with the stage it describes.
    if to_stage == ApplicationStage.PHYSICAL_INTERVIEW:
        application.is_selected = True
    elif to_stage == ApplicationStage.REJECTED:
        application.status = ApplicationStatus.REJECTED
        # Only record a verdict when the interview is the round they fell at.
        # Somebody rejected later was still selected, and overwriting that
        # would lose which gate actually stopped them.
        if previous in _INTERVIEW_STAGES:
            application.is_selected = False

    db.add(
        StageTransition(
            application_id=application.id,
            from_stage=previous,
            to_stage=to_stage,
            actor_id=actor.id,
            reason=reason,
        )
    )
    audit_service.record(
        db,
        actor=actor,
        action="application.advance_stage",
        entity_type="application",
        entity_id=application.id,
        summary=f"{application.candidate_code}: {previous.value} to {to_stage.value}",
        metadata={"from": previous.value, "to": to_stage.value, "reason": reason},
    )
    notification_service.notify_stage_outcome(
        db,
        profile_id=application.profile_id,
        application_id=application.id,
        candidate_code=application.candidate_code,
        from_stage=previous,
        to_stage=to_stage,
    )
    db.flush()
    return application


def reinstate(
    db: Session,
    application_id: uuid.UUID,
    *,
    to_stage: ApplicationStage,
    actor: Profile,
    reason: str | None = None,
) -> Application:
    """Reopen a rejected or withdrawn application.

    Exists because rejection was otherwise terminal: an accidental reject had
    no route back, and the candidate's only option was to reapply, which the
    unique (bootcamp, profile) index forbids.
    """
    application = get_detail(db, application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)

    if application.status == ApplicationStatus.ACTIVE:
        raise ConflictError("This application is already active.")
    if to_stage == ApplicationStage.REJECTED:
        raise ConflictError("Reinstating to REJECTED is not a reinstatement.")

    previous = application.stage
    application.stage = to_stage
    application.status = ApplicationStatus.ACTIVE

    db.add(
        StageTransition(
            application_id=application.id,
            from_stage=previous,
            to_stage=to_stage,
            actor_id=actor.id,
            reason=reason or "Reinstated",
        )
    )
    audit_service.record(
        db,
        actor=actor,
        action="application.reinstate",
        entity_type="application",
        entity_id=application.id,
        summary=f"Reinstated {application.candidate_code} at {to_stage.value}",
        metadata={"from_status": previous.value, "to": to_stage.value, "reason": reason},
    )
    db.flush()
    return application


def update_application(
    db: Session,
    application_id: uuid.UUID,
    *,
    actor: Profile,
    program_id: uuid.UUID | None = None,
    statement: str | None = None,
) -> Application:
    """Admin correction of an application's own fields.

    Stage and status are deliberately not editable here — they move through
    advance_stage/reinstate so that every change leaves a StageTransition.
    """
    application = get_detail(db, application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)

    changes: dict[str, object] = {}
    if program_id is not None and program_id != application.program_id:
        offered = db.get(
            BootcampProgram,
            {"bootcamp_id": application.bootcamp_id, "program_id": program_id},
        )
        if offered is None:
            raise ConflictError("That program is not offered in this bootcamp.")
        changes["program_id"] = {"from": str(application.program_id), "to": str(program_id)}
        application.program_id = program_id

    if statement is not None and statement != application.statement:
        changes["statement"] = {"from": application.statement, "to": statement}
        application.statement = statement

    if changes:
        audit_service.record(
            db,
            actor=actor,
            action="application.update",
            entity_type="application",
            entity_id=application.id,
            summary=f"Edited {application.candidate_code}",
            metadata={"changes": changes},
        )
    db.flush()
    return get_detail(db, application_id)


def delete_application(db: Session, application_id: uuid.UUID, actor: Profile) -> None:
    """Hard delete, for genuine mistakes only.

    The candidate code is *not* returned to the pool: next_candidate_seq only
    moves forward, so a deleted B07-004 leaves a permanent gap rather than
    letting a later applicant inherit a code that already appeared in an email.
    """
    application = get_detail(db, application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)

    audit_service.record(
        db,
        actor=actor,
        action="application.delete",
        entity_type="application",
        entity_id=application.id,
        summary=f"Deleted application {application.candidate_code}",
        metadata={
            "candidate_code": application.candidate_code,
            "bootcamp_id": str(application.bootcamp_id),
            "profile_id": str(application.profile_id),
        },
    )
    db.delete(application)
    db.flush()
