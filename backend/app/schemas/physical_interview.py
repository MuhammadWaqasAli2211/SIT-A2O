"""Physical Interview: bulk invites and per-candidate results."""

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PhysicalInterviewResult


class PhysicalInterviewInviteRequest(BaseModel):
    """One venue/date/time, sent to a chosen set of PHYSICAL_INTERVIEW-stage
    applications in a single batch. Nothing here is pre-set or per-candidate —
    every field is filled in by the admin at the time of sending."""

    venue: str = Field(min_length=2, max_length=200)
    interview_date: date
    start_time: time | None = None

    # Required, not defaulted, same reasoning as the AI-interview invite's
    # deadline: with no expiry this is a promise that never closes, and there
    # is no governing phase to fall back on for this stage.
    deadline_at: datetime

    subject: str = Field(min_length=3, max_length=200)
    # Required, unlike the AI-invite's optional covering email: InterviewerAI
    # sends its own mandatory credentials mail regardless, so that one is a
    # supplement. There is no equivalent second channel here — this message
    # is the only way a candidate learns the venue, date and time at all.
    # $venue / $interview_date / $interview_day / $interview_time / $deadline
    # merge fields, substituted once per batch, plus the usual per-candidate
    # fields email_service.render() fills in.
    message: str = Field(min_length=1, max_length=20_000)

    application_ids: list[uuid.UUID] = Field(min_length=1, max_length=500)


class RecordResultRequest(BaseModel):
    result: PhysicalInterviewResult
    # Admin's own record only, never shown to the candidate.
    #
    # Optional *here* because it is only required on a rejection, which this
    # model cannot express on its own — `physical_interview_service.
    # record_result` enforces that pairing, and a CHECK constraint enforces
    # it again in the database.
    #
    # The comment this replaces claimed the old CHECK required a note on a
    # rejection. It did not: it only stopped a note existing on a row that was
    # *not* rejected, so a reason-less rejection was accepted by everything
    # except the dialog. Verified against the live constraint, 2026-09-15.
    rejection_note: str | None = Field(default=None, max_length=1000)


class PhysicalInterviewInviteRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    candidate_code: str
    candidate_name: str | None = None

    sent_at: datetime | None
    send_failed: bool

    result: PhysicalInterviewResult | None
    rejection_note: str | None
    decided_at: datetime | None

    # Derived, not stored — see PhysicalInterviewBatch.is_expired. "missed"
    # only when no result was recorded and the batch's deadline has passed.
    status: Literal["pending", "selected", "rejected", "missed"]


class PhysicalInterviewBatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bootcamp_id: uuid.UUID
    venue: str
    interview_date: date
    start_time: time | None
    deadline_at: datetime
    subject: str
    message: str | None
    created_at: datetime
    invite_count: int = 0


class PhysicalInterviewBatchDetail(PhysicalInterviewBatchOut):
    invites: list[PhysicalInterviewInviteRow] = Field(default_factory=list)


class PhysicalInterviewFunnel(BaseModel):
    """Current pipeline state for this stage, one row per candidate ever
    invited — the latest invite if a candidate was invited more than once
    (e.g. re-invited after missing an earlier batch's window)."""

    invited: int = 0
    selected: int = 0
    rejected: int = 0
    pending: int = 0
    missed: int = 0

    @property
    def decided(self) -> int:
        return self.selected + self.rejected


class PhysicalInterviewAnnounceRow(BaseModel):
    """One decided candidate, in either the pending or announced list."""

    model_config = ConfigDict(from_attributes=True)

    invite_id: uuid.UUID
    application_id: uuid.UUID
    candidate_code: str
    full_name: str | None = None
    result: PhysicalInterviewResult
    decided_at: datetime
    announced_at: datetime | None = None


class PhysicalInterviewAnnounceLists(BaseModel):
    """The two tabs: decided-but-not-yet-emailed, and already emailed."""

    pending: list[PhysicalInterviewAnnounceRow] = Field(default_factory=list)
    announced: list[PhysicalInterviewAnnounceRow] = Field(default_factory=list)


class PhysicalInterviewAnnounceSummary(BaseModel):
    """The counts an admin confirms against before announcing."""

    pending_selected: int = 0
    pending_rejected: int = 0

    @property
    def total_pending(self) -> int:
        return self.pending_selected + self.pending_rejected


class PhysicalInterviewAnnounceResult(BaseModel):
    """What actually happened when the bulk announce fired."""

    emailed: int
    selected: int
    rejected: int


class CandidatePhysicalInterviewStatus(BaseModel):
    """What a candidate is allowed to know about their Physical Interview —
    the same security-boundary reasoning as ai_interview.CandidateScore:
    no internal rejection note, no other candidate's data, nothing beyond
    what they were told by email."""

    status: Literal["not_invited", "invited", "selected", "rejected", "missed"]

    venue: str | None = None
    interview_date: date | None = None
    start_time: time | None = None
    deadline_at: datetime | None = None
