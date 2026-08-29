"""Bulk AI interview invites, sent through InterviewerAI.

The Phase 2 screening step: an admin selects applicants (or supplies rows by
hand, for anyone outside our own data — an Instructor, most likely) and this
sends them all to InterviewerAI in one call. See
app/integrations/interviewer_ai.py for what that service is and is not.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.integrations import interviewer_ai
from app.models.application import Application
from app.models.enums import ApplicationStage, InviteBatchStatus, InviteStatus, PhaseType
from app.models.interview_invite import InterviewInvite, InterviewInviteBatch
from app.models.user import Profile
from app.schemas.interview_invite import BulkInviteRequest, ManualInviteRow
from app.services import application_service, audit_service, bootcamp_service

# Our program slugs don't split the same way InterviewerAI's categories do —
# Web and Mobile Development is one category on their side, two programs on
# ours — so this is a many-to-one map, not a renamed enum.
_CATEGORY_BY_PROGRAM_SLUG: dict[str, str] = {
    "web-development": "Web and Mobile App Development",
    "mobile-development": "Web and Mobile App Development",
    "data-science": "AI",
    "cloud-devops": "Cloud & Data Engineering",
    "ui-ux-design": "Graphics and UI/UX Design",
}

# InterviewerAI accepts "completed" or "ongoing" as values, but a live
# rejection (2026-08-27) said plainly: "Only 'completed' candidates can be
# sent an interview invite ('Ongoing' is currently disabled)". So this is not
# a mapping — "completed" is the only value ever sent, and a candidate who
# has not finished their prior course is not eligible yet, full stop. See the
# eligibility check in send_bulk() below.
_COURSE_STATUS = "completed"

# InterviewerAI's documentation says the terminal status is "completed"; the
# live API actually returns "complete" (verified against batch 26 on their
# service, 2026-08-27). Accepting both rather than trusting either source on
# its own.
_EXTERNAL_STATUS_ALIASES = {"COMPLETE": InviteBatchStatus.COMPLETED}


def _batch_status_from(raw: str | None, fallback: InviteBatchStatus) -> InviteBatchStatus:
    """Falls back rather than raising on a status string we cannot parse —
    that is not a reason to fail the whole send or poll."""
    upper = (raw or "").upper()
    if upper in _EXTERNAL_STATUS_ALIASES:
        return _EXTERNAL_STATUS_ALIASES[upper]
    try:
        return InviteBatchStatus(upper)
    except ValueError:
        return fallback


def _category_for(program_slug: str) -> str:
    category = _CATEGORY_BY_PROGRAM_SLUG.get(program_slug)
    if category is None:
        raise ConflictError(
            f"No InterviewerAI category is mapped for the program '{program_slug}'."
        )
    return category


def _link_external_candidates(invites: list[InterviewInvite]) -> None:
    """Record InterviewerAI's own candidate id against each invite.

    Best-effort by design: the invites have already been sent by the time
    this runs, so a lookup that fails or comes back empty must leave the
    batch intact and simply go unlinked. ai_interview_service falls back to
    an email match for anything missing a id, and backfills it on first read.
    """
    for invite in invites:
        try:
            found = interviewer_ai.find_candidate_by_email(invite.email)
        except AppError:
            # Their service being unreachable or rate-limiting us is not a
            # reason to fail a send that already succeeded.
            return
        if found and isinstance(found.get("id"), int):
            invite.external_candidate_id = found["id"]


def send_bulk(
    db: Session, bootcamp_id: uuid.UUID, payload: BulkInviteRequest, actor: Profile
) -> InterviewInviteBatch:
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)

    # The same flag-and-clock gate registration uses, not a second mechanism:
    # an invite may only go out while the intake's INTERVIEW phase is actually
    # open, and `assert_phase_open` already refuses a phase whose deadline has
    # passed even if somebody left the flag on.
    phase = bootcamp_service.assert_phase_open(db, bootcamp_id, PhaseType.INTERVIEW)

    # Required at the point of sending rather than defaulted. A deadline is
    # what makes the invite expire, and an invite with no expiry is a link
    # that works forever — so there is no sensible default to fall back to,
    # and guessing one here would be inventing a promise to the candidate.
    if phase.deadline_at is None:
        raise ConflictError(
            "The interview phase has no deadline set. Add one on the Phases "
            "screen before sending invites — it is what expires the interview link."
        )

    applications: list[Application] = []
    if payload.application_ids:
        applications = list(
            db.scalars(
                select(Application)
                .where(
                    Application.id.in_(payload.application_ids),
                    Application.bootcamp_id == bootcamp_id,
                )
                .options(
                    selectinload(Application.profile),
                    selectinload(Application.program),
                )
            )
        )
        found_ids = {a.id for a in applications}
        missing = set(payload.application_ids) - found_ids
        if missing:
            raise NotFoundError(
                f"{len(missing)} application(s) were not found in this bootcamp."
            )

    if not applications and not payload.manual_rows:
        raise ConflictError("Select at least one candidate or add a row by hand.")

    # Built in one pass so `rows` (what InterviewerAI receives) and the
    # InterviewInvite records we persist share the same row_index — that
    # index is the only thing tying a later `failures` entry back to a row.
    rows: list[dict[str, str]] = []
    invites: list[InterviewInvite] = []

    for application in applications:
        candidate = application.profile.candidate_profile
        if candidate is None or not candidate.cnic:
            raise ConflictError(
                f"{application.candidate_code} has no CNIC on file and cannot be invited."
            )

        # Not a mapping choice — a hard gate. Verified against a live
        # rejection, 2026-08-27: "Only 'completed' candidates can be sent an
        # interview invite ('Ongoing' is currently disabled)". Sending one
        # in-progress candidate refuses the whole batch, not just that row.
        if application.prior_course_status != "Completed":
            raise ConflictError(
                f"{application.candidate_code} has not completed their prior course "
                "and cannot be invited yet."
            )

        category = _category_for(application.program.slug)

        row = {
            "name": application.profile.full_name or candidate.full_name or "",
            "email": application.profile.email,
            "cnic": candidate.cnic,
            "category": category,
            "course_status": _COURSE_STATUS,
        }
        rows.append(row)

        invites.append(
            InterviewInvite(
                application_id=application.id,
                row_index=len(rows) - 1,
                full_name=row["name"],
                email=row["email"],
                cnic=row["cnic"],
                category=category,
                course_status=_COURSE_STATUS,
            )
        )

    for manual in payload.manual_rows:
        # Instructor is the one category InterviewerAI does not ask a course
        # status for; every other manual row needs the same "completed" every
        # applicant row does, and there is no other value worth offering —
        # see _COURSE_STATUS above.
        course_status = None if manual.category == "Instructor" else _COURSE_STATUS

        row = {
            "name": manual.full_name,
            "email": manual.email,
            "cnic": manual.cnic,
            "category": manual.category,
        }
        if course_status:
            row["course_status"] = course_status
        rows.append(row)

        invites.append(
            InterviewInvite(
                application_id=None,
                row_index=len(rows) - 1,
                full_name=manual.full_name,
                email=manual.email,
                cnic=manual.cnic,
                category=manual.category,
                course_status=course_status,
            )
        )

    # The call that can fail. Nothing has been written yet, so a rejection
    # here (InterviewerAI refuses the whole batch on one bad row) leaves no
    # partial batch behind to clean up.
    external = interviewer_ai.send_bulk_invite(
        subject=payload.subject,
        rows=rows,
        batch_name=payload.batch_name,
        personalize=payload.personalize,
    )

    batch = InterviewInviteBatch(
        bootcamp_id=bootcamp_id,
        external_batch_id=external.get("id"),
        subject=payload.subject,
        batch_name=payload.batch_name,
        status=_batch_status_from(external.get("status"), InviteBatchStatus.PENDING),
        total_count=external.get("total_count", len(rows)),
        sent_count=external.get("sent_count", 0),
        failed_count=external.get("failed_count", 0),
        created_by=actor.id,
        last_polled_at=datetime.now(UTC),
        deadline_at=phase.deadline_at,
    )
    db.add(batch)
    db.flush()

    for invite in invites:
        invite.batch_id = batch.id
    db.add_all(invites)

    _link_external_candidates(invites)

    if payload.advance_stage:
        for application in applications:
            # The invite has already gone out through InterviewerAI by this
            # point — irreversible. A stage that will not move (already past
            # APPLIED, or the application is no longer ACTIVE) must not raise
            # and roll back the batch and invite rows just recorded.
            if application.stage != ApplicationStage.APPLIED:
                continue
            try:
                application_service.advance_stage(
                    db,
                    application.id,
                    to_stage=ApplicationStage.INTERVIEW_SCHEDULED,
                    actor=actor,
                    reason=f"AI interview invite sent ({payload.batch_name or payload.subject})",
                )
            except ConflictError:
                continue

    audit_service.record(
        db,
        actor=actor,
        action="interview_invite.bulk_send",
        entity_type="bootcamp",
        entity_id=bootcamp_id,
        summary=f"Sent {len(rows)} AI interview invite(s) — {payload.subject}",
        metadata={
            "batch_id": str(batch.id),
            "external_batch_id": batch.external_batch_id,
            "count": len(rows),
        },
    )
    db.flush()
    return batch


def refresh_batch(db: Session, batch_id: uuid.UUID, actor: Profile) -> InterviewInviteBatch:
    """Poll InterviewerAI for this batch's current send status.

    Updates the batch's own counts and status, and marks any row named in
    the response's `failures` list. A row not mentioned there and not already
    FAILED is assumed sent — the API reports failures, not successes, so
    "not failed" is the only signal available for the rest.
    """
    batch = db.get(InterviewInviteBatch, batch_id, options=[selectinload(InterviewInviteBatch.invites)])
    if batch is None:
        raise NotFoundError("Invite batch not found.")
    bootcamp_service.assert_can_manage(db, actor, batch.bootcamp_id)

    if batch.external_batch_id is None:
        return batch

    external = interviewer_ai.get_batch(batch.external_batch_id)

    batch.status = _batch_status_from(external.get("status"), batch.status)
    batch.total_count = external.get("total_count", batch.total_count)
    batch.sent_count = external.get("sent_count", batch.sent_count)
    batch.failed_count = external.get("failed_count", batch.failed_count)
    batch.last_polled_at = datetime.now(UTC)

    failures = {f["row"]: f.get("error", "Send failed.") for f in external.get("failures", [])}
    for invite in batch.invites:
        if invite.row_index in failures:
            invite.status = InviteStatus.FAILED
            invite.error = failures[invite.row_index]
        elif batch.status == InviteBatchStatus.COMPLETED and invite.status == InviteStatus.PENDING:
            invite.status = InviteStatus.SENT

    db.flush()
    return batch


def list_for_bootcamp(
    db: Session, bootcamp_id: uuid.UUID, actor: Profile
) -> list[InterviewInviteBatch]:
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
    return list(
        db.scalars(
            select(InterviewInviteBatch)
            .where(InterviewInviteBatch.bootcamp_id == bootcamp_id)
            .order_by(InterviewInviteBatch.created_at.desc())
        )
    )


def get_detail(db: Session, batch_id: uuid.UUID, actor: Profile) -> InterviewInviteBatch:
    batch = db.get(
        InterviewInviteBatch, batch_id, options=[selectinload(InterviewInviteBatch.invites)]
    )
    if batch is None:
        raise NotFoundError("Invite batch not found.")
    bootcamp_service.assert_can_manage(db, actor, batch.bootcamp_id)
    return batch
