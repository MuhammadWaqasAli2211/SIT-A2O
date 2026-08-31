"""Candidate notifications.

Created only from application_service.advance_stage — every stage move a
candidate can be told about already funnels through that one function, so
that is the single place a notification gets written, not scattered across
every caller.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.enums import ApplicationStage
from app.models.notification import Notification
from app.models.user import Profile

# Not lib/stages.ts's STAGE_LABEL — this is a one-line notification body, not
# the candidate portal's stepper, so it does not need to track that file.
_STAGE_LABEL: dict[ApplicationStage, str] = {
    ApplicationStage.APPLIED: "Application",
    ApplicationStage.INTERVIEW_SCHEDULED: "Interview scheduling",
    ApplicationStage.AI_INTERVIEWED: "AI interview",
    ApplicationStage.PHYSICAL_INTERVIEW: "Physical interview",
    ApplicationStage.FORM: "Onboarding form",
    ApplicationStage.ONBOARDED: "Onboarding",
}


def notify_stage_outcome(
    db: Session,
    *,
    profile_id: uuid.UUID,
    application_id: uuid.UUID,
    candidate_code: str,
    from_stage: ApplicationStage,
    to_stage: ApplicationStage,
) -> None:
    """Passing a stage means moving forward to any other stage; REJECTED is
    the only failure outcome. Called after the transition is already
    committed to `application.stage`, so this never disagrees with it."""
    if to_stage == ApplicationStage.REJECTED:
        title = "Application update"
        stage_name = _STAGE_LABEL.get(from_stage, from_stage.value.title())
        body = f"Your application ({candidate_code}) was not selected at the {stage_name} stage."
    else:
        title = "You passed a stage!"
        stage_name = _STAGE_LABEL.get(from_stage, from_stage.value.title())
        body = f"Congratulations — your application ({candidate_code}) has cleared the {stage_name} stage."

    db.add(
        Notification(
            profile_id=profile_id,
            application_id=application_id,
            title=title,
            body=body,
        )
    )
    db.flush()


def list_for_profile(db: Session, profile_id: uuid.UUID) -> tuple[list[Notification], int]:
    items = list(
        db.scalars(
            select(Notification)
            .where(Notification.profile_id == profile_id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
    )
    unread_count = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.profile_id == profile_id, Notification.read_at.is_(None))
    )
    return items, unread_count or 0


def _get_own(db: Session, notification_id: uuid.UUID, profile: Profile) -> Notification:
    notification = db.get(Notification, notification_id)
    # Same shape either way: a notification that does not exist and one that
    # belongs to someone else are indistinguishable to the caller, on purpose.
    if notification is None or notification.profile_id != profile.id:
        raise NotFoundError("Notification not found.")
    return notification


def mark_read(db: Session, notification_id: uuid.UUID, profile: Profile) -> Notification:
    notification = _get_own(db, notification_id, profile)
    if notification.read_at is None:
        notification.read_at = func.now()
        db.flush()
    return notification


def mark_all_read(db: Session, profile: Profile) -> None:
    db.query(Notification).filter(
        Notification.profile_id == profile.id, Notification.read_at.is_(None)
    ).update({"read_at": func.now()})
    db.flush()
