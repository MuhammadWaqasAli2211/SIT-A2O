"""Access control on the AI Interviewer integration.

The failure that matters here is an admin — or worse, a candidate — seeing
something they should not, so these tests push on the boundaries rather than
the happy paths: a demoted user holding a stale grant, an ungranted write, and
the candidate response shape itself.
"""

import uuid

import pytest

from app.core.exceptions import ConflictError, PermissionDeniedError
from app.models.enums import AiScope, UserRole
from app.models.user import Profile
from app.schemas.ai_interview import CandidateScore
from app.services import permission_service
from app.services.ai_interview_service import _identity_of, extract_score, is_completed


class GrantSession:
    """Returns whatever grant rows it was constructed with, and counts reads
    so a test can prove a lookup did not happen."""

    def __init__(self, scopes=()):
        self._scopes = list(scopes)
        self.queried = 0

    def scalars(self, stmt):
        self.queried += 1
        return list(self._scopes)


def profile(role: UserRole) -> Profile:
    return Profile(id=uuid.uuid4(), email=f"{role.value.lower()}@example.com", role=role)


# ------------------------------------------------------------ scope reads --


def test_super_admin_holds_every_scope_without_a_query():
    session = GrantSession()

    assert permission_service.granted_scopes(session, profile(UserRole.SUPER_ADMIN)) == set(
        AiScope
    )
    assert session.queried == 0


def test_admin_holds_only_what_was_granted():
    session = GrantSession([AiScope.INVITES_SEND])

    assert permission_service.granted_scopes(session, profile(UserRole.ADMIN)) == {
        AiScope.INVITES_SEND
    }


def test_admin_holds_nothing_by_default():
    """The hard default: read-only until a super admin says otherwise."""
    session = GrantSession([])

    assert permission_service.granted_scopes(session, profile(UserRole.ADMIN)) == set()


def test_a_demoted_user_loses_every_scope_even_with_rows_left_behind():
    """A grant row outliving the admin role must not keep working — the role
    is checked before the table is, so a demotion takes effect immediately."""
    session = GrantSession([AiScope.INTERVIEWS_DELETE, AiScope.REINTERVIEW_DECIDE])

    assert permission_service.granted_scopes(session, profile(UserRole.CANDIDATE)) == set()
    assert session.queried == 0


# ------------------------------------------------------------- write gate --


def test_assert_scope_admits_a_granted_write():
    session = GrantSession([AiScope.REINTERVIEW_DECIDE])
    permission_service.assert_scope(session, profile(UserRole.ADMIN), AiScope.REINTERVIEW_DECIDE)


def test_assert_scope_refuses_an_ungranted_write():
    session = GrantSession([AiScope.INVITES_SEND])

    with pytest.raises(PermissionDeniedError, match="Delete AI interviews"):
        permission_service.assert_scope(
            session, profile(UserRole.ADMIN), AiScope.INTERVIEWS_DELETE
        )


def test_holding_one_scope_does_not_imply_another():
    """Grants are per-scope, not a single write bit."""
    session = GrantSession([AiScope.INVITES_SEND])
    admin = profile(UserRole.ADMIN)

    assert permission_service.has_scope(session, admin, AiScope.INVITES_SEND)
    assert not permission_service.has_scope(session, admin, AiScope.CANDIDATES_WRITE)
    assert not permission_service.has_scope(session, admin, AiScope.REINTERVIEW_DECIDE)


def test_a_candidate_is_refused_every_write():
    session = GrantSession([])
    candidate = profile(UserRole.CANDIDATE)

    for scope in AiScope:
        with pytest.raises(PermissionDeniedError):
            permission_service.assert_scope(session, candidate, scope)


# ------------------------------------------------------------- assignment --


class LookupSession:
    def __init__(self, found: Profile | None):
        self._found = found

    def get(self, model, pk):
        return self._found


def test_an_ungranted_delete_is_refused_before_the_external_service_is_called(monkeypatch):
    """Order matters, not just the outcome.

    Checking bootcamp scope first means fetching the record, which tells an
    admin holding no delete grant whether an id exists — a 404 for one that
    does not, a 403 for one that does. The permission check has to come first
    so both answer the same way.
    """
    from app.integrations import interviewer_ai
    from app.services import ai_interview_service

    called: list[int] = []
    monkeypatch.setattr(
        interviewer_ai, "get_interview", lambda i: called.append(i) or {"id": i}
    )

    with pytest.raises(PermissionDeniedError):
        ai_interview_service.delete_interview(GrantSession([]), 1234, profile(UserRole.ADMIN))

    assert called == [], "the external service was called before the permission check"


