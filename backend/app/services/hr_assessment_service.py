"""The HR Assessment roll-up.

Everyone who has reached onboarding, with their AI screening result and their
paperwork progress on the same row. Neither half is new data — the screening
result is what /admin/ai-interviews already shows and the paperwork figures
are what /admin/onboarding already shows — but nothing until now put the two
next to each other, which is the whole point of the screen: an HR reviewer
deciding about a candidate wants the interview and the forms in one view, not
two tabs and a mental join.

Both halves are therefore composed from the services that already own them
(`ai_interview_service.best_interviews_by_application`,
`onboarding_document_service.summary_for`) rather than reimplemented here. A
second definition of "best score" or "how many forms are in" would eventually
disagree with the first, and the screens would contradict each other.

Cost is one DB query for the population, one external call for the screening
results, and the per-row form/document lookups `summary_for` already does for
the onboarding list — the same shape that list has today, not a new burden.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import NotFoundError
from app.models.application import Application
from app.models.bootcamp import Bootcamp, Program
from app.models.enums import UserRole
from app.models.physical_interview import PhysicalInterviewBatch, PhysicalInterviewInvite
from app.models.user import Profile
from app.schemas.hr_assessment import (
    HrAssessmentAwaitingRow,
    HrAssessmentPage,
    HrAssessmentRow,
    HrAssessmentStats,
)
from app.services import (
    ai_interview_service,
    bootcamp_service,
    onboarding_document_service,
    physical_interview_service,
)

# Matches _COMPLETED_FETCH_LIMIT's reasoning in ai_interview_service: the
# screening results this joins against are themselves capped, so listing more
# candidates than that would produce rows whose score column is empty for no
# reason the reader could see. Revisit both together.
_MAX_ROWS = 200


def _score_of(interview: dict | None) -> float | None:
    return ai_interview_service.extract_score(interview) if interview else None


def list_rows(
    db: Session, actor: Profile, bootcamp_id: uuid.UUID | None = None
) -> HrAssessmentPage:
    """Every onboarding candidate this actor may see, with their screening result.

    Scoping is the same contract as `ai_interview_service.list_completed`: an
    ADMIN must name an intake and is checked against it; a SUPER_ADMIN may
    omit one for the platform-wide view. Anyone else omitting it is refused
    rather than quietly shown everything.
    """
    if bootcamp_id is not None:
        bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
    elif actor.role != UserRole.SUPER_ADMIN:
        raise NotFoundError("Select an intake to see its HR assessment.")

    query = (
        select(Application, Profile, Bootcamp.name, Program.title)
        .join(Profile, Profile.id == Application.profile_id)
        .outerjoin(Bootcamp, Bootcamp.id == Application.bootcamp_id)
        .outerjoin(Program, Program.id == Application.program_id)
        .where(Application.stage.in_(onboarding_document_service.ONBOARDING_LIST_STAGES))
        .order_by(Application.candidate_code)
        .limit(_MAX_ROWS)
    )
    if bootcamp_id is not None:
        query = query.where(Application.bootcamp_id == bootcamp_id)

    records = db.execute(query).all()
    awaiting_records = _awaiting_records(db, bootcamp_id)

    if not records and not awaiting_records:
        return HrAssessmentPage(items=[], awaiting=[], stats=_stats([], []))

    # One external call for the whole page — both sections — not one per row.
    interviews = ai_interview_service.best_interviews_by_application(db, actor, bootcamp_id)

    items = []
    for application, profile, bootcamp_name, program_title in records:
        progress = onboarding_document_service.summary_for(db, application, profile)
        interview = interviews.get(application.id)
        items.append(
            HrAssessmentRow(
                application_id=application.id,
                candidate_code=application.candidate_code,
                full_name=profile.full_name,
                email=profile.email,
                bootcamp_id=application.bootcamp_id,
                bootcamp_name=bootcamp_name,
                program_title=program_title,
                stage=application.stage,
                status=application.status,
                ai_score=_score_of(interview),
                interview=interview,
                forms_submitted=progress.forms_submitted,
                forms_total=progress.forms_total,
                documents_required=progress.documents_required,
                documents_slots_filled=progress.documents_slots_filled,
                documents_uploaded=progress.documents_uploaded,
                documents_approved=progress.documents_approved,
                documents_rejected=progress.documents_rejected,
                documents_pending=progress.documents_pending,
                hub_unlocked=progress.hub_unlocked,
            )
        )

    awaiting = [
        HrAssessmentAwaitingRow(
            invite_id=invite.id,
            application_id=application.id,
            candidate_code=application.candidate_code,
            full_name=profile.full_name,
            email=profile.email,
            bootcamp_id=application.bootcamp_id,
            bootcamp_name=bootcamp_name,
            program_title=program_title,
            venue=invite.batch.venue,
            interview_date=invite.batch.interview_date,
            start_time=invite.batch.start_time,
            deadline_at=invite.batch.deadline_at,
            sent_at=invite.sent_at,
            send_failed=invite.send_failed,
            status=physical_interview_service.row_status(invite),
            ai_score=_score_of(interviews.get(application.id)),
            interview=interviews.get(application.id),
        )
        for invite, application, profile, bootcamp_name, program_title in awaiting_records
    ]

    return HrAssessmentPage(items=items, awaiting=awaiting, stats=_stats(items, awaiting))


def _awaiting_records(db: Session, bootcamp_id: uuid.UUID | None) -> list:
    """Open Physical Interview invites — invited, no result recorded yet.

    `result IS NULL` is the whole definition: `record_result` writes it in the
    same flush as the stage move, so an undecided invite and a candidate who
    has not moved on are the same fact, asked once. A lapsed deadline does not
    drop a row — the reviewer still has to decide, and `row_status` labels it
    "missed" so they can see which ones did not turn up.

    Ordered by deadline so the round that closes first is at the top.
    """
    query = (
        select(PhysicalInterviewInvite, Application, Profile, Bootcamp.name, Program.title)
        .join(PhysicalInterviewBatch, PhysicalInterviewBatch.id == PhysicalInterviewInvite.batch_id)
        .join(Application, Application.id == PhysicalInterviewInvite.application_id)
        .join(Profile, Profile.id == Application.profile_id)
        .outerjoin(Bootcamp, Bootcamp.id == Application.bootcamp_id)
        .outerjoin(Program, Program.id == Application.program_id)
        .where(PhysicalInterviewInvite.result.is_(None))
        .options(selectinload(PhysicalInterviewInvite.batch))
        .order_by(PhysicalInterviewBatch.deadline_at, Application.candidate_code)
        .limit(_MAX_ROWS)
    )
    if bootcamp_id is not None:
        query = query.where(PhysicalInterviewBatch.bootcamp_id == bootcamp_id)
    return db.execute(query).all()


def _stats(
    items: list[HrAssessmentRow], awaiting: list[HrAssessmentAwaitingRow]
) -> HrAssessmentStats:
    # Averaged across both sections: an HR reviewer reads it as "the calibre of
    # this intake at this point", and excluding the people still to be decided
    # would make the figure jump every time somebody was selected.
    scored = [row.ai_score for row in items if row.ai_score is not None]
    scored += [row.ai_score for row in awaiting if row.ai_score is not None]
    return HrAssessmentStats(
        total=len(items),
        forms_complete=sum(1 for row in items if row.forms_submitted >= row.forms_total),
        documents_pending=sum(row.documents_pending for row in items),
        # Rounded because it is a headline figure, not an input to anything.
        average_ai_score=round(sum(scored) / len(scored), 1) if scored else None,
        awaiting_decision=len(awaiting),
    )
