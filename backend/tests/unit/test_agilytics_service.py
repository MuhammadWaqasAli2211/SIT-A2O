"""Provisioning guards and payload shaping.

The expensive mistake here is not a wrong count on a screen — it is a second
Agilytics workspace for an intake that already has one. Their provisioning
call is not idempotent and exposes no delete, so a duplicate cannot be
cleaned up from our side at all. Those guards get the most attention below.
"""

import uuid

import pytest

from app.core.exceptions import ConflictError, NotFoundError
from app.models.bootcamp import Bootcamp
from app.models.enums import UserRole
from app.models.user import Profile
from app.services import agilytics_service, audit_service, bootcamp_service


def profile(role: UserRole = UserRole.ADMIN) -> Profile:
    return Profile(id=uuid.uuid4(), email="admin@example.com", role=role)


def bootcamp(**overrides) -> Bootcamp:
    base = dict(
        id=uuid.uuid4(),
        name="Bootcamp 8",
        description="Q3 cohort",
        agilytics_workspace_id=None,
    )
    return Bootcamp(**{**base, **overrides})


class FakeSession:
    """Answers `get` with one bootcamp and `execute` with queued row sets."""

    def __init__(self, target: Bootcamp, *row_sets):
        self.target = target
        self._row_sets = list(row_sets)
        self.committed = False

    def get(self, _model, _pk):
        return self.target

    def execute(self, _stmt):
        rows = self._row_sets.pop(0) if self._row_sets else []
        return _Result(rows)

    def add(self, _entry):
        pass

    def commit(self):
        self.committed = True


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


@pytest.fixture(autouse=True)
def _allow_and_configure(monkeypatch):
    monkeypatch.setattr(bootcamp_service, "assert_can_manage", lambda *a, **k: None)
    monkeypatch.setattr(agilytics_service.agilytics.settings, "PORTAL_AGILYTICS_SECRET", "s")
    monkeypatch.setattr(
        agilytics_service.agilytics.settings, "AGILYTICS_API_BASE_URL", "https://a.test"
    )
    monkeypatch.setattr(audit_service, "record", lambda *a, **k: None)


# Student rows: (candidate_code, email, full_name). No program column —
# provisioning creates accounts, and their schema has no track field for it.
STUDENTS = [
    ("B08-001", "one@example.com", "Ayesha Khan"),
    ("B08-002", "two@example.com", None),
    ("B08-003", "three@example.com", "Bilal Ahmed"),
]
# Lead rows: (email, full_name)
LEADS = [("admin@example.com", "Sara Admin")]


# ------------------------------------------------------------- guards --


def test_provisioning_twice_is_refused(monkeypatch):
    """The guard that matters: their endpoint would create a second workspace
    with the same name, and neither can be deleted from our side."""
    target = bootcamp(agilytics_workspace_id="already-there")
    sent = []
    monkeypatch.setattr(
        agilytics_service.agilytics, "provision_workspace", lambda **k: sent.append(k) or {}
    )

    with pytest.raises(ConflictError) as caught:
        agilytics_service.provision(FakeSession(target), profile(), target.id)

    assert "already provisioned" in str(caught.value)
    assert sent == [], "nothing may be sent once a workspace exists"


def test_provisioning_an_empty_intake_is_refused(monkeypatch):
    sent = []
    monkeypatch.setattr(
        agilytics_service.agilytics, "provision_workspace", lambda **k: sent.append(k) or {}
    )
    target = bootcamp()

    with pytest.raises(ConflictError):
        agilytics_service.provision(FakeSession(target, [], []), profile(), target.id)

    assert sent == []


def test_a_response_without_a_workspace_id_is_surfaced_not_swallowed(monkeypatch):
    """Their side may well have created it; we just cannot address it. Storing
    None would report the intake as unprovisioned and invite a duplicate."""
    monkeypatch.setattr(
        agilytics_service.agilytics, "provision_workspace", lambda **k: {"summary": {}}
    )
    target = bootcamp()

    with pytest.raises(ConflictError) as caught:
        agilytics_service.provision(FakeSession(target, STUDENTS, LEADS), profile(), target.id)

    assert "no workspaceId" in str(caught.value)
    assert target.agilytics_workspace_id is None


