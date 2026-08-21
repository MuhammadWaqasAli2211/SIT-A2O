"""Interview scheduling.

Two path shapes on one router: bootcamp-scoped for listing and batch creation,
id-scoped for acting on a single interview. Scope is enforced in the service
either way, from the interview's own application.
"""

import uuid

from fastapi import APIRouter, Body, Query, status

from app.api.deps import AdminUser, CandidateUser, DbSession
from app.models.enums import InterviewStatus
from app.schemas.interview import (
    BulkScheduleRequest,
    InterviewCreate,
    InterviewOut,
    InterviewRow,
    InterviewUpdate,
)
from app.schemas.ops import Page
from app.services import application_service, bootcamp_service, interview_service

router = APIRouter(tags=["interviews"])


@router.get("/bootcamps/{bootcamp_id}/interviews", response_model=Page[InterviewRow])
def list_interviews(
    bootcamp_id: uuid.UUID,
    user: AdminUser,
    db: DbSession,
    status_filter: InterviewStatus | None = Query(default=None, alias="status"),
    batch_label: str | None = Query(default=None, max_length=60),
    upcoming_only: bool = False,
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[InterviewRow]:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    items, total = interview_service.list_for_bootcamp(
        db,
        bootcamp_id,
        status=status_filter,
        batch_label=batch_label,
        upcoming_only=upcoming_only,
        search=search,
        limit=limit,
        offset=offset,
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/bootcamps/{bootcamp_id}/interviews/batch",
    response_model=list[InterviewOut],
    status_code=status.HTTP_201_CREATED,
)
def bulk_schedule(
    bootcamp_id: uuid.UUID, payload: BulkScheduleRequest, user: AdminUser, db: DbSession
) -> list[InterviewOut]:
    """Schedule a whole batch. All-or-nothing: one bad slot rolls back the lot."""
    created = interview_service.bulk_schedule(db, bootcamp_id, payload, user)
    return [InterviewOut.model_validate(i) for i in created]


@router.post("/interviews", response_model=InterviewOut, status_code=status.HTTP_201_CREATED)
def schedule_interview(
    payload: InterviewCreate, user: AdminUser, db: DbSession
) -> InterviewOut:
    return InterviewOut.model_validate(interview_service.schedule(db, payload, user))


@router.patch("/interviews/{interview_id}", response_model=InterviewOut)
def update_interview(
    interview_id: uuid.UUID, payload: InterviewUpdate, user: AdminUser, db: DbSession
) -> InterviewOut:
    return InterviewOut.model_validate(interview_service.update(db, interview_id, payload, user))


@router.post("/interviews/{interview_id}/cancel", response_model=InterviewOut)
def cancel_interview(
    interview_id: uuid.UUID,
    user: AdminUser,
    db: DbSession,
    reason: str | None = Body(default=None, embed=True, max_length=500),
) -> InterviewOut:
    return InterviewOut.model_validate(interview_service.cancel(db, interview_id, user, reason))


@router.delete("/interviews/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview(interview_id: uuid.UUID, user: AdminUser, db: DbSession) -> None:
    interview_service.delete(db, interview_id, user)


@router.get("/applications/{application_id}/interviews", response_model=list[InterviewRow])
def interviews_for_application(
    application_id: uuid.UUID, user: AdminUser, db: DbSession
) -> list[InterviewRow]:
    application = application_service.get_detail(db, application_id)
    bootcamp_service.assert_can_manage(db, user, application.bootcamp_id)
    return interview_service.list_for_application(db, application_id)


@router.get("/me/interviews", response_model=list[InterviewRow], tags=["candidate"])
def my_interviews(user: CandidateUser, db: DbSession) -> list[InterviewRow]:
    """A candidate's own schedule across every application they hold."""
    rows: list[InterviewRow] = []
    for application in application_service.my_applications(db, user):
        rows.extend(interview_service.list_for_application(db, application.id))
    return sorted(rows, key=lambda r: r.scheduled_at, reverse=True)
