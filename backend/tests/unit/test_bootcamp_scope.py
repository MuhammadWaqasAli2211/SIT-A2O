"""Bootcamp scope enforcement.

`assert_can_manage` is the only thing stopping an admin from reaching another
intake's candidates by changing the id in a URL. It was previously covered by
nothing but its own docstring.
"""

import uuid

import pytest

from app.core.exceptions import PermissionDeniedError
from app.models.bootcamp import BootcampAdmin
from app.models.enums import UserRole
from app.models.user import Profile
from app.services.bootcamp_service import assert_can_manage

OWN = uuid.uuid4()
SOMEONE_ELSES = uuid.uuid4()


class ScopedSession:
    """Returns an assignment row only for the bootcamp the admin actually runs.

    Stands in for the real query, which filters on both bootcamp_id and
    profile_id; the fake keys off the id captured at construction.
    """

    def __init__(self, assigned_to: uuid.UUID | None):
        self._assigned_to = assigned_to
        self.queried = 0

    def scalar(self, stmt):
        self.queried += 1
        wanted = [
            b.right.value
            for b in stmt.whereclause.clauses
            if getattr(b.left, "name", None) == "bootcamp_id"
        ]
        if self._assigned_to is not None and wanted and wanted[0] == self._assigned_to:
            return BootcampAdmin(bootcamp_id=self._assigned_to, profile_id=uuid.uuid4())
        return None


def profile(role: UserRole) -> Profile:
    return Profile(id=uuid.uuid4(), email=f"{role.value.lower()}@example.com", role=role)


def test_super_admin_reaches_any_bootcamp_without_a_query():
    """Global by definition — and it should not cost a lookup to prove it."""
    session = ScopedSession(assigned_to=None)

    assert_can_manage(session, profile(UserRole.SUPER_ADMIN), SOMEONE_ELSES)

    assert session.queried == 0


def test_admin_reaches_their_own_bootcamp():
    session = ScopedSession(assigned_to=OWN)
    assert_can_manage(session, profile(UserRole.ADMIN), OWN)


def test_admin_is_refused_another_bootcamp():
    """The URL-tampering case."""
    session = ScopedSession(assigned_to=OWN)

    with pytest.raises(PermissionDeniedError, match="not assigned"):
        assert_can_manage(session, profile(UserRole.ADMIN), SOMEONE_ELSES)


def test_unassigned_admin_is_refused_everything():
    session = ScopedSession(assigned_to=None)

    with pytest.raises(PermissionDeniedError):
        assert_can_manage(session, profile(UserRole.ADMIN), OWN)
