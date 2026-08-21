"""Self-service profile editing.

The point of a separate schema from the admin one is that a candidate editing
their own phone number can never reach a privilege field. That is a claim
worth a test rather than a comment.
"""

import uuid

import pytest
from pydantic import ValidationError

from app.models.enums import UserRole
from app.models.user import Profile
from app.schemas.user import ProfileUpdate, SelfProfileUpdate
from app.services import user_service


class FakeSession:
    def __init__(self, clash=None):
        self._clash = clash
        self.added = []

    def scalar(self, _stmt):
        return self._clash

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        pass


@pytest.fixture
def candidate():
    return Profile(
        id=uuid.uuid4(),
        email="ayesha@example.com",
        full_name="Ayesha Khan",
        role=UserRole.CANDIDATE,
        is_active=True,
    )


# ------------------------------------------------------- privilege fields --


@pytest.mark.parametrize("field", ["role", "is_active", "email"])
def test_self_update_cannot_reach_privilege_fields(field):
    """The whole reason this schema exists separately from ProfileUpdate."""
    assert field not in SelfProfileUpdate.model_fields


@pytest.mark.parametrize("field", ["role", "is_active"])
def test_admin_update_cannot_reach_them_either(field):
    """Both edit paths exclude them; role and status have their own endpoints."""
    assert field not in ProfileUpdate.model_fields


def test_unknown_fields_are_ignored_not_applied():
    """A hand-crafted body naming `role` must not smuggle it through."""
    payload = SelfProfileUpdate.model_validate(
        {"full_name": "New Name", "role": "SUPER_ADMIN", "is_active": False}
    )
    dumped = payload.model_dump(exclude_unset=True)

    assert dumped == {"full_name": "New Name"}


# ------------------------------------------------------- partial-ness --


def test_only_sent_fields_are_applied(candidate):
    session = FakeSession()

    user_service.update_own_profile(
        session, candidate, SelfProfileUpdate(full_name="Ayesha S. Khan")
    )

    assert candidate.full_name == "Ayesha S. Khan"
    assert candidate.email == "ayesha@example.com"


def test_omitted_phone_is_left_alone(candidate):
    candidate.phone = "03001234567"
    session = FakeSession()

    user_service.update_own_profile(session, candidate, SelfProfileUpdate(full_name="X"))

    assert candidate.phone == "03001234567"


def test_explicit_null_clears_a_field(candidate):
    candidate.phone = "03001234567"
    session = FakeSession()

    user_service.update_own_profile(
        session, candidate, SelfProfileUpdate.model_validate({"phone": None})
    )

    assert candidate.phone is None


def test_the_edit_is_audited_against_the_user_themselves(candidate):
    session = FakeSession()

    user_service.update_own_profile(
        session, candidate, SelfProfileUpdate(full_name="Renamed")
    )

    entry = next(o for o in session.added if o.__class__.__name__ == "AuditLog")
    assert entry.action == "profile.self_update"
    # Actor and subject are the same person on this path.
    assert entry.actor_id == candidate.id
    assert entry.entity_id == candidate.id


def test_candidate_fields_create_the_row_on_demand(candidate):
    """Admins never get a candidate_profile row, so it may not exist yet."""
    session = FakeSession()
    assert candidate.candidate_profile is None

    user_service.update_own_profile(
        session, candidate, SelfProfileUpdate(city="Karachi")
    )

    created = next(
        o for o in session.added if o.__class__.__name__ == "CandidateProfile"
    )
    assert created.city == "Karachi"


# ------------------------------------------------------------ validation --


@pytest.mark.parametrize(
    "payload",
    [
        {"full_name": ""},
        {"full_name": "x" * 151},
        {"phone": "x" * 31},
        {"cnic": "x" * 21},
        {"city": "x" * 81},
    ],
)
def test_field_limits_are_enforced(payload):
    with pytest.raises(ValidationError):
        SelfProfileUpdate.model_validate(payload)
