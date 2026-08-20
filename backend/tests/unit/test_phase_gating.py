"""Deadline enforcement is the rule the whole workflow depends on.

A phase is open only when the flag is set *and* the clock agrees — an expired
deadline must close a phase even if nobody clicked anything.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.bootcamp import BootcampPhase
from app.models.enums import PhaseType
from app.services.bootcamp_service import is_phase_open

NOW = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)


def phase(**kwargs) -> BootcampPhase:
    defaults = {
        "phase": PhaseType.REGISTRATION,
        "is_open": True,
        "opens_at": None,
        "deadline_at": None,
    }
    return BootcampPhase(**{**defaults, **kwargs})


def test_open_flag_with_no_window_is_open():
    assert is_phase_open(phase(), now=NOW) is True


def test_closed_flag_is_never_open():
    assert is_phase_open(phase(is_open=False), now=NOW) is False


def test_closed_flag_beats_a_valid_window():
    """An admin closing early must win over the configured dates."""
    window = phase(
        is_open=False,
        opens_at=NOW - timedelta(days=1),
        deadline_at=NOW + timedelta(days=1),
    )
    assert is_phase_open(window, now=NOW) is False


def test_before_opens_at_is_not_open():
    assert is_phase_open(phase(opens_at=NOW + timedelta(hours=1)), now=NOW) is False


def test_after_deadline_is_not_open():
    """The critical case: the flag says open, but the deadline has passed."""
    assert is_phase_open(phase(deadline_at=NOW - timedelta(seconds=1)), now=NOW) is False


def test_inside_window_is_open():
    window = phase(
        opens_at=NOW - timedelta(days=2),
        deadline_at=NOW + timedelta(days=2),
    )
    assert is_phase_open(window, now=NOW) is True


@pytest.mark.parametrize(
    "offset,expected",
    [
        (timedelta(seconds=-1), True),   # a second before the deadline
        (timedelta(seconds=0), True),    # exactly on it
        (timedelta(seconds=1), False),   # a second after
    ],
)
def test_deadline_boundary(offset, expected):
    row = phase(deadline_at=NOW)
    assert is_phase_open(row, now=NOW + offset) is expected
