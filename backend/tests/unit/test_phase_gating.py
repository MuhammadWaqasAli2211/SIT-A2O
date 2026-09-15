"""Deadline enforcement is the rule the whole workflow depends on.

A phase is open only when the flag is set *and* the clock agrees — an expired
deadline must close a phase even if nobody clicked anything.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.bootcamp import BootcampPhase
from app.models.enums import PhaseType
from app.services.bootcamp_service import is_phase_open, phase_closure

NOW = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)


def phase(**kwargs) -> BootcampPhase:
    defaults = {
        "phase": PhaseType.REGISTRATION,
        "is_open": True,
        "opens_at": None,
        "deadline_at": None,
        "closed_at": None,
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


# ------------------------------------------------------- phase_closure() --
# The opt-out gate behind the Student's Folder, as distinct from the opt-in
# gate above. `is_phase_open` treats a phase nobody has configured as shut;
# this one must not, or every candidate already in onboarding is locked out
# the moment the gate ships.


def closed_by_admin(**kwargs) -> BootcampPhase:
    """What `set_phase_open(is_open=False)` leaves behind."""
    return phase(is_open=False, closed_at=NOW - timedelta(hours=1), **kwargs)


def test_an_untouched_phase_gates_nothing():
    """Every phase is created flag-false with no dates. That is 'nobody has
    decided anything', not 'closed'."""
    assert phase_closure(phase(is_open=False), now=NOW) is None


def test_a_manual_close_gates():
    assert phase_closure(closed_by_admin(), now=NOW) == "closed"


def test_a_manual_close_beats_a_deadline_that_has_not_arrived():
    """The reported bug, stated as a test: closing early must take effect at
    once rather than waiting for the deadline to come round."""
    row = closed_by_admin(deadline_at=NOW + timedelta(days=3))
    assert phase_closure(row, now=NOW) == "closed"


def test_a_passed_deadline_gates_without_anyone_clicking():
    row = phase(deadline_at=NOW - timedelta(seconds=1))
    assert phase_closure(row, now=NOW) == "expired"


def test_a_future_deadline_alone_does_not_gate():
    row = phase(deadline_at=NOW + timedelta(days=1))
    assert phase_closure(row, now=NOW) is None


def test_reopening_clears_a_manual_close():
    """`set_phase_open(is_open=True)` nulls closed_at, so a reopened phase
    stops gating even though it was closed a moment ago."""
    row = phase(is_open=True, closed_at=None, deadline_at=NOW + timedelta(days=1))
    assert phase_closure(row, now=NOW) is None


def test_reopening_cannot_outrun_a_passed_deadline():
    """Consistent with the phases screen, which tells the admin to extend the
    deadline rather than pretending the toggle was enough."""
    row = phase(is_open=True, closed_at=None, deadline_at=NOW - timedelta(days=1))
    assert phase_closure(row, now=NOW) == "expired"
