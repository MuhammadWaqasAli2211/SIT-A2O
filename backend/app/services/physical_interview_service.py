"""Physical Interview: bulk invite (venue/date/time), and the in-person
result an admin records afterwards.

Deliberately not the `interviews` table — see the migration for why. Two
tables for the same reason as interview_invite_batches/interview_invites:
the send covers many candidates in one action, so the batch carries what is
the same for all of them and the invite is the per-candidate record an
admin actually reads and decides.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.models.application import Application
from app.models.bootcamp import Bootcamp
from app.models.enums import ApplicationStage, ApplicationStatus, PhysicalInterviewResult
from app.models.physical_interview import PhysicalInterviewBatch, PhysicalInterviewInvite
from app.models.user import Profile
from app.schemas.physical_interview import (
    CandidatePhysicalInterviewStatus,
    PhysicalInterviewFunnel,
    PhysicalInterviewInviteRequest,
    RecordResultRequest,
)
from app.services import application_service, audit_service, bootcamp_service, email_service


# Long enough to be a reason rather than a keystroke. Matches MIN_NOTE in the
# frontend's RecordResultDialog — the dialog stops a typo reaching the server,
# this stops anything that is not the dialog.
MIN_REJECTION_NOTE = 4


def row_status(invite: PhysicalInterviewInvite) -> str:
    """Derived at read time, never stored — see PhysicalInterviewBatch.is_expired."""
    if invite.result == PhysicalInterviewResult.SELECTED:
        return "selected"
    if invite.result == PhysicalInterviewResult.REJECTED:
        return "rejected"
    if invite.batch.is_expired:
        return "missed"
    return "pending"


def _format_day(value) -> str:
    return value.strftime("%A")


def send_bulk(
    db: Session, bootcamp_id: uuid.UUID, payload: PhysicalInterviewInviteRequest, actor: Profile
) -> PhysicalInterviewBatch:
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)

    deadline_at = payload.deadline_at
    if deadline_at.tzinfo is None:
        deadline_at = deadline_at.replace(tzinfo=UTC)
    if deadline_at <= datetime.now(UTC):
        raise ConflictError("The result-recording deadline must be in the future.")

    applications = list(
        db.scalars(
            select(Application)
            .where(
                Application.id.in_(payload.application_ids),
                Application.bootcamp_id == bootcamp_id,
            )
            .options(selectinload(Application.profile))
        )
    )
    found_ids = {a.id for a in applications}
    missing = set(payload.application_ids) - found_ids
    if missing:
        raise NotFoundError(f"{len(missing)} application(s) were not found in this bootcamp.")

    ineligible = [
        a.candidate_code
        for a in applications
        if a.stage != ApplicationStage.PHYSICAL_INTERVIEW or a.status != ApplicationStatus.ACTIVE
    ]
    if ineligible:
        raise ConflictError(
            "Not eligible for a Physical Interview invite (must be an active application "
            f"at the Physical Interview stage): {', '.join(ineligible)}."
        )

    batch = PhysicalInterviewBatch(
        bootcamp_id=bootcamp_id,
        venue=payload.venue,
        interview_date=payload.interview_date,
        start_time=payload.start_time,
        deadline_at=deadline_at,
        subject=payload.subject,
        message=payload.message,
        created_by=actor.id,
    )
    db.add(batch)
    db.flush()

    invites = [
        PhysicalInterviewInvite(batch_id=batch.id, application_id=application.id)
        for application in applications
    ]
    db.add_all(invites)
    db.flush()

    # Batch-level fields substituted once, up front — the same render_partial
    # split interview_invite_service uses for its own covering email, leaving
    # $candidate_name and friends for email_service.render() to fill in per
    # recipient.
    body = email_service.render_partial(
        payload.message,
        {
            "venue": payload.venue,
            "interview_date": payload.interview_date.strftime("%d %B %Y"),
            "interview_day": _format_day(payload.interview_date),
            "interview_time": payload.start_time.strftime("%H:%M")
            if payload.start_time
            else "the time in your invitation email",
            "deadline": f"{deadline_at:%d %B %Y} at {deadline_at:%H:%M} UTC",
        },
    )
    try:
        result = email_service.send_to_applications(
            db,
            bootcamp_id,
            application_ids=[a.id for a in applications],
            subject=payload.subject,
            body_html=body,
            template="physical_interview_invite",
            actor=actor,
        )
        failed_addresses = set(result.failures)
    except AppError:
        # A send failure must not roll back the invite rows already written —
        # the batch still exists and the deadline still holds even if nobody
        # could be emailed about it.
        failed_addresses = {a.profile.email for a in applications}

    now = datetime.now(UTC)
    by_application = {a.id: a for a in applications}
    for invite in invites:
        email = by_application[invite.application_id].profile.email
        if email in failed_addresses:
            invite.send_failed = True
        else:
            invite.sent_at = now

    audit_service.record(
        db,
        actor=actor,
        action="physical_interview.bulk_invite",
        entity_type="bootcamp",
        entity_id=bootcamp_id,
        summary=f"Invited {len(invites)} candidate(s) to Physical Interview — {payload.venue}",
        metadata={
            "batch_id": str(batch.id),
            "count": len(invites),
            "venue": payload.venue,
            "interview_date": payload.interview_date.isoformat(),
        },
    )
    db.flush()
    return batch


def record_result(
    db: Session, invite_id: uuid.UUID, payload: RecordResultRequest, actor: Profile
) -> PhysicalInterviewInvite:
    invite = db.get(
        PhysicalInterviewInvite,
        invite_id,
        options=[selectinload(PhysicalInterviewInvite.batch)],
    )
    if invite is None:
        raise NotFoundError("Physical Interview invite not found.")
    bootcamp_service.assert_can_manage(db, actor, invite.batch.bootcamp_id)

    if invite.result is not None:
        raise ConflictError(
            f"A result ({invite.result.value.lower()}) is already recorded for this candidate."
        )

    # Checked here, before anything is written, because rejecting somebody is
    # the one decision on this screen nobody can review afterwards without a
    # reason attached — and until this existed the requirement lived only in
    # the dialog's own state, so any caller that was not that dialog could
    # reject a candidate with nothing recorded at all.
    if payload.result == PhysicalInterviewResult.REJECTED:
        note = (payload.rejection_note or "").strip()
        if len(note) < MIN_REJECTION_NOTE:
            raise ConflictError(
                f"A reason of at least {MIN_REJECTION_NOTE} characters is required to "
                "record a rejection."
            )

    application = application_service.get_detail(db, invite.application_id)

    # Advance the application first — it is the operation that can fail
    # (wrong stage, application no longer active), and the invite row should
    # not record a result the stage move never actually happened for.
    if payload.result == PhysicalInterviewResult.SELECTED:
        application_service.advance_stage(
            db,
            application.id,
            to_stage=ApplicationStage.FORM,
            actor=actor,
            reason="Physical Interview: selected",
        )
    else:
        application_service.advance_stage(
            db,
            application.id,
            to_stage=ApplicationStage.REJECTED,
            actor=actor,
            # The candidate-facing notification is built from from_stage/
            # to_stage by notify_stage_outcome, not from this reason string —
            # the internal rejection_note stays on the invite row only and is
            # never passed through here.
            reason="Physical Interview: not selected",
        )

    invite.result = payload.result
    invite.rejection_note = (
        payload.rejection_note if payload.result == PhysicalInterviewResult.REJECTED else None
    )
    invite.decided_at = datetime.now(UTC)
    invite.decided_by = actor.id

    audit_service.record(
        db,
        actor=actor,
        action="physical_interview.record_result",
        entity_type="physical_interview_invite",
        entity_id=invite.id,
        summary=f"{application.candidate_code}: Physical Interview {payload.result.value.lower()}",
        metadata={"result": payload.result.value, "has_note": bool(payload.rejection_note)},
    )
    db.flush()

    # Last, and never able to fail the call. `advance_stage` has already
    # written the stage move, the transition row and the in-app notification;
    # an unreachable mail server must not undo a decision an admin has made in
    # person. Both senders swallow and log their own failures.
    _email_outcome(db, application, payload.result)

    return invite


def _email_outcome(
    db: Session, application: Application, result: PhysicalInterviewResult
) -> None:
    """The candidate-facing half of a recorded result.

    Until this existed the only thing a decision produced for the candidate
    was the in-app notification `advance_stage` writes — which they saw only
    if they happened to open the portal. The selected email is the one that
    actually starts onboarding, since it is what tells them the folder is
    waiting.

    The rejection note is deliberately not passed: it is the admin's internal
    record, and `record_result` keeps it on the invite row alone.
    """
    profile = db.get(Profile, application.profile_id)
    if profile is None or not profile.email:
        return

    bootcamp = db.get(Bootcamp, application.bootcamp_id)
    bootcamp_name = bootcamp.name if bootcamp else "the bootcamp"

    send = (
        email_service.send_physical_interview_selected
        if result == PhysicalInterviewResult.SELECTED
        else email_service.send_physical_interview_rejected
    )
    send(
        to=profile.email,
        full_name=profile.full_name,
        candidate_code=application.candidate_code,
        bootcamp_name=bootcamp_name,
    )


_INVITE_ROW_LOAD = selectinload(PhysicalInterviewBatch.invites).options(
    selectinload(PhysicalInterviewInvite.application).selectinload(Application.profile),
)


def list_for_bootcamp(
    db: Session, bootcamp_id: uuid.UUID, actor: Profile
) -> list[PhysicalInterviewBatch]:
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
    return list(
        db.scalars(
            select(PhysicalInterviewBatch)
            .where(PhysicalInterviewBatch.bootcamp_id == bootcamp_id)
            .options(_INVITE_ROW_LOAD)
            .order_by(PhysicalInterviewBatch.created_at.desc())
        )
    )


def get_detail(db: Session, batch_id: uuid.UUID, actor: Profile) -> PhysicalInterviewBatch:
    batch = db.get(PhysicalInterviewBatch, batch_id, options=[_INVITE_ROW_LOAD])
    if batch is None:
        raise NotFoundError("Physical Interview batch not found.")
    bootcamp_service.assert_can_manage(db, actor, batch.bootcamp_id)
    return batch


def funnel_stats(db: Session, bootcamp_id: uuid.UUID, actor: Profile) -> PhysicalInterviewFunnel:
    """One row per candidate ever invited to this bootcamp's Physical
    Interview — the latest invite if invited more than once — bucketed by
    the same derived status row_status() computes. One query: the DISTINCT ON
    picks the latest row per application, the outer select aggregates it in
    the same round trip."""
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)

    latest = (
        select(
            PhysicalInterviewInvite.application_id,
            PhysicalInterviewInvite.result,
            PhysicalInterviewBatch.deadline_at,
        )
        .distinct(PhysicalInterviewInvite.application_id)
        .join(PhysicalInterviewBatch, PhysicalInterviewBatch.id == PhysicalInterviewInvite.batch_id)
        .where(PhysicalInterviewBatch.bootcamp_id == bootcamp_id)
        .order_by(PhysicalInterviewInvite.application_id, PhysicalInterviewInvite.created_at.desc())
        .subquery()
    )

    now = datetime.now(UTC)
    row = db.execute(
        select(
            func.count().label("invited"),
            func.count()
            .filter(latest.c.result == PhysicalInterviewResult.SELECTED)
            .label("selected"),
            func.count()
            .filter(latest.c.result == PhysicalInterviewResult.REJECTED)
            .label("rejected"),
            func.count()
            .filter(latest.c.result.is_(None), latest.c.deadline_at >= now)
            .label("pending"),
            func.count()
            .filter(latest.c.result.is_(None), latest.c.deadline_at < now)
            .label("missed"),
        ).select_from(latest)
    ).one()

    return PhysicalInterviewFunnel(
        invited=row.invited,
        selected=row.selected,
        rejected=row.rejected,
        pending=row.pending,
        missed=row.missed,
    )


def my_status(db: Session, user: Profile) -> CandidatePhysicalInterviewStatus:
    """The candidate's own latest Physical Interview invite, if any. Same
    resolution shape as ai_interview_service.candidate_score: joined from
    the profile rather than requiring the caller to already hold an
    Application, since a candidate route only ever has the signed-in user."""
    invite = db.scalar(
        select(PhysicalInterviewInvite)
        .join(Application, Application.id == PhysicalInterviewInvite.application_id)
        .where(Application.profile_id == user.id)
        .options(selectinload(PhysicalInterviewInvite.batch))
        .order_by(PhysicalInterviewInvite.created_at.desc())
        .limit(1)
    )
    if invite is None:
        return CandidatePhysicalInterviewStatus(status="not_invited")

    # row_status()'s "pending" is the admin-side label ("awaiting a result");
    # the candidate reads the same state as "invited" until told otherwise.
    derived = row_status(invite)
    status = "invited" if derived == "pending" else derived

    return CandidatePhysicalInterviewStatus(
        status=status,  # type: ignore[arg-type]
        venue=invite.batch.venue,
        interview_date=invite.batch.interview_date,
        start_time=invite.batch.start_time,
        deadline_at=invite.batch.deadline_at,
    )
