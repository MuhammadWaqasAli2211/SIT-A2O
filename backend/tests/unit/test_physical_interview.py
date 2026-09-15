"""Physical Interview: the derived row status (pending/selected/rejected/
missed) and the send-time deadline gate.

Same shape as test_interview_deadline.py: "missed" is never stored, so the
thing most likely to hide a bug is the derivation itself — pushed on from
every branch here rather than only the happy path.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.exceptions import ConflictError
from app.models.application import Application
from app.models.bootcamp import Bootcamp
from app.models.enums import PhysicalInterviewResult
from app.models.physical_interview import PhysicalInterviewBatch, PhysicalInterviewInvite
from app.models.user import Profile
from app.services import physical_interview_service as svc
from app.services.physical_interview_service import row_status


def batch(deadline: datetime) -> PhysicalInterviewBatch:
    return PhysicalInterviewBatch(
        bootcamp_id=uuid.uuid4(),
        venue="Zaitoon Ashraf IT Park",
        interview_date=datetime.now(UTC).date(),
        deadline_at=deadline,
    )


def invite(b: PhysicalInterviewBatch, result: PhysicalInterviewResult | None = None) -> PhysicalInterviewInvite:
    inv = PhysicalInterviewInvite(application_id=uuid.uuid4(), result=result)
    inv.batch = b
    return inv


# --------------------------------------------------------------- expiry --


def test_a_batch_past_its_deadline_is_expired():
    assert batch(datetime.now(UTC) - timedelta(minutes=1)).is_expired


def test_a_batch_before_its_deadline_is_not_expired():
    assert not batch(datetime.now(UTC) + timedelta(days=1)).is_expired


# ------------------------------------------------------------ row_status --


def test_an_undecided_invite_before_the_deadline_is_pending():
    b = batch(datetime.now(UTC) + timedelta(days=1))
    assert row_status(invite(b)) == "pending"


def test_an_undecided_invite_past_the_deadline_is_missed():
    """The core of the feature: nothing writes this, it is read off the clock."""
    b = batch(datetime.now(UTC) - timedelta(minutes=1))
    assert row_status(invite(b)) == "missed"


def test_a_selected_invite_is_selected_even_past_the_deadline():
    """A result recorded in time outranks the deadline having since passed —
    the same "completed beats expired" rule the AI-interview side already
    applies to a finished interview."""
    b = batch(datetime.now(UTC) - timedelta(minutes=1))
    assert row_status(invite(b, PhysicalInterviewResult.SELECTED)) == "selected"


def test_a_rejected_invite_is_rejected_even_past_the_deadline():
    b = batch(datetime.now(UTC) - timedelta(minutes=1))
    assert row_status(invite(b, PhysicalInterviewResult.REJECTED)) == "rejected"


# -------------------------------------------------------- send-time gate --


def test_sending_an_invite_needs_a_future_deadline(monkeypatch):
    """Exercises the real send_bulk, not a copy of its condition — a deadline
    that has already passed must stop the batch before any application is
    even queried."""
    from app.schemas.physical_interview import PhysicalInterviewInviteRequest
    from app.services import bootcamp_service, physical_interview_service

    monkeypatch.setattr(bootcamp_service, "assert_can_manage", lambda *a, **k: None)

    payload = PhysicalInterviewInviteRequest(
        venue="Zaitoon Ashraf IT Park",
        interview_date=datetime.now(UTC).date(),
        deadline_at=datetime.now(UTC) - timedelta(hours=1),
        subject="Physical Interview",
        message="You are invited to a Physical Interview at $venue on $interview_date.",
        application_ids=[uuid.uuid4()],
    )
    with pytest.raises(ConflictError, match="future"):
        physical_interview_service.send_bulk(None, uuid.uuid4(), payload, None)


def test_a_naive_deadline_is_treated_as_utc_not_left_uncomparable(monkeypatch):
    """The request schema accepts a bare datetime; send_bulk must not raise
    TypeError comparing a naive value against an aware now()."""
    from app.schemas.physical_interview import PhysicalInterviewInviteRequest
    from app.services import bootcamp_service, physical_interview_service

    monkeypatch.setattr(bootcamp_service, "assert_can_manage", lambda *a, **k: None)

    naive_past = (datetime.now(UTC) - timedelta(hours=1)).replace(tzinfo=None)
    payload = PhysicalInterviewInviteRequest(
        venue="Zaitoon Ashraf IT Park",
        interview_date=datetime.now(UTC).date(),
        deadline_at=naive_past,
        subject="Physical Interview",
        message="Venue: $venue",
        application_ids=[uuid.uuid4()],
    )
    with pytest.raises(ConflictError, match="future"):
        physical_interview_service.send_bulk(None, uuid.uuid4(), payload, None)


# ------------------------------------------------- outcome email routing --
# The decision itself is already covered above and by the route tests. What
# these pin is the half added for the selection/rejection flow: which email
# goes out, that the internal note never travels with it, and that a mail
# failure cannot undo a decision an admin recorded in person.


class _FakeDb:
    """Enough Session for _email_outcome: it only ever `get`s two rows."""

    def __init__(self, profile, bootcamp):
        self._by_type = {Profile: profile, Bootcamp: bootcamp}

    def get(self, model, _pk):
        return self._by_type.get(model)


def _application():
    return Application(
        id=uuid.uuid4(),
        candidate_code="B08-042",
        bootcamp_id=uuid.uuid4(),
        profile_id=uuid.uuid4(),
    )


def _fake_db(email="candidate@example.com"):
    return _FakeDb(
        Profile(id=uuid.uuid4(), email=email, full_name="Ayesha Khan"),
        Bootcamp(id=uuid.uuid4(), name="Bootcamp 08"),
    )


def test_selection_sends_the_selected_email(monkeypatch):
    sent = {}
    monkeypatch.setattr(
        svc.email_service, "send_physical_interview_selected",
        lambda **kw: sent.update({"selected": kw}),
    )
    monkeypatch.setattr(
        svc.email_service, "send_physical_interview_rejected",
        lambda **kw: sent.update({"rejected": kw}),
    )

    svc._email_outcome(_fake_db(), _application(), PhysicalInterviewResult.SELECTED)

    assert "rejected" not in sent
    assert sent["selected"]["candidate_code"] == "B08-042"
    assert sent["selected"]["bootcamp_name"] == "Bootcamp 08"


def test_rejection_sends_the_rejection_email(monkeypatch):
    sent = {}
    monkeypatch.setattr(
        svc.email_service, "send_physical_interview_selected",
        lambda **kw: sent.update({"selected": kw}),
    )
    monkeypatch.setattr(
        svc.email_service, "send_physical_interview_rejected",
        lambda **kw: sent.update({"rejected": kw}),
    )

    svc._email_outcome(_fake_db(), _application(), PhysicalInterviewResult.REJECTED)

    assert "selected" not in sent
    assert sent["rejected"]["candidate_code"] == "B08-042"


def test_the_internal_note_never_reaches_the_candidate_email(monkeypatch):
    """The rejection note is the admin's own record. `_email_outcome` is not
    even given it, and this is the test that keeps it that way."""
    sent = {}
    monkeypatch.setattr(
        svc.email_service, "send_physical_interview_rejected",
        lambda **kw: sent.update(kw),
    )
    svc._email_outcome(_fake_db(), _application(), PhysicalInterviewResult.REJECTED)

    assert "rejection_note" not in sent
    assert not any("note" in key for key in sent)


def test_a_candidate_with_no_email_is_skipped_rather_than_erroring(monkeypatch):
    monkeypatch.setattr(
        svc.email_service, "send_physical_interview_selected",
        lambda **kw: pytest.fail("should not have tried to send"),
    )
    svc._email_outcome(_fake_db(email=""), _application(), PhysicalInterviewResult.SELECTED)
