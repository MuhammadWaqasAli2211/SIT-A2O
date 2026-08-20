import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ApplicationStage, ApplicationStatus
from app.schemas.bootcamp import PhaseOut, ProgramOut


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

    # None until the interview has been decided. The tracker uses it to tell
    # "waiting on a result" apart from "cleared it", which the stage alone
    # cannot express while a candidate is still sitting at INTERVIEWED.
    is_selected: bool | None = None

    statement: str | None = None
    applied_at: datetime


class ApplicationDetail(ApplicationOut):
    program: ProgramOut
    bootcamp_name: str
    timeline: list[StageTransitionOut] = Field(default_factory=list)

    # The applicant's own deadlines. Carried here rather than behind a separate
    # candidate endpoint because the tracker needs them on every render and
    # they cost no extra query — the bootcamp is already loaded.
    #
    # Safe to expose: PhaseOut is windows and an open flag, nothing about other
    # applicants or the intake's internal status.
    phases: list[PhaseOut] = Field(default_factory=list)


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