def test_onboarding_before_provisioning_is_refused(monkeypatch):
    """There is no workspace to be a member of yet, and their endpoint is
    addressed by workspace id — so this is refused here rather than sent and
    404'd."""
    called = []
    monkeypatch.setattr(
        agilytics_service.agilytics, "onboard", lambda wid, students: called.append(wid) or {}
    )
    target = bootcamp()

    with pytest.raises(ConflictError):
        agilytics_service.onboard(
            FakeSession(target), profile(), target.id, application_ids=[uuid.uuid4()]
        )

    assert called == []


def test_member_status_before_provisioning_is_a_not_found():
    target = bootcamp()

    with pytest.raises(NotFoundError):
        agilytics_service.member_status(
            FakeSession(target), profile(), target.id, "x@example.com"
        )


# -------------------------------------------------------------- payload --


def test_students_are_sent_in_their_camel_case_shape(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "provision_workspace",
        lambda **k: captured.update(k) or {"workspaceId": "w-1", "summary": {}},
    )
    target = bootcamp()

    agilytics_service.provision(FakeSession(target, STUDENTS, LEADS), profile(), target.id)

    assert captured["students"] == [
        {"email": "one@example.com", "fullName": "Ayesha Khan"},
        # No name on file — the candidate code is the one identifier we can
        # always produce, and an empty fullName is refused by their validator.
        {"email": "two@example.com", "fullName": "B08-002"},
        {"email": "three@example.com", "fullName": "Bilal Ahmed"},
    ]


def test_provisioning_sends_no_track_information(monkeypatch):
    """Tracks are pre-configured in their workspace and assigned per student
    at onboard time. Provisioning has no track field at all, so sending one
    would describe something that cannot happen."""
    captured = {}
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "provision_workspace",
        lambda **k: captured.update(k) or {"workspaceId": "w-1", "summary": {}},
    )
    target = bootcamp()

    agilytics_service.provision(FakeSession(target, STUDENTS, LEADS), profile(), target.id)

    assert "tracks" not in captured
    assert not any("trackName" in s for s in captured["students"])


def test_leads_are_the_intakes_own_admins(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "provision_workspace",
        lambda **k: captured.update(k) or {"workspaceId": "w-1", "summary": {}},
    )
    target = bootcamp()

    agilytics_service.provision(FakeSession(target, STUDENTS, LEADS), profile(), target.id)

    assert captured["leads"] == [{"email": "admin@example.com", "fullName": "Sara Admin"}]


def test_a_successful_provision_stores_the_id_and_commits(monkeypatch):
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "provision_workspace",
        lambda **k: {
            "workspaceId": "d8c42c93-abc",
            "summary": {
                "leadsProvisioned": 1,
                "students": {"total": 3, "newlyCreated": 2, "alreadyExisted": 1},
            },
        },
    )
    target = bootcamp()
    session = FakeSession(target, STUDENTS, LEADS)

    result = agilytics_service.provision(session, profile(), target.id)

    assert target.agilytics_workspace_id == "d8c42c93-abc"
    assert session.committed
    assert result.already_provisioned is True
    # Their split, reported as their split: re-running on a grown intake
    # should show mostly already-existed, and a total that does not add up is
    # the signal something is wrong.
    assert (result.students, result.students_created, result.students_already_existed) == (
        3,
        2,
        1,
    )


def test_their_student_summary_is_never_replaced_by_our_own_count(monkeypatch):
    """A missing key should leave a figure at zero, not quietly echo the
    request back as though it were their answer."""
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "provision_workspace",
        lambda **k: {"workspaceId": "w-1", "summary": {}},
    )
    target = bootcamp()

    result = agilytics_service.provision(
        FakeSession(target, STUDENTS, LEADS), profile(), target.id
    )

    assert (result.students_created, result.students_already_existed) == (0, 0)


# ---------------------------------------------------------------- state --


