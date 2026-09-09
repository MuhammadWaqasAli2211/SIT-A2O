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
    documents_uploaded: int
    documents_approved: int
    documents_rejected: int
    documents_pending: int
    hub_unlocked: bool


class HrAssessmentStats(BaseModel):
    """The figures above the table. Computed over the same fetch the rows come
    from, not a second pass — the screen already holds the data to answer them.
    """

    total: int
    forms_complete: int
    documents_pending: int
    average_ai_score: float | None = None


class HrAssessmentPage(BaseModel):
    items: list[HrAssessmentRow]
    stats: HrAssessmentStats
