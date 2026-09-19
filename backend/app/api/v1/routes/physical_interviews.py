"""Physical Interview: bulk invites (venue/date/time) and per-candidate
results, scoped by bootcamp like interviews.py and interview_invites.py."""

import uuid

from fastapi import APIRouter, status

from app.api.deps import AdminUser, CandidateUser, DbSession
from app.models.physical_interview import PhysicalInterviewBatch, PhysicalInterviewInvite
from app.schemas.physical_interview import (
    CandidatePhysicalInterviewStatus,
    PhysicalInterviewAnnounceLists,
    PhysicalInterviewAnnounceResult,
    PhysicalInterviewAnnounceSummary,
    PhysicalInterviewBatchDetail,
    PhysicalInterviewBatchOut,
    PhysicalInterviewInviteRequest,
    PhysicalInterviewInviteRow,
    RecordResultRequest,
)
from app.services import physical_interview_service
from app.services.physical_interview_service import row_status

router = APIRouter(tags=["physical-interviews"])


def _to_batch_out(batch: PhysicalInterviewBatch) -> PhysicalInterviewBatchOut:
    out = PhysicalInterviewBatchOut.model_validate(batch)
    out.invite_count = len(batch.invites)
    return out


def _to_invite_row(invite: PhysicalInterviewInvite) -> PhysicalInterviewInviteRow:
    return PhysicalInterviewInviteRow(
        id=invite.id,
        application_id=invite.application_id,
        candidate_code=invite.application.candidate_code,
        candidate_name=invite.application.profile.full_name,
        sent_at=invite.sent_at,
        send_failed=invite.send_failed,
        result=invite.result,
        rejection_note=invite.rejection_note,
        decided_at=invite.decided_at,
        status=row_status(invite),  # type: ignore[arg-type]
    )


def _to_batch_detail(batch: PhysicalInterviewBatch) -> PhysicalInterviewBatchDetail:
    return PhysicalInterviewBatchDetail(
        **_to_batch_out(batch).model_dump(),
        invites=[_to_invite_row(invite) for invite in batch.invites],
    )


# ------------------------------------------------------------- candidate --


@router.get("/me/physical-interview", response_model=CandidatePhysicalInterviewStatus)
def my_physical_interview(user: CandidateUser, db: DbSession) -> CandidatePhysicalInterviewStatus:
    """The candidate's own latest invite — venue, date, time, and the
    outcome once one is recorded. Nothing else: no rejection_note, no other
    candidate's data."""
    return physical_interview_service.my_status(db, user)


# ----------------------------------------------------------------- admin --


@router.post(
    "/bootcamps/{bootcamp_id}/physical-interviews",
    response_model=PhysicalInterviewBatchDetail,
    status_code=status.HTTP_201_CREATED,
)
def send_physical_interview_invite(
    bootcamp_id: uuid.UUID, payload: PhysicalInterviewInviteRequest, user: AdminUser, db: DbSession
) -> PhysicalInterviewBatchDetail:
    batch = physical_interview_service.send_bulk(db, bootcamp_id, payload, user)
    return _to_batch_detail(batch)


@router.get(
    "/bootcamps/{bootcamp_id}/physical-interviews", response_model=list[PhysicalInterviewBatchOut]
)
def list_physical_interview_batches(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> list[PhysicalInterviewBatchOut]:
    return [
        _to_batch_out(b)
        for b in physical_interview_service.list_for_bootcamp(db, bootcamp_id, user)
    ]


@router.get("/physical-interviews/{batch_id}", response_model=PhysicalInterviewBatchDetail)
def get_physical_interview_batch(
    batch_id: uuid.UUID, user: AdminUser, db: DbSession
) -> PhysicalInterviewBatchDetail:
    return _to_batch_detail(physical_interview_service.get_detail(db, batch_id, user))


@router.post(
    "/physical-interviews/invites/{invite_id}/result",
    response_model=PhysicalInterviewBatchDetail,
)
def record_physical_interview_result(
    invite_id: uuid.UUID, payload: RecordResultRequest, user: AdminUser, db: DbSession
) -> PhysicalInterviewBatchDetail:
    invite = physical_interview_service.record_result(db, invite_id, payload, user)
    return _to_batch_detail(physical_interview_service.get_detail(db, invite.batch_id, user))


@router.get(
    "/bootcamps/{bootcamp_id}/physical-interview/announce",
    response_model=PhysicalInterviewAnnounceSummary,
)
def physical_interview_announce_summary(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> PhysicalInterviewAnnounceSummary:
    return physical_interview_service.announce_summary(db, bootcamp_id, user)


@router.get(
    "/bootcamps/{bootcamp_id}/physical-interview/announce/candidates",
    response_model=PhysicalInterviewAnnounceLists,
)
def physical_interview_announce_lists(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> PhysicalInterviewAnnounceLists:
    return physical_interview_service.announce_lists(db, bootcamp_id, user)


@router.post(
    "/bootcamps/{bootcamp_id}/physical-interview/announce",
    response_model=PhysicalInterviewAnnounceResult,
)
def announce_physical_interview_results(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> PhysicalInterviewAnnounceResult:
    return physical_interview_service.announce_results(db, bootcamp_id, user)
