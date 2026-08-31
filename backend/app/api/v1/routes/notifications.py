"""A signed-in user's own notifications.

Originally candidate-only ("no notification source for staff yet"). As of
2026-08-30, admins are notified when a candidate in their bootcamp completes
an AI interview — see `_notify_admins_of_completion` in
ai_interview_service.py — so this reads for any role now. Every function
below already scopes to `user.id`, so widening the role gate does not widen
what anyone can see: an admin still only ever reads their own rows."""

import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.notification import NotificationOut, NotificationPage
from app.services import notification_service

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=NotificationPage)
def list_notifications(user: CurrentUser, db: DbSession) -> NotificationPage:
    items, unread_count = notification_service.list_for_profile(db, user.id)
    return NotificationPage(
        items=[NotificationOut.model_validate(n) for n in items],
        unread_count=unread_count,
    )


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> NotificationOut:
    notification = notification_service.mark_read(db, notification_id, user)
    return NotificationOut.model_validate(notification)


@router.post("/notifications/read-all", status_code=204)
def mark_all_notifications_read(user: CurrentUser, db: DbSession) -> None:
    notification_service.mark_all_read(db, user)