@pytest.mark.parametrize("role", [UserRole.CANDIDATE, UserRole.SUPER_ADMIN])
def test_permissions_can_only_be_granted_to_an_administrator(role):
    """A candidate must never hold one, and a super admin already holds all
    of them — either way the row would mean something untrue."""
    session = LookupSession(profile(role))

    with pytest.raises(ConflictError, match="only be granted to an administrator"):
        permission_service._get_admin(session, uuid.uuid4())


# ------------------------------------------ the candidate-facing boundary --


def test_candidate_score_cannot_carry_evidence():
    """The whole point of the narrow schema.

    Even handed a payload full of things a candidate must never see, the
    model keeps only the four fields it declares — so a wider dict arriving
    from upstream cannot leak through this boundary.
    """
    leaked = CandidateScore.model_validate(
        {
            "status": "completed",
            "score": 82.0,
            "recording_url": "https://example.com/session.mp4",
            "proctor_snapshots": [{"id": 1, "url": "https://example.com/snap.jpg"}],
            "questions": [{"prompt": "Explain a deadlock", "answer": "..."}],
            "transcript": "the full spoken transcript",
            "audit": [{"action": "flagged"}],
        }
    )

    dumped = leaked.model_dump()
    # Pinned deliberately: widening what a candidate can see should fail here
    # first and be changed on purpose, not drift in behind a serializer edit.
    assert set(dumped) == {
        "status",
        "score",
        "scale",
        "completed_at",
        "deadline_at",
        "can_explain",
        "explanation_sent",
        "passed",
    }
    for forbidden in ("recording_url", "proctor_snapshots", "questions", "transcript", "audit"):
        assert forbidden not in dumped


def test_candidate_score_reports_a_missing_score_as_absent_not_zero():
    """Showing a candidate 0 because we could not find their score would be
    worse than telling them it is not available."""
    assert CandidateScore.model_validate({"status": "in_progress"}).score is None


# --------------------------------------------- defensive external parsing --


@pytest.mark.parametrize(
    "payload",
    [
        {"overall_score": 74},
        {"final_score": 74.0},
        {"total_score": "74"},
        {"score": 74},
        {"percentage": "74%"},
        {"scoring": {"overall_score": 74}},
        {"report": {"score": 74}},
    ],
)
def test_a_score_is_found_under_any_of_the_plausible_keys(payload):
    """Their responses are undocumented, so the parser accepts the shapes it
    might reasonably meet rather than committing to one that may not exist."""
    assert extract_score(payload) == 74.0


@pytest.mark.parametrize("payload", [{}, None, {"status": "completed"}, {"score": None}, []])
def test_no_recognisable_score_yields_none(payload):
    assert extract_score(payload) is None


def test_a_boolean_is_not_mistaken_for_a_score():
    """`bool` is an `int` in Python; True must not become a score of 1.0."""
    assert extract_score({"score": True}) is None


@pytest.mark.parametrize("status", ["completed", "complete", "Finished", "DONE", "evaluated"])
def test_completion_is_recognised_across_spellings(status):
    assert is_completed({"status": status})


@pytest.mark.parametrize("status", ["in_progress", "invited", "", "pending"])
def test_unfinished_interviews_are_not_completed(status):
    assert not is_completed({"status": status})


@pytest.mark.parametrize(
    ("record", "expected"),
    [
        ({"candidate": {"id": 271, "email": "A@Example.com"}}, (271, "A@Example.com")),
        ({"candidate_id": 271, "candidate_email": "a@example.com"}, (271, "a@example.com")),
        ({"user_id": "271", "email": "a@example.com"}, (271, "a@example.com")),
        ({}, (None, None)),
    ],
)
def test_candidate_identity_is_read_from_whichever_shape_arrives(record, expected):
    """The correlation key. If this misreads, an interview either goes
    unmatched or — the case that matters — matches the wrong bootcamp."""
    assert _identity_of(record) == expected
