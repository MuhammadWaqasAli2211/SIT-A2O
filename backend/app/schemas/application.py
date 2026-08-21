import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ApplicationStage, ApplicationStatus
from app.schemas.bootcamp import ProgramOut


class ApplicationCreate(BaseModel):
    bootcamp_id: uuid.UUID
    program_id: uuid.UUID
    statement: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional statement of purpose.",
    )


class StageTransitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_stage: ApplicationStage | None = None
    to_stage: ApplicationStage
    reason: str | None = None
    created_at: datetime


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_code: str
    bootcamp_id: uuid.UUID
    program_id: uuid.UUID
    stage: ApplicationStage
    status: ApplicationStatus
    statement: str | None = None
    applied_at: datetime


class ApplicationDetail(ApplicationOut):
    program: ProgramOut
    bootcamp_name: str
    timeline: list[StageTransitionOut] = Field(default_factory=list)


class ApplicantRow(BaseModel):
    """One row of an admin's candidate list.

    Flattened from the joined profile so the admin table does not need a
    nested shape, and carries no contact detail beyond what the list displays.
    """

    id: uuid.UUID
    candidate_code: str
    full_name: str | None = None
    email: EmailStr
    program_title: str
    stage: ApplicationStage
    status: ApplicationStatus
    applied_at: datetime


class ApplicantPage(BaseModel):
    items: list[ApplicantRow]
    total: int
    limit: int
    offset: int


class StageAdvance(BaseModel):
    to_stage: ApplicationStage
    reason: str | None = Field(default=None, max_length=500)


class ApplicationEdit(BaseModel):
    """Admin correction of an application's own fields.

    Stage and status are absent deliberately: they move through
    advance_stage/reinstate so every change leaves a StageTransition behind.
    """

    program_id: uuid.UUID | None = None
    statement: str | None = Field(default=None, max_length=2000)


class AdminApplicationDetail(ApplicationDetail):
    """The full record for an administrator.

    Kept separate from ApplicationDetail rather than adding optional fields to
    it: the candidate-facing route returns that shape, and personal contact
    data must not be one forgotten `exclude` away from leaking into it.
    """

    full_name: str | None = None
    email: EmailStr
    phone: str | None = None
    city: str | None = None
    education: str | None = None
    date_of_birth: date | None = None
    bootcamp_number: int
    interview_count: int = 0
