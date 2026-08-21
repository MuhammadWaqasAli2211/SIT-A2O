"""Partial-update semantics.

An omitted field and an explicitly-null field mean different things, and
conflating them is how a phase quietly lost its deadline: `PATCH` with only
`opens_at` used to assign `deadline_at = None`, removing the gate that closes
registration. These tests pin the distinction down at both layers.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.exceptions import ConflictError
from app.models.bootcamp import BootcampPhase
from app.models.enums import PhaseType, UserRole
from app.models.user import Profile
from app.schemas.bootcamp import PhaseUpdate
from app.services import bootcamp_service

NOW = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)
DEADLINE = NOW + timedelta(days=14)


class FakeSession:
    """Just enough Session for the service functions under test."""

    def __init__(self, row):
        self._row = row
        self.added = []

    def scalar(self, _stmt):
        return self._row

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        pass


@pytest.fixture
def actor():
    return Profile(id=uuid.uuid4(), email="admin@example.com", role=UserRole.SUPER_ADMIN)


@pytest.fixture
def phase_row():
    return BootcampPhase(
        id=uuid.uuid4(),
        bootcamp_id=uuid.uuid4(),
        phase=PhaseType.REGISTRATION,
        is_open=True,
        opens_at=NOW,
        deadline_at=DEADLINE,
    )


# ------------------------------------------------------------- schema level --


def test_omitted_field_is_not_in_the_dump():
    payload = PhaseUpdate(opens_at=NOW)
    assert payload.model_dump(exclude_unset=True) == {"opens_at": NOW}


def test_explicit_null_is_in_the_dump():
    """Sending null must be distinguishable from sending nothing."""
    payload = PhaseUpdate.model_validate({"deadline_at": None})
    assert payload.model_dump(exclude_unset=True) == {"deadline_at": None}


# ------------------------------------------------------------ service level --


def test_editing_only_opens_at_preserves_the_deadline(phase_row, actor):
    """The regression this whole module exists for."""
    session = FakeSession(phase_row)
    new_open = NOW - timedelta(days=1)

    bootcamp_service.update_phase_window(
        session, phase_row.bootcamp_id, PhaseType.REGISTRATION,
        PhaseUpdate(opens_at=new_open), actor,
    )

    assert phase_row.opens_at == new_open
    assert phase_row.deadline_at == DEADLINE, "the untouched deadline was wiped"


def test_explicit_null_clears_the_deadline(phase_row, actor):
    session = FakeSession(phase_row)

    bootcamp_service.update_phase_window(
        session, phase_row.bootcamp_id, PhaseType.REGISTRATION,
        PhaseUpdate.model_validate({"deadline_at": None}), actor,
    )

    assert phase_row.deadline_at is None
    assert phase_row.opens_at == NOW, "opens_at should not have been touched"


def test_empty_payload_changes_nothing(phase_row, actor):
    session = FakeSession(phase_row)

    bootcamp_service.update_phase_window(
        session, phase_row.bootcamp_id, PhaseType.REGISTRATION, PhaseUpdate(), actor,
    )

    assert phase_row.opens_at == NOW
    assert phase_row.deadline_at == DEADLINE


def test_deadline_before_opening_is_rejected(phase_row, actor):
    """Caught in the service so the message names the problem, not the constraint."""
    session = FakeSession(phase_row)

    with pytest.raises(ConflictError, match="after the opening"):
        bootcamp_service.update_phase_window(
            session, phase_row.bootcamp_id, PhaseType.REGISTRATION,
            PhaseUpdate(deadline_at=NOW - timedelta(days=1)), actor,
        )


def test_the_change_is_audited(phase_row, actor):
    session = FakeSession(phase_row)

    bootcamp_service.update_phase_window(
        session, phase_row.bootcamp_id, PhaseType.REGISTRATION,
        PhaseUpdate(opens_at=NOW - timedelta(days=1)), actor,
    )

    entry = next(o for o in session.added if o.__class__.__name__ == "AuditLog")
    assert entry.action == "phase.update_window"
    assert entry.actor_id == actor.id
    assert "opens_at" in entry.metadata_["changes"]
