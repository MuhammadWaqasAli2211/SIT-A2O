"""AI Interviewer reads and writes, gated by our own roles and permissions.

Every route resolves one of our users first and only then calls the external
service. The API key never leaves the backend, and no route here accepts an
external identifier from a caller without checking that the caller may see
the record it names.
"""

import uuid

from fastapi import APIRouter, Query, status

from app.api.deps import AdminUser, CandidateUser, CurrentUser, DbSession
from app.schemas.ai_interview import (
    AiAnalytics,
    CandidateScore,
    CompletedInterviewsPage,
    DeadlineExplanation,
    ExternalRecords,
    ReinterviewDecision,
)
from app.services import ai_interview_service

router = APIRouter(tags=["ai-interviews"])


# ------------------------------------------------------------- candidate --


@router.get("/me/ai-interview", response_model=CandidateScore)
def my_ai_interview(user: CandidateUser, db: DbSession) -> CandidateScore:
    """The candidate's own overall score, and nothing else.

    `CandidateScore` has no field capable of carrying question data, proctor
    snapshots, recordings or audit entries — see the schema. This is the only
    route in the file a candidate can reach.
    """
    return CandidateScore.model_validate(ai_interview_service.candidate_score(db, user))


@router.post("/me/ai-interview/explanation", status_code=status.HTTP_204_NO_CONTENT)
def explain_missed_deadline(
    payload: DeadlineExplanation, user: CandidateUser, db: DbSession
) -> None:
    """Write to the intake's administrators about a missed interview deadline.

    Only accepted once the deadline has actually passed, and only once. The
    reason is emailed to the admins and recorded in the audit trail; no agent
    judges it and nothing here changes the application's stage — an admin
    does that, and that move is audited on its own.
    """
    ai_interview_service.submit_deadline_explanation(db, user, payload.reason)


# ----------------------------------------------------------- admin reads --


@router.get("/bootcamps/{bootcamp_id}/ai-interviews", response_model=ExternalRecords)
def list_bootcamp_ai_interviews(
    bootcamp_id: uuid.UUID,
    user: AdminUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ExternalRecords:
    return ExternalRecords(
        items=ai_interview_service.list_for_bootcamp(
            db, bootcamp_id, user, limit=limit, offset=offset
        )
    )


@router.get("/ai-interviews/completed", response_model=CompletedInterviewsPage)
def list_completed_ai_interviews(
    user: AdminUser, db: DbSession, bootcamp_id: uuid.UUID | None = None
) -> CompletedInterviewsPage:
    """Every completed AI interview visible to this admin, plus the summary
    stats. An ADMIN must supply `bootcamp_id`; a SUPER_ADMIN may omit it for
    the platform-wide view — the service raises for anyone else who omits it."""
    return CompletedInterviewsPage.model_validate(
        ai_interview_service.list_completed(db, user, bootcamp_id)
    )


@router.get("/ai-interviews/{interview_id}")
def get_ai_interview(interview_id: int, user: AdminUser, db: DbSession) -> dict:
    return ai_interview_service.get_interview(db, interview_id, user)


@router.get("/ai-interviews/{interview_id}/report")
def get_ai_interview_report(interview_id: int, user: AdminUser, db: DbSession) -> dict:
    """The full report. Admin-only — deliberately not reachable by the
    candidate the report is about."""
    return ai_interview_service.get_report(db, interview_id, user)


@router.get("/ai-interviews/{interview_id}/recording")
def get_ai_interview_recording(interview_id: int, user: AdminUser, db: DbSession) -> dict:
    """Their playback URL for the session video.

    The URL is signed by their service; our API key is not part of the
    response and the browser never sees it.
    """
    return ai_interview_service.get_recording(db, interview_id, user)


@router.get("/ai-interviews/{interview_id}/snapshots", response_model=ExternalRecords)
def list_ai_interview_snapshots(
    interview_id: int, user: AdminUser, db: DbSession
) -> ExternalRecords:
    return ExternalRecords(items=ai_interview_service.list_snapshots(db, interview_id, user))


# ---------------------------------------------------------- admin writes --


@router.delete("/ai-interviews/{interview_id}", status_code=204)
def delete_ai_interview(interview_id: int, user: AdminUser, db: DbSession) -> None:
    """Requires the INTERVIEWS_DELETE grant. Distinct from cancelling one of
    our own scheduled Phase 3 interviews."""
    ai_interview_service.delete_interview(db, interview_id, user)


@router.get("/ai-reinterview-requests", response_model=ExternalRecords)
def list_reinterview_requests(
    user: AdminUser, db: DbSession, bootcamp_id: uuid.UUID | None = None
) -> ExternalRecords:
    return ExternalRecords(
        items=ai_interview_service.list_reinterview_requests(db, user, bootcamp_id)
    )


@router.post("/ai-reinterview-requests/{request_id}/decision")
def decide_reinterview_request(
    request_id: int, payload: ReinterviewDecision, user: AdminUser, db: DbSession
) -> dict:
    """Requires the REINTERVIEW_DECIDE grant. Recorded in our audit trail as
    well as theirs, so the decision is not a side channel."""
    return ai_interview_service.decide_reinterview(
        db, request_id, user, approve=payload.approve, note=payload.note
    )


# ------------------------------------------------------- analytics, audit --


@router.get("/ai-analytics", response_model=AiAnalytics)
def ai_analytics(
    user: AdminUser, db: DbSession, bootcamp_id: uuid.UUID | None = None
) -> AiAnalytics:
    return AiAnalytics.model_validate(ai_interview_service.analytics(db, user, bootcamp_id))


@router.get("/ai-audit-log", response_model=ExternalRecords)
def ai_audit_log(
    user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ExternalRecords:
    """Their audit trail, kept separate from ours.

    Super-admin only — the endpoint is tenant-wide with no bootcamp filter,
    so there is no way to show an admin only their own intake's entries. The
    service raises for anyone else; the dependency is CurrentUser rather than
    AdminUser so that refusal carries the explanation.
    """
    return ExternalRecords(
        items=ai_interview_service.audit_entries(db, user, limit=limit, offset=offset)
    )
