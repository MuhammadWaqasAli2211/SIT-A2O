"""AI interview invite batch-status parsing and program-to-category mapping.

No network calls here. The InterviewerAI client itself is untested by
integration in this suite — it was verified against the live service
directly, see docs/development-logs.md.
"""

import pytest

from app.core.exceptions import ConflictError
from app.models.enums import InviteBatchStatus
from app.services.interview_invite_service import _batch_status_from, _category_for


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
