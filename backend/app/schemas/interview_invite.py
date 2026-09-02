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

# The question-difficulty ranges InterviewerAI accepts, verbatim. Documented
# on their single-candidate invite endpoint only; verified 2026-09-01 that
# their bulk worker honours the same key per row (a probe row sent
# MEDIUM_TO_HARD came back as question_difficulty_range MEDIUM_TO_HARD).
#
# Not our own wording: sending anything outside these three is accepted by
# their untyped body and then silently ignored, which would leave us showing
# an admin a difficulty that was never applied.
InviteDifficulty = Literal["EASY_TO_MEDIUM", "MEDIUM_TO_HARD", "EASY_TO_HARD"]


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

    question_difficulty: InviteDifficulty | None = None

    # Optional, and bounded by the intake's INTERVIEW phase deadline rather
    # than free-floating: an invite that outlived the phase it belongs to
    # would be honoured by our own expiry check while the phase gate refused
    # everything else. Omitted means "use the phase deadline", which is what
    # every batch did before this field existed.
    deadline_at: datetime | None = None

    # Body of the covering email we send ourselves, with $candidate_name-style
    # merge fields. None means no covering email — InterviewerAI's own
    # credentials mail still goes out either way.
    message: str | None = Field(default=None, max_length=20_000)

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
    question_difficulty: str | None = None
    deadline_at: datetime | None = None


class InviteBatchDetail(InviteBatchOut):
    invites: list[InviteRowOut] = Field(default_factory=list)
