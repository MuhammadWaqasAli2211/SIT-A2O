"""Interview scheduling, rescheduling, and outcome recording.

Scope is always derived from the interview's application, never taken from the
caller: an admin may only touch interviews belonging to an intake they run.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, aliased

from app.core.exceptions import ConflictError, NotFoundError
from app.models.application import Application
from app.models.bootcamp import Program
from app.models.enums import ApplicationStage, ApplicationStatus, InterviewStatus, UserRole
from app.models.interview import Interview
from app.models.user import Profile
from app.schemas.interview import (
    BulkScheduleRequest,
    InterviewCreate,
    InterviewRow,
    InterviewUpdate,
)
from app.services import application_service, audit_service, bootcamp_service


def _get(db: Session, interview_id: uuid.UUID) -> Interview:
    interview = db.get(Interview, interview_id)
    if interview is None:
        raise NotFoundError("Interview not found.")
    return interview


def _assert_scope(db: Session, interview: Interview, actor: Profile) -> Application:
    application = application_service.get_detail(db, interview.application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)
    return application


def _assert_interviewer(db: Session, interviewer_id: uuid.UUID | None) -> None:
    if interviewer_id is None:
        return
    interviewer = db.get(Profile, interviewer_id)
    if interviewer is None:
        raise NotFoundError("Interviewer not found.")
    if interviewer.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise ConflictError("Only administrators can be assigned as interviewers.")


def schedule(db: Session, payload: InterviewCreate, actor: Profile) -> Interview:
    application = application_service.get_detail(db, payload.application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)
    _assert_interviewer(db, payload.interviewer_id)

    if application.status != ApplicationStatus.ACTIVE:
        raise ConflictError(
            f"{application.candidate_code} is {application.status.value.lower()} "
            "and cannot be scheduled."
        )

    # A candidate with an interview still pending should be rescheduled, not
    # given a second concurrent slot.
    pending = db.scalar(
        select(Interview).where(
            Interview.application_id == payload.application_id,
            Interview.status == InterviewStatus.SCHEDULED,
        )
    )
    if pending is not None:
        raise ConflictError(
            "This candidate already has a scheduled interview. Reschedule it instead.",
            details=str(pending.id),
        )

    interview = Interview(**payload.model_dump(), created_by=actor.id)
    db.add(interview)
    db.flush()

    audit_service.record(
        db,
        actor=actor,
        action="interview.schedule",
        entity_type="interview",
        entity_id=interview.id,
        summary=f"Scheduled {application.candidate_code} for "
        f"{interview.scheduled_at:%d %b %Y %H:%M}",
        metadata={"application_id": str(application.id), "mode": interview.mode.value},
    )
    return interview


def bulk_schedule(
    db: Session, bootcamp_id: uuid.UUID, payload: BulkScheduleRequest, actor: Profile
) -> list[Interview]:
    """Schedule a whole batch in one transaction.

    All-or-nothing on purpose: a partially scheduled batch leaves an admin
    guessing which half went out, which is worse than a clean failure.
    """
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
    _assert_interviewer(db, payload.interviewer_id)

    created: list[Interview] = []
    for slot in payload.slots:
        interview = schedule(
            db,
            InterviewCreate(
                application_id=slot.application_id,
                scheduled_at=slot.scheduled_at,
                duration_minutes=payload.duration_minutes,
                mode=payload.mode,
                location=payload.location,
                interviewer_id=payload.interviewer_id,
                batch_label=payload.batch_label,
            ),
            actor,
        )
        created.append(interview)

        if payload.advance_stage:
            application = application_service.get_detail(db, slot.application_id)
            if application.stage != ApplicationStage.INTERVIEW_SCHEDULED:
                application_service.advance_stage(
                    db,
                    slot.application_id,
                    to_stage=ApplicationStage.INTERVIEW_SCHEDULED,
                    actor=actor,
                    reason=f"Batch scheduled ({payload.batch_label or 'unlabelled'})",
                )

    audit_service.record(
        db,
        actor=actor,
        action="interview.bulk_schedule",
        entity_type="bootcamp",
        entity_id=bootcamp_id,
        summary=f"Scheduled {len(created)} interviews "
        f"({payload.batch_label or 'unlabelled batch'})",
        metadata={"count": len(created), "batch_label": payload.batch_label},
    )
    db.flush()
    return created


def update(
    db: Session, interview_id: uuid.UUID, payload: InterviewUpdate, actor: Profile
) -> Interview:
    interview = _get(db, interview_id)
    application = _assert_scope(db, interview, actor)

    changes = payload.model_dump(exclude_unset=True)
    if "interviewer_id" in changes:
        _assert_interviewer(db, changes["interviewer_id"])

    before = {field: getattr(interview, field) for field in changes}
    for field, value in changes.items():
        setattr(interview, field, value)

    # The DB CHECK enforces this too, but only after the merge of stored and
    # incoming values — which is exactly the case the schema validator cannot see.
    if interview.score is not None and interview.status != InterviewStatus.COMPLETED:
        raise ConflictError("A score can only be recorded on a COMPLETED interview.")

    audit_service.record(
        db,
        actor=actor,
        action="interview.update",
        entity_type="interview",
        entity_id=interview.id,
        summary=f"Updated {application.candidate_code}'s interview",
        metadata={"changes": audit_service.diff(before, changes)},
    )
    db.flush()
    return interview


def cancel(db: Session, interview_id: uuid.UUID, actor: Profile, reason: str | None) -> Interview:
    interview = _get(db, interview_id)
    application = _assert_scope(db, interview, actor)

    if interview.status != InterviewStatus.SCHEDULED:
        raise ConflictError(f"This interview is already {interview.status.value.lower()}.")

    interview.status = InterviewStatus.CANCELLED
    if reason:
        interview.notes = f"{interview.notes}\n{reason}".strip() if interview.notes else reason

    audit_service.record(
        db,
        actor=actor,
        action="interview.cancel",
        entity_type="interview",
        entity_id=interview.id,
        summary=f"Cancelled {application.candidate_code}'s interview",
        metadata={"reason": reason},
    )
    db.flush()
    return interview


def delete(db: Session, interview_id: uuid.UUID, actor: Profile) -> None:
    interview = _get(db, interview_id)
    application = _assert_scope(db, interview, actor)

    audit_service.record(
        db,
        actor=actor,
        action="interview.delete",
        entity_type="interview",
        entity_id=interview.id,
        summary=f"Deleted an interview for {application.candidate_code}",
        metadata={"scheduled_at": str(interview.scheduled_at)},
    )
    db.delete(interview)
    db.flush()


# ----------------------------------------------------------------- reads --


def _row_query() -> Select:
    interviewer = aliased(Profile)
    return (
        select(Interview, Application, Profile, Program, interviewer.full_name)
        .join(Application, Application.id == Interview.application_id)
        .join(Profile, Profile.id == Application.profile_id)
        .join(Program, Program.id == Application.program_id)
        .outerjoin(interviewer, interviewer.id == Interview.interviewer_id)
    )


def _to_row(interview, application, profile, program, interviewer_name) -> InterviewRow:
    return InterviewRow(
        **{
            field: getattr(interview, field)
            for field in (
                "id", "application_id", "scheduled_at", "duration_minutes", "mode",
                "location", "interviewer_id", "status", "score", "notes",
                "batch_label", "created_at",
            )
        },
        candidate_code=application.candidate_code,
        candidate_name=profile.full_name,
        candidate_email=profile.email,
        program_title=program.title,
        interviewer_name=interviewer_name,
    )


def list_for_bootcamp(
    db: Session,
    bootcamp_id: uuid.UUID,
    *,
    status: InterviewStatus | None = None,
    program_id: uuid.UUID | None = None,
    batch_label: str | None = None,
    upcoming_only: bool = False,
    search: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> tuple[list[InterviewRow], int]:
    stmt = _row_query().where(Application.bootcamp_id == bootcamp_id)

    if status is not None:
        stmt = stmt.where(Interview.status == status)
    if program_id is not None:
        stmt = stmt.where(Application.program_id == program_id)
    if batch_label:
        stmt = stmt.where(Interview.batch_label == batch_label)
    if upcoming_only:
        stmt = stmt.where(
            Interview.scheduled_at >= datetime.now(UTC),
            Interview.status == InterviewStatus.SCHEDULED,
        )
    if search:
        needle = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            func.lower(Profile.full_name).like(needle)
            | func.lower(Profile.email).like(needle)
            | func.lower(Application.candidate_code).like(needle)
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(
        stmt.order_by(Interview.scheduled_at.desc()).limit(limit).offset(offset)
    ).all()
    return [_to_row(*row) for row in rows], total


def list_for_application(db: Session, application_id: uuid.UUID) -> list[InterviewRow]:
    rows = db.execute(
        _row_query()
        .where(Interview.application_id == application_id)
        .order_by(Interview.scheduled_at.desc())
    ).all()
    return [_to_row(*row) for row in rows]
