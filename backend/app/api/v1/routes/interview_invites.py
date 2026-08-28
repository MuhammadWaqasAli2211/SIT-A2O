"""Bulk AI interview invites (InterviewerAI), scoped by bootcamp like
interviews.py, id-scoped for acting on one batch."""

import uuid

from fastapi import APIRouter, status

from app.api.deps import AdminUser, DbSession
from app.schemas.interview_invite import BulkInviteRequest, InviteBatchDetail, InviteBatchOut
from app.services import interview_invite_service

router = APIRouter(tags=["interview-invites"])


@router.post(
    "/bootcamps/{bootcamp_id}/interview-invites/bulk",
    response_model=InviteBatchDetail,
    status_code=status.HTTP_201_CREATED,
)
def send_bulk_invite(
    bootcamp_id: uuid.UUID, payload: BulkInviteRequest, user: AdminUser, db: DbSession
) -> InviteBatchDetail:
    batch = interview_invite_service.send_bulk(db, bootcamp_id, payload, user)
    return InviteBatchDetail.model_validate(batch)


@router.get(
    "/bootcamps/{bootcamp_id}/interview-invites", response_model=list[InviteBatchOut]
)
def list_invite_batches(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> list[InviteBatchOut]:
    return [
        InviteBatchOut.model_validate(b)
        for b in interview_invite_service.list_for_bootcamp(db, bootcamp_id, user)
    ]


@router.get("/interview-invites/{batch_id}", response_model=InviteBatchDetail)
def get_invite_batch(batch_id: uuid.UUID, user: AdminUser, db: DbSession) -> InviteBatchDetail:
    return InviteBatchDetail.model_validate(
        interview_invite_service.get_detail(db, batch_id, user)
    )


@router.post("/interview-invites/{batch_id}/refresh", response_model=InviteBatchDetail)
def refresh_invite_batch(
    batch_id: uuid.UUID, user: AdminUser, db: DbSession
) -> InviteBatchDetail:
    """Poll InterviewerAI for this batch's current send progress."""
    return InviteBatchDetail.model_validate(
        interview_invite_service.refresh_batch(db, batch_id, user)
    )
