"""HR Assessment — one row per candidate in onboarding, joining what our own
database knows about their paperwork to what the AI Interviewer knows about
their screening.

The `interview` field is a raw `dict` for the same reason every other
admin-facing AI Interviewer payload is (see app/schemas/ai_interview.py):
their response shapes are undocumented, so pinning a model here would
silently drop fields the evidence modal may need. It carries only what the
admin could already read on /admin/ai-interviews — this screen is a
different arrangement of data they can see, not a wider one.
"""

import uuid
from datetime import date, datetime, time
from typing import Any

from pydantic import BaseModel

from app.models.enums import ApplicationStage, ApplicationStatus


class HrAssessmentRow(BaseModel):
    """One candidate, as the HR Assessment table shows them."""

    application_id: uuid.UUID
    candidate_code: str
    full_name: str | None = None
    email: str | None = None

    # Present on every row but only rendered in the platform-wide view, which
    # is the only one that can show more than one intake at a time.
    bootcamp_id: uuid.UUID | None = None
    bootcamp_name: str | None = None
    # The program the candidate applied to — labelled "Track" in the UI.
    program_title: str | None = None

    stage: ApplicationStage
    status: ApplicationStatus

    # None when we have no readable score: never invited, never sat it, or a
    # payload carrying nothing we recognise. The column shows an em dash.
    ai_score: float | None = None
    # The matched external record, or None. Enough for the evidence modal to
    # open without a per-row round trip; the report and the recording behind
    # it are still fetched only once that modal is actually opened.
    interview: dict[str, Any] | None = None

    forms_submitted: int
    forms_total: int
    documents_required: int
    documents_slots_filled: int
    documents_uploaded: int
    documents_approved: int
    documents_rejected: int
    documents_pending: int
    hub_unlocked: bool


class HrAssessmentAwaitingRow(BaseModel):
    """One candidate invited to a Physical Interview and not yet decided.

    A different population from `HrAssessmentRow` above, not a subset of it:
    these people have an open invite, whereas that list is everyone who has
    already cleared the round. The two are disjoint by construction — recording
    a result here is exactly what moves somebody from this list into that one.

    Carries the screening result for the same reason the roster does: an HR
    reviewer deciding in the room wants the AI score in front of them, and it
    arrived with the page either way.
    """

    invite_id: uuid.UUID
    application_id: uuid.UUID
    candidate_code: str
    full_name: str | None = None
    email: str | None = None

    bootcamp_id: uuid.UUID | None = None
    bootcamp_name: str | None = None
    program_title: str | None = None

    # The batch's details, so the reviewer can tell two rounds apart without
    # opening the invite dialog.
    venue: str
    interview_date: date
    start_time: time | None = None
    deadline_at: datetime

    sent_at: datetime | None = None
    send_failed: bool = False
    # "pending" or "missed" — never a decided one, or it would not be here.
    # Same derivation as the invite dialog's own column, from `row_status`.
    status: str

    ai_score: float | None = None
    interview: dict[str, Any] | None = None


class HrAssessmentStats(BaseModel):
    """The figures above the table. Computed over the same fetch the rows come
    from, not a second pass — the screen already holds the data to answer them.
    """

    total: int
    forms_complete: int
    documents_pending: int
    average_ai_score: float | None = None
    # Open Physical Interview invites — the top section's headline count.
    awaiting_decision: int = 0


class HrAssessmentPage(BaseModel):
    items: list[HrAssessmentRow]
    # Answered by the same request as `items` rather than a second endpoint:
    # the screen shows both sections at once, and a decision recorded in the
    # first moves a candidate into the second, so one fetch keeps them
    # consistent with each other instead of racing.
    awaiting: list[HrAssessmentAwaitingRow] = []
    stats: HrAssessmentStats
