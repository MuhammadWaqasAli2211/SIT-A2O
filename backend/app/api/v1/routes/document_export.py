"""Bulk export of candidate onboarding records to an HOD.

Two routes: who can be exported, and a request to send. The send answers
immediately and does the real work — fetching every document, rendering the
forms, building and uploading a multi-hundred-MB archive, emailing the link —
on a background task, because none of that belongs inside a request the admin
is waiting on.
"""

import uuid

from fastapi import APIRouter, BackgroundTasks

from app.api.deps import AdminUser, DbSession
from app.schemas.document_export import (
    DocumentExportEligibleList,
    DocumentExportQueued,
    DocumentExportRequest,
)
from app.services import document_export_service

router = APIRouter(tags=["document-export"])


@router.get(
    "/bootcamps/{bootcamp_id}/document-export/eligible",
    response_model=DocumentExportEligibleList,
)
def eligible(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> DocumentExportEligibleList:
    """Candidates whose paperwork is finished, with their last export time.

    Eligibility is every required document approved and all four forms in —
    stricter than "reached onboarding", because an HOD should not receive a
    folder an admin has not finished reviewing. Read-only.
    """
    return document_export_service.eligible(db, user, bootcamp_id)


@router.post(
    "/bootcamps/{bootcamp_id}/document-export",
    response_model=DocumentExportQueued,
    status_code=202,
)
def send(
    bootcamp_id: uuid.UUID,
    payload: DocumentExportRequest,
    user: AdminUser,
    db: DbSession,
    background: BackgroundTasks,
) -> DocumentExportQueued:
    """Queue an export and answer at once.

    202, not 200: the archive does not exist yet when this returns. What has
    happened by then is validation — the intake is the admin's, the selection
    is real, and every candidate named is genuinely ready — so a mistake is
    reported while the modal is still open rather than disappearing into a
    background failure.
    """
    queued = document_export_service.queue_export(
        db,
        user,
        bootcamp_id,
        application_ids=payload.application_ids,
        recipient_email=payload.recipient_email,
        sender_name=payload.sender_name,
    )

    # Queued after the validation above has committed its audit row, so the
    # task cannot start against a transaction that later rolls back.
    background.add_task(
        document_export_service.run_export,
        bootcamp_id=bootcamp_id,
        application_ids=payload.application_ids,
        recipient_email=payload.recipient_email,
        sender_name=payload.sender_name,
        actor_id=user.id,
    )
    return queued