def test_an_unprovisioned_intake_reports_state_rather_than_erroring():
    """The screen must render 'not provisioned' as an ordinary state, not
    special-case a 404 on every page load before the button is pressed."""
    state = agilytics_service.workspace_state(FakeSession(bootcamp()), profile(), uuid.uuid4())

    assert state.provisioned is False
    assert state.workspace_id is None


def test_workspace_state_flattens_their_status_breakdown(monkeypatch):
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "onboarding_status",
        lambda wid, email=None: {
            "workspaceName": "Bootcamp 8",
            "totalMembers": 25,
            "statusBreakdown": {"approved": 18, "pending": 5},
            "leads": [
                {
                    "email": "Lead@Example.com",
                    "fullName": "Jane Doe",
                    "status": "APPROVED",
                }
            ],
        },
    )
    target = bootcamp(agilytics_workspace_id="w-1")

    state = agilytics_service.workspace_state(FakeSession(target), profile(), target.id)

    assert (state.total_members, state.approved, state.pending) == (25, 18, 5)
    # Lowercased, so a row's email matches regardless of how it was typed.
    assert state.members["lead@example.com"].status == "APPROVED"


# ---------------------------------------------------------------- stats --
# Their `/stats` endpoint, which is not the same thing as `onboarding-status`
# above and is modelled separately for that reason.


def test_an_unprovisioned_intake_reports_stats_rather_than_erroring():
    stats = agilytics_service.workspace_stats(FakeSession(bootcamp()), profile(), uuid.uuid4())

    assert stats.provisioned is False
    assert stats.tracks == []
    assert stats.activation is None


def test_stats_carries_every_breakdown_their_endpoint_reports(monkeypatch):
    """Including the three status buckets the older screen dropped: a member
    who left or was revoked is exactly what a completion figure must not
    quietly omit."""
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "stats",
        lambda wid: {
            "workspaceName": "Bootcamp 7",
            "totalMembers": 27,
            "roleBreakdown": {"leads": 1, "subLeads": 1, "students": 25},
            "statusBreakdown": {
                "approved": 22,
                "pending": 3,
                "left": 1,
                "rejected": 0,
                "revoked": 0,
            },
            "trackBreakdown": [
                {
                    "trackId": "abc-123",
                    "trackName": "Web Dev",
                    "totalStudents": 15,
                    "onboarded": 12,
                    "pending": 3,
                }
            ],
            "activationHealth": {"totalStudents": 25, "verified": 22, "unverified": 3},
        },
    )
    target = bootcamp(agilytics_workspace_id="w-1")

    stats = agilytics_service.workspace_stats(FakeSession(target), profile(), target.id)

    assert (stats.total_members, stats.students_count, stats.sub_leads_count) == (27, 25, 1)
    assert (stats.approved, stats.pending, stats.left) == (22, 3, 1)
    assert stats.activation.unverified == 3
    assert stats.tracks[0].track_name == "Web Dev"
    # The split their `/stats` reports and `onboarding-status` does not.
    assert (stats.tracks[0].onboarded, stats.tracks[0].pending) == (12, 3)


def test_stats_survives_a_response_missing_its_optional_blocks(monkeypatch):
    """Read defensively: a partner trimming a field should degrade one figure,
    not 500 the whole screen."""
    monkeypatch.setattr(
        agilytics_service.agilytics, "stats", lambda wid: {"workspaceName": "B7"}
    )
    target = bootcamp(agilytics_workspace_id="w-1")

    stats = agilytics_service.workspace_stats(FakeSession(target), profile(), target.id)

    assert stats.provisioned is True
    assert stats.tracks == []
    assert stats.activation is None
    assert stats.approved is None


# -------------------------------------------------------------- preview --


def test_preview_sends_nothing(monkeypatch):
    """The confirm step reads real counts without creating anything — their
    provisioning call cannot be undone from our side."""
    called = []
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "provision_workspace",
        lambda **k: called.append(k) or {},
    )
    target = bootcamp()

    result = agilytics_service.preview(
        FakeSession(target, STUDENTS, LEADS), profile(), target.id
    )

    assert called == []
    assert (result.students, result.leads) == (3, 1)
    assert result.already_provisioned is False
    assert result.lead_emails == ["admin@example.com"]
