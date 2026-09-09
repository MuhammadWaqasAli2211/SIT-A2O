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


# Student rows: (candidate_code, email, full_name, program_title)
STUDENTS = [
    ("B08-001", "one@example.com", "Ayesha Khan", "Web Dev"),
    ("B08-002", "two@example.com", None, "Web Dev"),
    ("B08-003", "three@example.com", "Bilal Ahmed", None),
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


def test_invites_before_provisioning_are_refused(monkeypatch):
    called = []
    monkeypatch.setattr(
        agilytics_service.agilytics, "bulk_invite", lambda wid: called.append(wid) or {}
    )
    target = bootcamp()

    with pytest.raises(ConflictError):
        agilytics_service.send_invites(FakeSession(target), profile(), target.id)

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
        {"email": "one@example.com", "fullName": "Ayesha Khan", "trackName": "Web Dev"},
        # No name on file — the candidate code is the one identifier we can
        # always produce, and an empty fullName is refused by their validator.
        {"email": "two@example.com", "fullName": "B08-002", "trackName": "Web Dev"},
        # No program — trackName omitted rather than sent as null.
        {"email": "three@example.com", "fullName": "Bilal Ahmed"},
    ]


def test_tracks_are_deduplicated_from_the_students_programs(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "provision_workspace",
        lambda **k: captured.update(k) or {"workspaceId": "w-1", "summary": {}},
    )
    target = bootcamp()

    agilytics_service.provision(FakeSession(target, STUDENTS, LEADS), profile(), target.id)

    assert captured["tracks"] == ["Web Dev"]


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
            "tracksCreated": ["Web Dev"],
            "summary": {"leadsProvisioned": 1, "studentsProvisioned": 3},
        },
    )
    target = bootcamp()
    session = FakeSession(target, STUDENTS, LEADS)

    result = agilytics_service.provision(session, profile(), target.id)

    assert target.agilytics_workspace_id == "d8c42c93-abc"
    assert session.committed
    assert result.students == 3
    assert result.already_provisioned is True


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


def test_invites_report_what_was_issued(monkeypatch):
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "bulk_invite",
        lambda wid: {"invitesIssued": 15, "expiresAt": "2026-09-12T00:00:00.000Z"},
    )
    target = bootcamp(agilytics_workspace_id="w-1")

    result = agilytics_service.send_invites(FakeSession(target), profile(), target.id)

    assert result == {
        "invites_issued": 15,
        "expires_at": "2026-09-12T00:00:00.000Z",
        "emailed": 0,
        "email_failed": 0,
    }


def test_a_selection_never_reaches_agilytics(monkeypatch):
    """The trap this guards: their bulk-invite takes no member list and always
    covers every pending member. If a selection ever appeared to narrow it,
    an admin would believe they invited three people when they invited all."""
    seen = {}
    monkeypatch.setattr(
        agilytics_service.agilytics,
        "bulk_invite",
        lambda *args, **kwargs: seen.update(args=args, kwargs=kwargs)
        or {"invitesIssued": 9},
    )
    monkeypatch.setattr(
        agilytics_service.email_service,
        "send_to_applications",
        lambda *a, **k: _EmailResult(sent=3, failed=0),
    )
    target = bootcamp(agilytics_workspace_id="w-1")

    result = agilytics_service.send_invites(
        FakeSession(target),
        profile(),
        target.id,
        application_ids=[uuid.uuid4(), uuid.uuid4(), uuid.uuid4()],
        subject="Hello",
        body_html="<p>Hi</p>",
    )

    # Only the workspace id — no member list of any kind.
    assert seen == {"args": ("w-1",), "kwargs": {}}
    assert result["invites_issued"] == 9
    assert result["emailed"] == 3


def test_no_covering_email_is_sent_when_none_was_composed(monkeypatch):
    """Invites-only is a real choice, not a degraded one — an intake whose
    candidates have already been told does not need telling again."""
    monkeypatch.setattr(
        agilytics_service.agilytics, "bulk_invite", lambda wid: {"invitesIssued": 4}
    )
    called = []
    monkeypatch.setattr(
        agilytics_service.email_service,
        "send_to_applications",
        lambda *a, **k: called.append(1) or _EmailResult(0, 0),
    )
    target = bootcamp(agilytics_workspace_id="w-1")

    result = agilytics_service.send_invites(
        FakeSession(target), profile(), target.id, application_ids=[uuid.uuid4()]
    )

    assert called == [], "no body composed means no email"
    assert result["emailed"] == 0


def test_email_failures_are_reported_not_swallowed(monkeypatch):
    monkeypatch.setattr(
        agilytics_service.agilytics, "bulk_invite", lambda wid: {"invitesIssued": 2}
    )
    monkeypatch.setattr(
        agilytics_service.email_service,
        "send_to_applications",
        lambda *a, **k: _EmailResult(sent=1, failed=2),
    )
    target = bootcamp(agilytics_workspace_id="w-1")

    result = agilytics_service.send_invites(
        FakeSession(target),
        profile(),
        target.id,
        application_ids=[uuid.uuid4()],
        body_html="<p>Hi</p>",
    )

    assert (result["emailed"], result["email_failed"]) == (1, 2)


class _EmailResult:
    def __init__(self, sent, failed):
        self.sent = sent
        self.failed = failed


def test_zero_pending_members_is_a_normal_answer(monkeypatch):
    """Not an error: an intake whose members are all approved has nobody left
    to invite, and saying so is the correct outcome."""
    monkeypatch.setattr(
        agilytics_service.agilytics, "bulk_invite", lambda wid: {"invitesIssued": 0}
    )
    target = bootcamp(agilytics_workspace_id="w-1")

    assert agilytics_service.send_invites(FakeSession(target), profile(), target.id)[
        "invites_issued"
    ] == 0


# -------------------------------------------------------------- preview --


def test_preview_sends_nothing(monkeypatch):
    """It exists precisely so the admin can look before acting."""
    sent = []
    monkeypatch.setattr(
        agilytics_service.agilytics, "provision_workspace", lambda **k: sent.append(k) or {}
    )
    target = bootcamp()

    result = agilytics_service.preview(FakeSession(target, STUDENTS, LEADS), profile(), target.id)

    assert sent == []
    assert (result.students, result.leads) == (3, 1)
    assert result.already_provisioned is False
    # Whose accounts get created on their side, shown before the button.
    assert result.lead_emails == ["admin@example.com"]
