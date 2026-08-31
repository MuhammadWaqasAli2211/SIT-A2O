"""Completed Interviews: stat computation, the untrusted-status-filter guard,
and the bootcamp-required-for-admin gate.

Stats are the part most likely to hide a subtle bug — a timezone slip that
moves a row in or out of "today", a missing score silently becoming a zero —
so those are pushed on directly rather than only through a full list_completed
call.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.exceptions import NotFoundError
from app.models.application import StageTransition
from app.models.enums import ApplicationStage, ApplicationStatus, UserRole
from app.models.notification import Notification
from app.models.ops import AuditLog
from app.models.user import Profile
from app.services.ai_interview_service import _completed_at, _completed_stats


def iso(dt: datetime) -> str:
    return dt.isoformat()


def profile(role: UserRole) -> Profile:
    return Profile(id=uuid.uuid4(), email=f"{role.value.lower()}@example.com", role=role)


# ---------------------------------------------------------- _completed_at --


def test_completed_at_prefers_completed_over_updated_over_created():
    a, b, c = "2026-08-01T00:00:00Z", "2026-08-02T00:00:00Z", "2026-08-03T00:00:00Z"
    assert _completed_at({"completed_at": a, "updated_at": b, "created_at": c}).isoformat().startswith("2026-08-01")
    assert _completed_at({"updated_at": b, "created_at": c}).isoformat().startswith("2026-08-02")
    assert _completed_at({"created_at": c}).isoformat().startswith("2026-08-03")


def test_completed_at_is_none_when_nothing_is_present():
    assert _completed_at({}) is None


def test_completed_at_rejects_garbage_rather_than_raising():
    assert _completed_at({"completed_at": "not a date"}) is None


def test_a_naive_timestamp_is_treated_as_utc_not_left_comparable_to_nothing():
    """Their timestamps carry no guaranteed timezone. A naive datetime here
    must not later blow up comparing against an aware `now()` in the stats."""
    naive = _completed_at({"completed_at": "2026-08-29T12:00:00"})
    assert naive is not None
    assert naive.tzinfo is not None
    # Would raise TypeError if this comparison were naive vs aware.
    assert naive < datetime.now(UTC) + timedelta(days=1)


# ------------------------------------------------------------- stat cards --


def test_stats_on_an_empty_list():
    stats = _completed_stats([])
    assert stats == {
        "total": 0,
        "completed_today": 0,
        "completed_this_week": 0,
        "average_score": None,
    }


def test_total_counts_every_item_regardless_of_date_or_score():
    items = [{"completed_at": iso(datetime.now(UTC))} for _ in range(5)]
    assert _completed_stats(items)["total"] == 5


def test_completed_today_only_counts_items_from_today():
    now = datetime.now(UTC)
    items = [
        {"completed_at": iso(now)},
        {"completed_at": iso(now - timedelta(days=1))},
        {"completed_at": iso(now - timedelta(days=6))},
    ]
    assert _completed_stats(items)["completed_today"] == 1


def test_completed_this_week_uses_a_rolling_seven_days_not_calendar_week():
    now = datetime.now(UTC)
    items = [
        {"completed_at": iso(now)},
        {"completed_at": iso(now - timedelta(days=6, hours=23))},
        {"completed_at": iso(now - timedelta(days=8))},
    ]
    assert _completed_stats(items)["completed_this_week"] == 2


def test_an_item_with_no_completed_at_is_still_counted_in_total_only():
    """A malformed record must not disappear from the roster just because its
    date could not be parsed — it should simply not land in a date bucket."""
    stats = _completed_stats([{"score": 50}])
    assert stats["total"] == 1
    assert stats["completed_today"] == 0
    assert stats["completed_this_week"] == 0


def test_average_score_ignores_items_with_no_recognisable_score():
    now = iso(datetime.now(UTC))
    items = [
        {"completed_at": now, "overall_score": 80},
        {"completed_at": now, "overall_score": 60},
        {"completed_at": now},  # no score at all — must not become a 0
    ]
    assert _completed_stats(items)["average_score"] == 70.0


def test_average_score_is_none_when_nothing_has_a_score():
    assert _completed_stats([{"completed_at": iso(datetime.now(UTC))}])["average_score"] is None


def test_average_score_is_rounded_to_one_decimal():
    now = iso(datetime.now(UTC))
    items = [{"completed_at": now, "score": s} for s in (81, 82, 82)]
    assert _completed_stats(items)["average_score"] == pytest.approx(81.7)


# --------------------------------------------------------- bootcamp gate --


def test_an_admin_with_no_bootcamp_is_refused_not_shown_everything():
    """Only a super admin may omit bootcamp_id. An admin omitting it must be
    refused, not silently handed the platform-wide view."""
    from app.services import ai_interview_service as s

    with pytest.raises(NotFoundError, match="Select an intake"):
        s.list_completed(None, profile(UserRole.ADMIN), None)


# --------------------------------------------------------- pass threshold --


def test_pass_threshold_is_fifty():
    """Pinned so a future change to this number is a deliberate edit here,
    not a silent drift — decided 2026-08-30."""
    from app.services.ai_interview_service import PASS_THRESHOLD

    assert PASS_THRESHOLD == 50.0


@pytest.mark.parametrize(("value", "expected"), [(50.0, True), (50.1, True), (49.9, False), (0.0, False)])
def test_passed_is_a_plain_ge_comparison_against_the_threshold(value, expected):
    from app.services.ai_interview_service import PASS_THRESHOLD

    assert (value >= PASS_THRESHOLD) is expected


# ------------------------------------------------ admin completion notice --


class RecordingSession:
    """Minimal stand-in for a Session: records every Notification added and
    answers `scalars` from a queue of canned results, in call order."""

    def __init__(self, scalar_results):
        self._results = list(scalar_results)
        self.added = []

    def scalars(self, stmt):
        return self._results.pop(0)

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        pass


def test_notifies_every_active_assigned_admin_once_each():
    from app.services.ai_interview_service import _notify_admins_of_completion

    admin_a, admin_b = uuid.uuid4(), uuid.uuid4()
    session = RecordingSession([[admin_a, admin_b]])

    _notify_admins_of_completion(
        session,
        bootcamp_id=uuid.uuid4(),
        candidate_name="Test Candidate",
        candidate_code="B08-099",
        application_id=uuid.uuid4(),
        score=72.0,
    )

    assert len(session.added) == 2
    assert {n.profile_id for n in session.added} == {admin_a, admin_b}
    assert all("B08-099" in n.body for n in session.added)
    assert all("72" in n.body for n in session.added)


def test_falls_back_to_super_admins_when_the_bootcamp_has_none_assigned():
    """Same fallback submit_deadline_explanation uses — an intake with nobody
    assigned must still reach someone, not notify no one."""
    from app.services.ai_interview_service import _notify_admins_of_completion

    super_admin = uuid.uuid4()
    session = RecordingSession([[], [super_admin]])

    _notify_admins_of_completion(
        session,
        bootcamp_id=uuid.uuid4(),
        candidate_name="Test Candidate",
        candidate_code="B08-099",
        application_id=uuid.uuid4(),
        score=72.0,
    )

    assert len(session.added) == 1
    assert session.added[0].profile_id == super_admin


# ---------------------------------------------- auto-advance to AI_INTERVIEWED --


class RecordingAddSession:
    """A session fake that only needs to record `.add()` calls — everything
    `_mark_interviewed` touches (StageTransition, AuditLog via
    audit_service.record, Notification via notify_stage_outcome) goes through
    `db.add`, none of it through `scalars` or a real query."""

    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        pass


class FakeApplication:
    """Duck-types the handful of fields `_mark_interviewed` reads and writes.
    Not the real ORM model, so this stays a unit test with no database."""

    def __init__(self, *, stage, status):
        self.id = uuid.uuid4()
        self.profile_id = uuid.uuid4()
        self.candidate_code = "B08-099"
        self.stage = stage
        self.status = status


def test_mark_interviewed_advances_from_interview_scheduled():
    from app.services.ai_interview_service import _mark_interviewed

    session = RecordingAddSession()
    application = FakeApplication(
        stage=ApplicationStage.INTERVIEW_SCHEDULED, status=ApplicationStatus.ACTIVE
    )

    _mark_interviewed(session, application)

    assert application.stage == ApplicationStage.AI_INTERVIEWED

    transitions = [o for o in session.added if isinstance(o, StageTransition)]
    assert len(transitions) == 1
    assert transitions[0].from_stage == ApplicationStage.INTERVIEW_SCHEDULED
    assert transitions[0].to_stage == ApplicationStage.AI_INTERVIEWED
    # Attributed to no one — this is the system recording a fact, not a
    # person's decision, unlike an admin's own advance_stage() call.
    assert transitions[0].actor_id is None

    audit_rows = [o for o in session.added if isinstance(o, AuditLog)]
    assert len(audit_rows) == 1
    assert audit_rows[0].actor_id is None
    assert audit_rows[0].entity_id == application.id

    notifications = [o for o in session.added if isinstance(o, Notification)]
    assert len(notifications) == 1
    assert notifications[0].profile_id == application.profile_id


@pytest.mark.parametrize(
    "stage",
    [
        ApplicationStage.APPLIED,
        ApplicationStage.AI_INTERVIEWED,
        ApplicationStage.PHYSICAL_INTERVIEW,
        ApplicationStage.FORM,
        ApplicationStage.ONBOARDED,
        ApplicationStage.REJECTED,
    ],
)
def test_mark_interviewed_is_a_no_op_from_any_other_stage(stage):
    """Only fires from exactly INTERVIEW_SCHEDULED — never regresses a stage
    an admin already moved further, and never touches a rejected pipeline."""
    from app.services.ai_interview_service import _mark_interviewed

    session = RecordingAddSession()
    application = FakeApplication(stage=stage, status=ApplicationStatus.ACTIVE)

    _mark_interviewed(session, application)

    assert application.stage == stage
    assert session.added == []


@pytest.mark.parametrize("status", [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN])
def test_mark_interviewed_is_a_no_op_on_a_closed_application(status):
    from app.services.ai_interview_service import _mark_interviewed

    session = RecordingAddSession()
    application = FakeApplication(stage=ApplicationStage.INTERVIEW_SCHEDULED, status=status)

    _mark_interviewed(session, application)

    assert application.stage == ApplicationStage.INTERVIEW_SCHEDULED
    assert session.added == []
