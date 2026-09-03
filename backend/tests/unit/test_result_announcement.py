"""Bulk AI interview result announcement.

The two things most likely to hide a bug: a score reaching a candidate
before it was announced, and the announce gate letting results out while
somebody could still be sitting the interview. Both are pushed on from the
wrong side here rather than only down the happy path.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.exceptions import ConflictError
from app.models.bootcamp import BootcampPhase
from app.models.enums import ApplicationStage, PhaseType
from app.schemas.ai_interview import AnnounceSummary, CandidateScore
from app.services.ai_interview_service import PASS_THRESHOLD, _summarise


def phase(deadline: datetime | None, announced_at: datetime | None = None) -> BootcampPhase:
    return BootcampPhase(
        bootcamp_id=uuid.uuid4(),
        phase=PhaseType.INTERVIEW,
        deadline_at=deadline,
        results_announced_at=announced_at,
    )


# ------------------------------------------------------- announced flag --


def test_a_phase_with_no_announcement_reads_as_not_announced():
    assert not phase(None).results_announced


def test_a_phase_with_a_timestamp_reads_as_announced():
    assert phase(None, datetime.now(UTC)).results_announced


# ------------------------------------------------------------- summary --


def test_summary_splits_pass_fail_and_no_score():
    scores = {
        uuid.uuid4(): 90.0,
        uuid.uuid4(): PASS_THRESHOLD,  # exactly at the threshold: passes
        uuid.uuid4(): 20.0,
        uuid.uuid4(): None,  # invited, never completed
        uuid.uuid4(): None,
    }
    summary = _summarise(phase(None), scores, datetime.now(UTC))

    assert summary["invited"] == 5
    assert summary["passed"] == 2
    assert summary["failed"] == 1
    assert summary["no_score"] == 2
    # "Completed" is only those with a readable score, so it never silently
    # includes the people who never took it.
    assert summary["completed"] == 3


def test_summary_cannot_announce_before_the_deadline():
    """The whole gate: results only go out once nobody can still be sitting
    the interview."""
    future = datetime.now(UTC) + timedelta(days=1)
    summary = _summarise(phase(future), {}, datetime.now(UTC))
    assert not summary["deadline_passed"]
    assert not summary["can_announce"]


def test_summary_can_announce_once_the_deadline_has_passed():
    past = datetime.now(UTC) - timedelta(minutes=1)
    summary = _summarise(phase(past), {}, datetime.now(UTC))
    assert summary["deadline_passed"]
    assert summary["can_announce"]


def test_summary_with_no_deadline_cannot_announce():
    """A phase with no deadline has no moment that is safely 'after'."""
    summary = _summarise(phase(None), {}, datetime.now(UTC))
    assert not summary["can_announce"]


def test_summary_serialises_to_the_response_schema():
    summary = _summarise(phase(datetime.now(UTC) - timedelta(days=1)), {}, datetime.now(UTC))
    assert AnnounceSummary.model_validate(summary).can_announce


# ------------------------------------------------- candidate visibility --


def test_a_completed_but_unannounced_result_carries_no_score_or_verdict():
    """The point of the whole feature. "Completed" must be sayable without
    saying how well."""
    result = CandidateScore.model_validate({"status": "completed", "announced": False})
    assert result.status == "completed"
    assert result.score is None
    assert result.passed is None
    assert not result.announced


def test_an_announced_result_carries_the_score_and_verdict():
    result = CandidateScore.model_validate(
        {"status": "completed", "score": 81.0, "passed": True, "announced": True}
    )
    assert result.score == 81.0
    assert result.passed is True
    assert result.announced


def test_result_seen_defaults_to_false_so_the_popup_fires_once():
    """An announced result nobody has acknowledged yet is what triggers the
    reveal popup; the flag only ever moves one way."""
    fresh = CandidateScore.model_validate({"status": "completed", "announced": True})
    assert not fresh.result_seen
    seen = CandidateScore.model_validate(
        {"status": "completed", "announced": True, "result_seen": True}
    )
    assert seen.result_seen


# --------------------------------------------------------- announce gate --


def test_announcing_before_the_deadline_is_refused(monkeypatch):
    """Exercises the real set_results_visible, not a copy of its condition."""
    from app.services import ai_interview_service, bootcamp_service

    open_phase = phase(datetime.now(UTC) + timedelta(days=1))

    monkeypatch.setattr(bootcamp_service, "assert_can_manage", lambda *a, **k: None)
    monkeypatch.setattr(ai_interview_service, "_interview_phase", lambda *a, **k: open_phase)
    monkeypatch.setattr(
        ai_interview_service,
        "_best_scores_by_application",
        lambda *a, **k: pytest.fail("candidates were moved before the deadline passed"),
    )

    with pytest.raises(ConflictError, match="after the interview deadline"):
        ai_interview_service.set_results_visible(None, uuid.uuid4(), visible=True, actor=None)


def test_announcing_without_a_deadline_is_refused(monkeypatch):
    from app.services import ai_interview_service, bootcamp_service

    monkeypatch.setattr(bootcamp_service, "assert_can_manage", lambda *a, **k: None)
    monkeypatch.setattr(ai_interview_service, "_interview_phase", lambda *a, **k: phase(None))

    with pytest.raises(ConflictError, match="no deadline"):
        ai_interview_service.set_results_visible(None, uuid.uuid4(), visible=True, actor=None)


def test_announcing_twice_is_refused(monkeypatch):
    from app.services import ai_interview_service, bootcamp_service

    already = phase(datetime.now(UTC) - timedelta(days=1), datetime.now(UTC))
    monkeypatch.setattr(bootcamp_service, "assert_can_manage", lambda *a, **k: None)
    monkeypatch.setattr(ai_interview_service, "_interview_phase", lambda *a, **k: already)

    with pytest.raises(ConflictError, match="already announced"):
        ai_interview_service.set_results_visible(None, uuid.uuid4(), visible=True, actor=None)


def test_hiding_what_is_already_hidden_is_refused(monkeypatch):
    from app.services import ai_interview_service, bootcamp_service

    monkeypatch.setattr(bootcamp_service, "assert_can_manage", lambda *a, **k: None)
    monkeypatch.setattr(
        ai_interview_service, "_interview_phase", lambda *a, **k: phase(datetime.now(UTC))
    )

    with pytest.raises(ConflictError, match="already hidden"):
        ai_interview_service.set_results_visible(None, uuid.uuid4(), visible=False, actor=None)


# ------------------------------------------------------ stage decisions --


def test_the_stage_each_score_earns():
    """Pinned rather than left implicit: the threshold decides the stage, and
    a candidate with no readable score is rejected alongside the failures
    (decided 2026-09-03)."""
    from app.services import ai_interview_service

    moved: list[tuple[uuid.UUID, ApplicationStage]] = []

    class FakeAdvance:
        @staticmethod
        def advance_stage(db, application_id, *, to_stage, actor, reason):
            moved.append((application_id, to_stage))

    original = ai_interview_service.application_service
    ai_interview_service.application_service = FakeAdvance  # type: ignore[assignment]
    try:
        passed_id, failed_id, no_score_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        ai_interview_service._advance_on_announce(
            None, {passed_id: 88.0, failed_id: 12.0, no_score_id: None}, None
        )
    finally:
        ai_interview_service.application_service = original

    by_id = dict(moved)
    assert by_id[passed_id] == ApplicationStage.PHYSICAL_INTERVIEW
    assert by_id[failed_id] == ApplicationStage.REJECTED
    assert by_id[no_score_id] == ApplicationStage.REJECTED


def test_a_row_that_cannot_move_does_not_fail_the_whole_announce():
    """One candidate already sitting at that stage must not stop everyone
    else's result being announced."""
    from app.services import ai_interview_service

    moved: list[uuid.UUID] = []

    class PartlyFailing:
        @staticmethod
        def advance_stage(db, application_id, *, to_stage, actor, reason):
            if not moved:
                moved.append(application_id)
                raise ConflictError("Application is already at PHYSICAL_INTERVIEW.")
            moved.append(application_id)

    original = ai_interview_service.application_service
    ai_interview_service.application_service = PartlyFailing  # type: ignore[assignment]
    try:
        ai_interview_service._advance_on_announce(
            None, {uuid.uuid4(): 90.0, uuid.uuid4(): 90.0}, None
        )
    finally:
        ai_interview_service.application_service = original

    assert len(moved) == 2
