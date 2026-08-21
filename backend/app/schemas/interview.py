"""Interview scheduling schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.enums import InterviewMode, InterviewStatus


class InterviewCreate(BaseModel):
    application_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=5, le=480)
    mode: InterviewMode = InterviewMode.ONSITE
    location: str | None = Field(default=None, max_length=500)
    interviewer_id: uuid.UUID | None = None
    batch_label: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=2000)


class InterviewUpdate(BaseModel):
    """Every field optional; only what is sent is changed.

    `model_dump(exclude_unset=True)` at the service boundary is what makes that
    true — without it an omitted field would be read as an explicit null.
    """

    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=480)
    mode: InterviewMode | None = None
    location: str | None = Field(default=None, max_length=500)
    interviewer_id: uuid.UUID | None = None
    status: InterviewStatus | None = None
    score: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=2000)
    batch_label: str | None = Field(default=None, max_length=60)

    @model_validator(mode="after")
    def _score_needs_completion(self) -> "InterviewUpdate":
        """Mirror the database CHECK, so the caller gets 422 rather than a 500.

        Only enforced when both fields are present in the same request; the
        service re-checks against the stored row for the partial cases.
        """
        if self.score is not None and self.status is not None:
            if self.status != InterviewStatus.COMPLETED:
                raise ValueError("A score can only be recorded on a COMPLETED interview.")
        return self


class BulkScheduleSlot(BaseModel):
    application_id: uuid.UUID
    scheduled_at: datetime


class BulkScheduleRequest(BaseModel):
    """Schedule a whole batch in one call — the 50/50/25 interview split."""

    slots: list[BulkScheduleSlot] = Field(min_length=1, max_length=200)
    duration_minutes: int = Field(default=30, ge=5, le=480)
    mode: InterviewMode = InterviewMode.ONSITE
    location: str | None = Field(default=None, max_length=500)
    interviewer_id: uuid.UUID | None = None
    batch_label: str | None = Field(default=None, max_length=60)
    advance_stage: bool = Field(
        default=True,
        description="Also move each candidate to INTERVIEW_SCHEDULED.",
    )


class InterviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int
    mode: InterviewMode
    location: str | None = None
    interviewer_id: uuid.UUID | None = None
    status: InterviewStatus
    score: int | None = None
    notes: str | None = None
    batch_label: str | None = None
    created_at: datetime


class InterviewRow(InterviewOut):
    """List row: flattened candidate and interviewer names for the admin table."""

    candidate_code: str
    candidate_name: str | None = None
    candidate_email: EmailStr
    program_title: str
    interviewer_name: str | None = None
