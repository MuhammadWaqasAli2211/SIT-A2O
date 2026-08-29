"""Interview deadline expiry and the missed-deadline explanation flow.

The two paths most likely to hide a subtle bug: an invite that should have
stopped working but did not, and an explanation that can be sent when it
should not be. Both are pushed on from the wrong side here — expired when it
should not be, sendable when it should not be — rather than only down the
happy path.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.exceptions import ConflictError
from app.models.interview_invite import InterviewInviteBatch
from app.schemas.ai_interview import CandidateScore, DeadlineExplanation
from pydantic import ValidationError


def batch(deadline: datetime | None) -> InterviewInviteBatch:
    return InterviewInviteBatch(
        bootcamp_id=uuid.uuid4(), subject="Interview", deadline_at=deadline
    )


# --------------------------------------------------------------- expiry --


def test_a_batch_past_its_deadline_is_expired():
    assert batch(datetime.now(UTC) - timedelta(minutes=1)).is_expired


def test_a_batch_before_its_deadline_is_not_expired():
    assert not batch(datetime.now(UTC) + timedelta(days=1)).is_expired


def test_a_batch_with_no_deadline_is_never_expired():
    """Invites sent before deadlines were recorded must not be retroactively
    killed by the feature that introduced them."""
    assert not batch(None).is_expired


def test_expiry_is_evaluated_now_not_at_construction():
    """The flag has to be read from the clock on each access — caching it at
    construction would leave a long-lived object claiming to be valid hours
    after it stopped being."""
    b = batch(datetime.now(UTC) + timedelta(milliseconds=1))
    assert not b.is_expired
    b.deadline_at = datetime.now(UTC) - timedelta(seconds=1)
    assert b.is_expired


# ----------------------------------------------------- candidate status --


def test_an_expired_interview_offers_the_explanation_route():
    result = CandidateScore.model_validate(
        {"status": "expired", "can_explain": True, "explanation_sent": False}
    )
    assert result.status == "expired"
    assert result.can_explain
    assert result.score is None


def test_a_completed_interview_still_reports_its_score_after_the_deadline():
    """Finishing in time has to outrank the phase closing afterwards —
    otherwise a candidate loses a result they legitimately earned."""
    result = CandidateScore.model_validate(
        {"status": "completed", "score": 81.0, "deadline_at": datetime.now(UTC)}
    )
    assert result.status == "completed"
    assert result.score == 81.0


def test_the_deadline_is_exposed_so_the_portal_can_count_down():
    when = datetime.now(UTC) + timedelta(days=2)
    assert CandidateScore.model_validate({"status": "invited", "deadline_at": when}).deadline_at


# -------------------------------------------------------- explanation --


def test_an_explanation_must_actually_say_something():
    """No agent judges the reason, so length is the only gate there is — a
    one-word 'sick' should not pass for an explanation an admin has to act on."""
    with pytest.raises(ValidationError):
        DeadlineExplanation(reason="sick")


def test_a_substantive_explanation_is_accepted():
    reason = (
        "I was admitted to hospital on the morning of the interview and only "
        "discharged two days later. I can provide the discharge paperwork."
    )
    assert DeadlineExplanation(reason=reason).reason == reason


def test_an_explanation_is_length_capped():
    with pytest.raises(ValidationError):
        DeadlineExplanation(reason="a" * 2001)


# ------------------------------------------------------- send-time gate --


def test_sending_invites_needs_a_deadline_on_the_phase(monkeypatch):
    """The gate that makes every invite expirable.

    Exercises the real `send_bulk`, not a copy of its condition: an INTERVIEW
    phase with no deadline must stop the batch before anything reaches
    InterviewerAI, because an invite with no deadline is a link that works
    forever. The external client is stubbed to explode so the test also
    proves nothing was sent.
    """
    from app.integrations import interviewer_ai
    from app.schemas.interview_invite import BulkInviteRequest
    from app.services import bootcamp_service, interview_invite_service

    class PhaseWithoutDeadline:
        deadline_at = None

    monkeypatch.setattr(bootcamp_service, "assert_can_manage", lambda *a, **k: None)
    monkeypatch.setattr(
        bootcamp_service, "assert_phase_open", lambda *a, **k: PhaseWithoutDeadline()
    )
    monkeypatch.setattr(
        interviewer_ai,
        "send_bulk_invite",
        lambda **k: pytest.fail("an invite was sent despite the phase having no deadline"),
    )

    payload = BulkInviteRequest(subject="Interview", application_ids=[uuid.uuid4()])
    with pytest.raises(ConflictError, match="no deadline"):
        interview_invite_service.send_bulk(None, uuid.uuid4(), payload, None)


def test_the_phase_gate_runs_before_anything_is_sent(monkeypatch):
    """A closed interview phase refuses the batch.

    `assert_phase_open` already enforces flag-and-clock, so this checks the
    send path actually consults it rather than gating on the flag itself.
    """
    from app.core.exceptions import ConflictError as CE
    from app.integrations import interviewer_ai
    from app.schemas.interview_invite import BulkInviteRequest
    from app.services import bootcamp_service, interview_invite_service

    def closed(*a, **k):
        raise CE("The interview stage is closed.")

    monkeypatch.setattr(bootcamp_service, "assert_can_manage", lambda *a, **k: None)
    monkeypatch.setattr(bootcamp_service, "assert_phase_open", closed)
    monkeypatch.setattr(
        interviewer_ai,
        "send_bulk_invite",
        lambda **k: pytest.fail("an invite was sent while the phase was closed"),
    )

    payload = BulkInviteRequest(subject="Interview", application_ids=[uuid.uuid4()])
    with pytest.raises(CE, match="closed"):
        interview_invite_service.send_bulk(None, uuid.uuid4(), payload, None)
