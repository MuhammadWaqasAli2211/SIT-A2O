"""A candidate's own notifications. Nothing here is admin-facing — there is
no notification source for staff yet, see docs/project-status.md."""

import uuid

from fastapi import APIRouter

from app.api.deps import CandidateUser, DbSession
from app.schemas.notification import NotificationOut, NotificationPage
from app.services import notification_service

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=NotificationPage)
def list_notifications(user: CandidateUser, db: DbSession) -> NotificationPage:
    items, unread_count = notification_service.list_for_profile(db, user.id)
    return NotificationPage(
        items=[NotificationOut.model_validate(n) for n in items],
        unread_count=unread_count,
    )


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: uuid.UUID, user: CandidateUser, db: DbSession
) -> NotificationOut:
    notification = notification_service.mark_read(db, notification_id, user)
    return NotificationOut.model_validate(notification)


@router.post("/notifications/read-all", status_code=204)
def mark_all_notifications_read(user: CandidateUser, db: DbSession) -> None:
    notification_service.mark_all_read(db, user)
