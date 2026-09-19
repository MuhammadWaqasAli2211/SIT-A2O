"""The HR Assessment roll-up: who may read it, and what it computes.

The screen recombines data an admin can already reach, so the interesting
failure is not a wrong number on a card — it is an admin seeing another
intake, or a super admin's unscoped view quietly becoming everyone's. Those
boundaries get the most tests here.
"""

import uuid
from datetime import UTC, date, datetime

import pytest

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.enums import ApplicationStage, ApplicationStatus, UserRole
from app.models.user import Profile
from app.schemas.hr_assessment import HrAssessmentAwaitingRow, HrAssessmentRow
from app.services import ai_interview_service, bootcamp_service, hr_assessment_service


def profile(role: UserRole) -> Profile:
    return Profile(id=uuid.uuid4(), email=f"{role.value.lower()}@example.com", role=role)


class EmptySession:
    """A session whose population query returns nothing.

    Enough for the scoping tests: they assert on who is refused before any
    row is built, so the rows themselves are beside the point.
    """

    def execute(self, _stmt):
        return self

    def all(self):
        return []


def row(**overrides) -> HrAssessmentRow:
    base = dict(
        application_id=uuid.uuid4(),
        candidate_code="B08-001",
        full_name="Ayesha Khan",
        stage=ApplicationStage.FORM,
        status=ApplicationStatus.ACTIVE,
        forms_submitted=4,
        forms_total=4,
        documents_required=5,
        documents_slots_filled=5,
        documents_uploaded=5,
        documents_approved=5,
        documents_rejected=0,
        documents_pending=0,
        hub_unlocked=True,
    )
    return HrAssessmentRow(**{**base, **overrides})


# ------------------------------------------------------------------ scope --


def test_an_admin_must_name_an_intake(monkeypatch):
    """Omitting the intake must not fall through to every intake."""
    with pytest.raises(NotFoundError):
        hr_assessment_service.list_rows(EmptySession(), profile(UserRole.ADMIN), None)


def test_a_super_admin_may_omit_the_intake(monkeypatch):
    """The platform-wide view is the super admin's, and only theirs."""
    monkeypatch.setattr(
        ai_interview_service, "best_interviews_by_application", lambda *a, **k: {}
    )
    page = hr_assessment_service.list_rows(EmptySession(), profile(UserRole.SUPER_ADMIN), None)

    assert page.items == []


def test_naming_an_intake_goes_through_the_bootcamp_check(monkeypatch):
    """The check is `assert_can_manage`, the same gate every other
    bootcamp-scoped read uses — not a role comparison invented here."""
    seen = {}

    def fake_assert(db, actor, bootcamp_id):
        seen["bootcamp_id"] = bootcamp_id

    monkeypatch.setattr(bootcamp_service, "assert_can_manage", fake_assert)
    monkeypatch.setattr(
        ai_interview_service, "best_interviews_by_application", lambda *a, **k: {}
    )
    target = uuid.uuid4()

    hr_assessment_service.list_rows(EmptySession(), profile(UserRole.ADMIN), target)

    assert seen["bootcamp_id"] == target


def test_an_admin_refused_by_the_bootcamp_check_gets_nothing(monkeypatch):
    def refuse(db, actor, bootcamp_id):
        raise PermissionDeniedError("not your intake")

    monkeypatch.setattr(bootcamp_service, "assert_can_manage", refuse)

    with pytest.raises(PermissionDeniedError):
        hr_assessment_service.list_rows(EmptySession(), profile(UserRole.ADMIN), uuid.uuid4())


def test_an_empty_population_skips_the_external_call(monkeypatch):
    """No candidates means nothing to join against — calling InterviewerAI
    anyway would be a round trip whose result is discarded."""
    called = []
    monkeypatch.setattr(
        ai_interview_service,
        "best_interviews_by_application",
        lambda *a, **k: called.append(1) or {},
    )

    hr_assessment_service.list_rows(EmptySession(), profile(UserRole.SUPER_ADMIN), None)

    assert called == []


