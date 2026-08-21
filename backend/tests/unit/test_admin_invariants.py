"""Invariants the admin surface must not let an operator break."""

import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.models.enums import InterviewStatus, UserRole
from app.schemas.bootcamp import ProgramCreate
from app.schemas.interview import InterviewUpdate
from app.schemas.user import StaffCreate
from app.services.audit_service import diff

NOW = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)


# ------------------------------------------------------- interview scoring --


def test_score_on_a_completed_interview_is_allowed():
    payload = InterviewUpdate(status=InterviewStatus.COMPLETED, score=82)
    assert payload.score == 82


@pytest.mark.parametrize(
    "status",
    [InterviewStatus.SCHEDULED, InterviewStatus.CANCELLED, InterviewStatus.NO_SHOW],
)
def test_score_without_completion_is_rejected(status):
    """Mirrors the DB CHECK so the caller gets 422 rather than a 500."""
    with pytest.raises(ValidationError, match="COMPLETED"):
        InterviewUpdate(status=status, score=70)


@pytest.mark.parametrize("score", [-1, 101])
def test_score_outside_the_scale_is_rejected(score):
    with pytest.raises(ValidationError):
        InterviewUpdate(status=InterviewStatus.COMPLETED, score=score)


def test_score_alone_is_allowed_at_schema_level():
    """The stored status is unknown here; the service re-checks the merged row."""
    assert InterviewUpdate(score=55).score == 55


# ------------------------------------------------------------ staff create --


def test_staff_password_has_a_floor():
    with pytest.raises(ValidationError):
        StaffCreate(
            email="a@b.com", password="short", full_name="A", role=UserRole.ADMIN
        )


def test_staff_defaults_to_admin_not_super_admin():
    """The safer default: privilege should be asked for, never assumed."""
    staff = StaffCreate(
        email="a@b.com", password="a-long-enough-password", full_name="A"
    )
    assert staff.role == UserRole.ADMIN


# ---------------------------------------------------------------- programs --


@pytest.mark.parametrize("slug", ["Web-Dev", "web dev", "web_dev", "-web", "web-"])
def test_invalid_slugs_are_rejected(slug):
    """The slug is the contract with the frontend's icon and curriculum map."""
    with pytest.raises(ValidationError):
        ProgramCreate(slug=slug, title="Title", tagline="Tagline")


@pytest.mark.parametrize("slug", ["web-development", "ai", "ui-ux-design", "web3"])
def test_valid_slugs_are_accepted(slug):
    assert ProgramCreate(slug=slug, title="Title", tagline="Tagline").slug == slug


def test_program_update_cannot_change_the_slug():
    from app.schemas.bootcamp import ProgramUpdate

    assert "slug" not in ProgramUpdate.model_fields


# --------------------------------------------------------------- audit diff --


def test_diff_reports_only_what_changed():
    before = {"name": "Bootcamp 07", "status": "DRAFT"}
    after = {"name": "Bootcamp 07", "status": "REG_OPEN"}

    assert diff(before, after) == {"status": {"from": "DRAFT", "to": "REG_OPEN"}}


def test_diff_is_empty_when_nothing_moved():
    assert diff({"a": 1}, {"a": 1}) == {}


def test_diff_stringifies_values_json_cannot_hold():
    """The column is jsonb; UUIDs and datetimes must not break the insert."""
    entity = uuid.uuid4()
    result = diff({"id": None, "when": None}, {"id": entity, "when": NOW})

    assert result["id"]["to"] == str(entity)
    assert isinstance(result["when"]["to"], str)


def test_diff_preserves_primitives_as_primitives():
    result = diff({"n": 0, "flag": False}, {"n": 5, "flag": True})

    assert result["n"]["to"] == 5
    assert result["flag"]["to"] is True
