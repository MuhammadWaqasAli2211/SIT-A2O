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
from app.models.enums import PhysicalInterviewResult
from app.models.physical_interview import PhysicalInterviewBatch, PhysicalInterviewInvite
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