# --------------------------------------------- best interview per candidate --


class FakeIndexSession:
    pass


def _interview(candidate_id: int, score: float | None, status: str = "completed") -> dict:
    payload = {"id": candidate_id * 10, "candidate_id": candidate_id, "status": status}
    if score is not None:
        payload["score"] = score
    return payload


def _index_for(application_id: uuid.UUID, candidate_id: int) -> dict:
    return {
        f"id:{candidate_id}": {
            "application_id": str(application_id),
            "candidate_name": "Ayesha Khan",
            "candidate_code": "B08-001",
        }
    }


def test_best_interviews_keeps_the_highest_attempt(monkeypatch):
    """Best attempt, not most recent — the rule every other screen uses, so a
    candidate's score cannot differ depending on where it is read."""
    application_id = uuid.uuid4()
    monkeypatch.setattr(
        ai_interview_service,
        "_invited_index",
        lambda db, bootcamp_id=None: (set(), set(), _index_for(application_id, 7)),
    )
    monkeypatch.setattr(
        ai_interview_service.interviewer_ai,
        "list_interviews",
        lambda **kwargs: ([_interview(7, 55), _interview(7, 81), _interview(7, 40)], {}),
    )

    best = ai_interview_service.best_interviews_by_application(
        FakeIndexSession(), profile(UserRole.SUPER_ADMIN)
    )

    assert ai_interview_service.extract_score(best[application_id]) == 81


def test_best_interviews_skips_unfinished_and_unscored(monkeypatch):
    application_id = uuid.uuid4()
    monkeypatch.setattr(
        ai_interview_service,
        "_invited_index",
        lambda db, bootcamp_id=None: (set(), set(), _index_for(application_id, 7)),
    )
    monkeypatch.setattr(
        ai_interview_service.interviewer_ai,
        "list_interviews",
        lambda **kwargs: (
            [_interview(7, 90, status="in_progress"), _interview(7, None)],
            {},
        ),
    )

    best = ai_interview_service.best_interviews_by_application(
        FakeIndexSession(), profile(UserRole.SUPER_ADMIN)
    )

    assert best == {}


def test_best_interviews_refuses_an_unscoped_admin(monkeypatch):
    """Same contract as list_completed: an admin cannot ask for every intake."""
    with pytest.raises(NotFoundError):
        ai_interview_service.best_interviews_by_application(
            FakeIndexSession(), profile(UserRole.ADMIN)
        )


def test_best_interviews_hydrates_with_our_own_record(monkeypatch):
    """The evidence modal reads the candidate's name from `local`; without it
    every row on this screen would render as "Unknown candidate"."""
    application_id = uuid.uuid4()
    monkeypatch.setattr(
        ai_interview_service,
        "_invited_index",
        lambda db, bootcamp_id=None: (set(), set(), _index_for(application_id, 7)),
    )
    monkeypatch.setattr(
        ai_interview_service.interviewer_ai,
        "list_interviews",
        lambda **kwargs: ([_interview(7, 72)], {}),
    )

    best = ai_interview_service.best_interviews_by_application(
        FakeIndexSession(), profile(UserRole.SUPER_ADMIN)
    )

    assert best[application_id]["local"]["candidate_code"] == "B08-001"


# ------------------------------------------------- awaiting-decision half --
# The top section of the screen: candidates with an open Physical Interview
# invite. Disjoint from `items` by construction — recording a result is what
# moves somebody across — so what matters is that the two counts stay
# independent and that the average spans both.


def awaiting(**overrides) -> HrAssessmentAwaitingRow:
    base = dict(
        invite_id=uuid.uuid4(),
        application_id=uuid.uuid4(),
        candidate_code="B08-001",
        venue="Zaitoon Ashraf IT Park",
        interview_date=date(2026, 9, 20),
        deadline_at=datetime(2026, 9, 21, 12, 0, tzinfo=UTC),
        status="pending",
    )
    return HrAssessmentAwaitingRow(**{**base, **overrides})
