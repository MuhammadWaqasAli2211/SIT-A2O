"""Schemas for the AI Interviewer integration.

Admin-facing reads pass their payloads through as `dict` on purpose: the
external responses are undocumented and unstable (see
app/integrations/interviewer_ai.py), so pinning a model here would drop
fields we do not yet know about. The candidate-facing schema is the exact
opposite — rigidly closed, because that is the boundary that matters.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class CandidateScore(BaseModel):
    """What a candidate is allowed to know about their AI interview.

    This model is the security boundary, not a convenience. It carries a
    status, a number, its scale, and a timestamp — and deliberately has no
    field able to hold question text, answers, proctor snapshots, a recording
    URL, transcripts, or audit entries. Adding one would need a deliberate
    edit here, which is the point: a wider payload cannot leak through by
    somebody forgetting an `exclude` somewhere upstream.
    """

    status: Literal["not_invited", "invited", "in_progress", "completed", "expired"]

    # None until an interview is finished and carries a score we recognise.
    score: float | None = None
    scale: int = 100
    completed_at: datetime | None = None

    # None until completed. Score >= PASS_THRESHOLD in ai_interview_service.py
    # (decided 2026-08-30: 50/100) — a plain fact about the number, not a
    # verdict: nothing here auto-rejects, an admin still decides.
    passed: bool | None = None

    # The candidate's own deadline, so the portal can count down to it rather
    # than show a bare date. Safe to expose: it is the date they were emailed.
    deadline_at: datetime | None = None

    # Set once the deadline has passed without a completed interview. The
    # application is stuck at this stage — nothing auto-rejects — and the
    # candidate is offered the explanation flow instead of a dead link.
    can_explain: bool = False

    # Whether they have already sent their explanation. Deliberately a bool
    # and not an accepted/declined verdict: explanations are stored as rows in
    # `email_log` (decided 2026-08-29), which is a delivery record with no
    # decision field, so there is no verdict to report. An admin acting on an
    # explanation does it by moving the candidate's stage, which is recorded
    # in the audit trail rather than here.
    explanation_sent: bool = False


class ReinterviewDecision(BaseModel):
    approve: bool
    note: str | None = Field(default=None, max_length=500)


class DeadlineExplanation(BaseModel):
    """A candidate's written reason for missing their interview deadline.

    `min_length` is the only gate on it. There is no agent judging whether the
    reason is genuine (decided 2026-08-29) — an administrator reads it and
    decides — so this checks that something substantive was actually written
    and nothing more.
    """

    reason: str = Field(min_length=30, max_length=2000)


class ScoreBand(BaseModel):
    band: str
    count: int


class AiAnalytics(BaseModel):
    scope: Literal["platform", "bootcamp"]
    candidates: int | None = None
    interviews_completed: int | None = None
    average_score: float | None = None
    distribution: list[ScoreBand] = Field(default_factory=list)


class ExternalRecords(BaseModel):
    """A pass-through list from their API, shape unverified."""

    items: list[dict[str, Any]] = Field(default_factory=list)


class CompletedInterviewStats(BaseModel):
    """The stat-card row above the Completed Interviews table. Always
    computed over the full matched set, never the search/filter view — the
    cards are a summary, not a reflection of what the toolbar currently
    narrows the table to."""

    total: int
    completed_today: int
    completed_this_week: int
    average_score: float | None = None


class CompletedInterviewsPage(ExternalRecords):
    stats: CompletedInterviewStats


class KeyScopes(BaseModel):
    """What our own API key can do — shown to a super admin before they
    delegate any of it, so the screen cannot offer a scope the key lacks."""

    name: str | None = None
    company_name: str | None = None
    scopes: list[str] = Field(default_factory=list)
    rate_limit_per_minute: int | None = None
