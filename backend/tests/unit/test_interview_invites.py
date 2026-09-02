"""AI interview invite batch-status parsing and program-to-category mapping.

No network calls here. The InterviewerAI client itself is untested by
integration in this suite — it was verified against the live service
directly, see docs/development-logs.md.
"""

from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.core.exceptions import ConflictError
from app.integrations import interviewer_ai
from app.models.enums import InviteBatchStatus
from app.services.interview_invite_service import (
    DIFFICULTY_LABEL,
    _batch_status_from,
    _category_for,
    _format_deadline,
    _resolve_deadline,
)


@pytest.mark.parametrize(
    ("slug", "category"),
    [
        ("web-development", "Web and Mobile App Development"),
        ("mobile-development", "Web and Mobile App Development"),
        ("data-science", "AI"),
        ("cloud-devops", "Cloud & Data Engineering"),
        ("ui-ux-design", "Graphics and UI/UX Design"),
    ],
)
def test_program_maps_to_its_category(slug, category):
    assert _category_for(slug) == category


def test_an_unmapped_program_is_a_conflict_not_a_crash():
    """A new program slug added later without updating the map should surface
    as something an admin can act on, not a 500."""
    with pytest.raises(ConflictError):
        _category_for("some-future-track")


def test_documented_status_values_parse():
    assert _batch_status_from("pending", InviteBatchStatus.PENDING) == InviteBatchStatus.PENDING
    assert _batch_status_from("sending", InviteBatchStatus.PENDING) == InviteBatchStatus.SENDING
    assert (
        _batch_status_from("completed", InviteBatchStatus.PENDING) == InviteBatchStatus.COMPLETED
    )


def test_the_live_apis_actual_spelling_also_parses():
    """The API's own docs say "completed"; the live service returns "complete"
    (verified against a real batch, 2026-08-27). Both must resolve the same
    way, since trusting either source alone would misparse the other."""
    assert (
        _batch_status_from("complete", InviteBatchStatus.PENDING) == InviteBatchStatus.COMPLETED
    )


def test_an_unrecognised_status_falls_back_rather_than_raising():
    """A status string this service has never seen must not fail a poll —
    the batch's counts are still worth updating even if its label is not
    understood yet."""
    assert (
        _batch_status_from("something-new", InviteBatchStatus.SENDING)
        == InviteBatchStatus.SENDING
    )


def test_a_missing_status_falls_back_too():
    assert _batch_status_from(None, InviteBatchStatus.PENDING) == InviteBatchStatus.PENDING


# ------------------------------------------------------------- difficulty --


def test_difficulty_labels_pin_the_three_values_their_api_accepts():
    """Verified against the live API 2026-09-01. Anything outside these three
    is swallowed by their untyped request body and silently ignored, so a
    fourth key here would mean showing an admin a difficulty that was never
    applied."""
    assert set(DIFFICULTY_LABEL) == {"EASY_TO_MEDIUM", "MEDIUM_TO_HARD", "EASY_TO_HARD"}


def test_difficulty_is_stamped_on_every_row(monkeypatch):
    """Per row, not top-level: per-row is the placement that was actually
    tested end to end (probe batch 34 -> candidate 277)."""
    captured: dict = {}

    def fake_post(self, url, headers=None, json=None):  # noqa: ANN001
        captured.update(json)
        return _FakeResponse()

    monkeypatch.setattr(httpx.Client, "post", fake_post)
    interviewer_ai.send_bulk_invite(
        subject="s",
        rows=[{"name": "A", "email": "a@example.com"}, {"name": "B", "email": "b@example.com"}],
        question_difficulty="MEDIUM_TO_HARD",
    )

    assert [r["questionDifficulty"] for r in captured["rows"]] == [
        "MEDIUM_TO_HARD",
        "MEDIUM_TO_HARD",
    ]


def test_no_difficulty_means_the_key_is_absent_not_null(monkeypatch):
    """Their worker reads the key when present. Sending an explicit null would
    be a value they have never been tested with; omitting it is the state
    every batch before this feature was sent in."""
    captured: dict = {}

    def fake_post(self, url, headers=None, json=None):  # noqa: ANN001
        captured.update(json)
        return _FakeResponse()

    monkeypatch.setattr(httpx.Client, "post", fake_post)
    interviewer_ai.send_bulk_invite(
        subject="s", rows=[{"name": "A", "email": "a@example.com"}], question_difficulty=None
    )

    assert "questionDifficulty" not in captured["rows"][0]


class _FakeResponse:
    status_code = 200
    is_success = True
    text = ""

    def json(self):
        return {"batch": {"id": 1, "status": "pending"}}


# --------------------------------------------------------------- deadline --


def _phase_deadline(days: int = 7) -> datetime:
    return datetime.now(UTC) + timedelta(days=days)


def test_no_chosen_deadline_falls_back_to_the_phase_deadline():
    """What every batch did before the deadline became selectable."""
    phase = _phase_deadline()
    assert _resolve_deadline(None, phase) == phase


def test_a_deadline_inside_the_phase_window_is_kept_with_its_time_of_day():
    """The time half is the point — their API has no deadline concept at all,
    so this is ours to enforce and ours to state precisely."""
    phase = _phase_deadline(days=10)
    chosen = datetime.now(UTC) + timedelta(days=3, hours=5)
    assert _resolve_deadline(chosen, phase) == chosen


def test_a_deadline_past_the_phase_deadline_is_refused():
    """An invite outliving its own phase would pass our expiry check while
    assert_phase_open refused everything around it."""
    phase = _phase_deadline(days=2)
    with pytest.raises(ConflictError, match="cannot be later than"):
        _resolve_deadline(phase + timedelta(days=1), phase)


def test_a_deadline_in_the_past_is_refused():
    with pytest.raises(ConflictError, match="must be in the future"):
        _resolve_deadline(datetime.now(UTC) - timedelta(hours=1), _phase_deadline())


def test_a_naive_deadline_is_read_as_utc_rather_than_raising():
    """A client that sends no timezone must not blow up the comparison against
    an aware phase deadline."""
    phase = _phase_deadline(days=10)
    naive = (datetime.now(UTC) + timedelta(days=1)).replace(tzinfo=None)
    assert _resolve_deadline(naive, phase).tzinfo is not None


def test_the_formatted_deadline_carries_a_time_not_just_a_date():
    """A candidate told only the date will assume they have until midnight."""
    formatted = _format_deadline(datetime(2026, 8, 12, 14, 30, tzinfo=UTC))
    assert "12 August 2026" in formatted
    assert "14:30" in formatted


def test_a_batch_with_no_deadline_says_so_rather_than_printing_none():
    assert "None" not in _format_deadline(None)
