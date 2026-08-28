"""AI interview invite (InterviewerAI) schemas."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import InviteBatchStatus, InviteStatus
from app.schemas.application import CNIC_PATTERN

# The categories InterviewerAI accepts in a bulk send. "Resume-Based
# Interview" is a real category on their side but refused in bulk — it builds
# an interview from a CV, which does not fit in a spreadsheet row — so it is
# deliberately absent here rather than merely undocumented.
InviteCategory = Literal[
    "AI",
    "Cloud & Data Engineering",
    "Web and Mobile App Development",
    "Graphics and UI/UX Design",
    "Instructor",
]


class ManualInviteRow(BaseModel):
    """One recipient added by hand or from an uploaded file, rather than
    picked from our own applicant data — the only way to invite someone with
    no application, such as an Instructor."""

    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    cnic: str = Field(pattern=CNIC_PATTERN)
    category: InviteCategory
    # No client input here: "completed" is the only value InterviewerAI
    # currently accepts, and Instructor rows need none at all. The service
    # layer derives it from `category` — see interview_invite_service.py.


class BulkInviteRequest(BaseModel):
    """A send covering both sources at once: applicants already in our
    system, plus any manually supplied rows, in the one API call this
    becomes."""

    subject: str = Field(min_length=3, max_length=200)
    batch_name: str | None = Field(default=None, max_length=100)
    personalize: bool = True

    application_ids: list[uuid.UUID] = Field(default_factory=list)
    manual_rows: list[ManualInviteRow] = Field(default_factory=list)
    advance_stage: bool = Field(
        default=True,
        description="Also move each invited application to INTERVIEW_SCHEDULED.",
    )


class InviteRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID | None
    full_name: str
    email: str
    cnic: str
    category: str
    course_status: str | None
    status: InviteStatus
    error: str | None


class InviteBatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bootcamp_id: uuid.UUID
    subject: str
    batch_name: str | None
    status: InviteBatchStatus
    total_count: int
    sent_count: int
    failed_count: int
    created_at: datetime
    last_polled_at: datetime | None


class InviteBatchDetail(InviteBatchOut):
    invites: list[InviteRowOut] = Field(default_factory=list)
