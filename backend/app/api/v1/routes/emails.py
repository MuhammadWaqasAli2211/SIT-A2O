"""Outbound email: sending to candidates and reading the send history.

Recipients are always addressed by application id, never by raw address, so a
send cannot escape the caller's bootcamp scope and every message lands in the
log against a candidate.
"""

import uuid

from fastapi import APIRouter, Query

from app.api.deps import AdminUser, DbSession
from app.models.enums import EmailStatus
from app.schemas.ops import (
    EmailBroadcastRequest,
    EmailLogRow,
    EmailSendRequest,
    EmailSendResult,
    Page,
)
from app.services import bootcamp_service, email_service

router = APIRouter(prefix="/bootcamps/{bootcamp_id}/emails", tags=["emails"])


@router.get("", response_model=Page[EmailLogRow])
def list_email_log(
    bootcamp_id: uuid.UUID,
    user: AdminUser,
    db: DbSession,
    status_filter: EmailStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[EmailLogRow]:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    items, total = email_service.list_log(
        db, bootcamp_id, status=status_filter, search=search, limit=limit, offset=offset
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("/send", response_model=EmailSendResult)
def send_to_selection(
    bootcamp_id: uuid.UUID, payload: EmailSendRequest, user: AdminUser, db: DbSession
) -> EmailSendResult:
    """Email a chosen set of candidates.

    Returns a per-recipient summary rather than failing the request: one bad
    address must not discard the other 199 successful sends.
    """
    return email_service.send_to_applications(
        db,
        bootcamp_id,
        application_ids=payload.application_ids,
        subject=payload.subject,
        body_html=payload.body_html,
        template=payload.template,
        actor=user,
    )


@router.post("/broadcast", response_model=EmailSendResult)
def broadcast(
    bootcamp_id: uuid.UUID, payload: EmailBroadcastRequest, user: AdminUser, db: DbSession
) -> EmailSendResult:
    """Email everyone in the intake, optionally narrowed to one stage."""
    return email_service.broadcast(
        db,
        bootcamp_id,
        stage=payload.stage,
        subject=payload.subject,
        body_html=payload.body_html,
        template=payload.template,
        actor=user,
    )
