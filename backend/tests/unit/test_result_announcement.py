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
from app.models.application import Application
from app.models.bootcamp import BootcampPhase
from app.models.enums import ApplicationStage, ApplicationStatus, PhaseType
from app.schemas.ai_interview import AnnounceSummary, CandidateScore
from app.services import ai_interview_service as svc
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


class _SweepDb:
    """A session for `_advance_on_announce`, which now looks each application
    up to check it is still awaiting a verdict before moving it. Hands back an
    eligible row for any id unless one was seeded otherwise."""

    def __init__(self, by_id=None):
        self._by_id = by_id or {}

    def get(self, _model, pk):
        if pk not in self._by_id:
            self._by_id[pk] = Application(
                id=pk,
                candidate_code="B00-000",
                bootcamp_id=uuid.uuid4(),
                profile_id=uuid.uuid4(),
                stage=ApplicationStage.AI_INTERVIEWED,
                status=ApplicationStatus.ACTIVE,
            )
        return self._by_id[pk]


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
            _SweepDb(), {passed_id: 88.0, failed_id: 12.0, no_score_id: None}, None
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
            _SweepDb(), {uuid.uuid4(): 90.0, uuid.uuid4(): 90.0}, None
        )
    finally:
        ai_interview_service.application_service = original

    assert len(moved) == 2


# ------------------------------ late completions, after results are out --
# The announce sweep only ever covers who had finished when it ran. An intake
# can still be taking interviews afterwards — the deadline is editable after
# an announcement — so a candidate can legitimately finish once results are
# already out. Before `_apply_announced_outcome` existed they sat at
# AI-INTERVIEWED for ever, seeing their own score while the admin's Completed
# table said "Awaiting decision".


class _Db:
    """Enough Session for _apply_announced_outcome, which only reaches the
    database through application_service.advance_stage."""

    def __init__(self, application):
        self.application = application
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        pass


def _application(stage=ApplicationStage.AI_INTERVIEWED, status=ApplicationStatus.ACTIVE):
    return Application(
        id=uuid.uuid4(),
        candidate_code="B07-010",
        bootcamp_id=uuid.uuid4(),
        profile_id=uuid.uuid4(),
        stage=stage,
        status=status,
    )


@pytest.fixture
def patched(monkeypatch):
    """advance_stage really runs, but against the in-memory application."""
    moves = []

    def fake_advance(db, application_id, *, to_stage, actor, reason=None):
        app = db.application
        if app.stage == to_stage:
            raise ConflictError("already there")
        app.stage = to_stage
        moves.append((to_stage, reason, actor))
        return app

    monkeypatch.setattr(svc.application_service, "advance_stage", fake_advance)
    return moves


def test_a_late_failing_candidate_is_rejected(patched):
    app = _application()
    assert svc._apply_announced_outcome(_Db(app), app, 30.0) is True
    assert app.stage == ApplicationStage.REJECTED
    assert patched[0][0] == ApplicationStage.REJECTED


def test_a_late_passing_candidate_goes_to_physical_interview(patched):
    app = _application()
    assert svc._apply_announced_outcome(_Db(app), app, PASS_THRESHOLD) is True
    assert app.stage == ApplicationStage.PHYSICAL_INTERVIEW


def test_the_move_is_attributed_to_nobody(patched):
    """It is the system applying a decision already made and audited at
    announce time, not a person acting now."""
    app = _application()
    svc._apply_announced_outcome(_Db(app), app, 30.0)
    assert patched[0][2] is None


def test_a_candidate_already_moved_on_is_left_alone(patched):
    """The sweep, or an admin, got there first. Re-deciding would undo them."""
    app = _application(stage=ApplicationStage.PHYSICAL_INTERVIEW)
    assert svc._apply_announced_outcome(_Db(app), app, 30.0) is False
    assert app.stage == ApplicationStage.PHYSICAL_INTERVIEW
    assert patched == []


def test_a_rejected_candidate_is_not_re_rejected(patched):
    app = _application(stage=ApplicationStage.REJECTED)
    assert svc._apply_announced_outcome(_Db(app), app, 30.0) is False
    assert patched == []


def test_an_inactive_application_is_skipped(patched):
    app = _application(status=ApplicationStatus.WITHDRAWN)
    assert svc._apply_announced_outcome(_Db(app), app, 30.0) is False
    assert patched == []


def test_no_readable_score_changes_nothing(patched):
    """Unlike the announce sweep, which rejects a no-score row because its
    deadline has demonstrably passed, a live poll may simply be early."""
    app = _application()
    assert svc._apply_announced_outcome(_Db(app), app, None) is False
    assert app.stage == ApplicationStage.AI_INTERVIEWED


def test_it_is_idempotent_across_repeated_polls(patched):
    """It runs on every candidate poll and every admin list, so running twice
    must not produce two transitions."""
    app = _application()
    assert svc._apply_announced_outcome(_Db(app), app, 30.0) is True
    assert svc._apply_announced_outcome(_Db(app), app, 30.0) is False
    assert len(patched) == 1


# ------------------------------------- the sweep must not walk people back --
# `advance_stage` refuses only a move to the stage you are already on; it has
# no opinion about direction. So before `_awaiting_verdict` guarded it, a
# second announce (or one run after somebody had cleared their Physical
# Interview) dragged a candidate at FORM — paperwork in, documents uploaded —
# back to PHYSICAL_INTERVIEW. Observed on B07-008, 2026-09-10.


@pytest.mark.parametrize(
    "stage",
    [
        ApplicationStage.PHYSICAL_INTERVIEW,
        ApplicationStage.FORM,
        ApplicationStage.ONBOARDED,
        ApplicationStage.REJECTED,
    ],
)
def test_a_candidate_past_the_interview_is_not_swept_again(stage):
    assert svc._awaiting_verdict(_application(stage=stage)) is False


@pytest.mark.parametrize(
    "stage",
    [ApplicationStage.INTERVIEW_SCHEDULED, ApplicationStage.AI_INTERVIEWED],
)
def test_a_candidate_still_awaiting_a_verdict_is_swept(stage):
    assert svc._awaiting_verdict(_application(stage=stage)) is True


def test_an_inactive_application_is_never_swept():
    app = _application(stage=ApplicationStage.AI_INTERVIEWED, status=ApplicationStatus.WITHDRAWN)
    assert svc._awaiting_verdict(app) is False


def test_the_sweep_and_the_live_path_agree_on_who_is_eligible(patched):
    """Two callers, one rule. If these ever diverge, a candidate can be moved
    by one path and refused by the other for the same state."""
    for stage in ApplicationStage:
        app = _application(stage=stage)
        eligible = svc._awaiting_verdict(app)
        # _apply_announced_outcome refuses exactly when _awaiting_verdict does.
        moved = svc._apply_announced_outcome(_Db(app), app, 30.0)
        assert moved == eligible, f"disagreement at {stage}"
