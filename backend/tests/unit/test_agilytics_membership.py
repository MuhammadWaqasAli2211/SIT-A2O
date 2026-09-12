"""Per-candidate Agilytics membership: confirming invites, and detecting joins.

Their API gives us nothing per person for either operation — `bulk-invite`
answers with one aggregate count and the workspace-wide read reports students
as counts too. Everything worth testing here is therefore about what we do
with that absence: never stamping a candidate the workspace has not confirmed,
and never advancing a stage on anything short of an actual join.
"""

import uuid
from datetime import UTC, datetime

import pytest

from app.core.exceptions import ConflictError, NotFoundError, UpstreamError
from app.models.enums import ApplicationStage
from app.services import agilytics_service as svc


class FakeApplication:
    def __init__(self):
        self.agilytics_invited_at = None
        self.agilytics_joined_at = None


class FakeDb:
    """Enough Session for invite()/sync_joins(): row lookups and no-op writes."""

    def __init__(self, rows):
        self._rows = rows
        self.apps = {r[0]: FakeApplication() for r in rows}
        self.committed = False

    def get(self, _model, pk):
        return self.apps.get(pk)

    def add(self, _obj):
        pass

    def flush(self):
        pass

    def commit(self):
        self.committed = True


def row(code, *, invited=None, joined=None, email=None):
    """One `_eligible_rows` tuple: (id, code, invited_at, joined_at, email, name, track)."""
    return (
        uuid.uuid4(),
        code,
        invited,
        joined,
        email or f"{code.lower()}@example.com",
        f"Name {code}",
        "Web and App Development",
    )


@pytest.fixture
def wired(monkeypatch):
    """Stub the boundaries: our bootcamp lookup, their API, and the audit log."""
    class Bootcamp:
        id = uuid.uuid4()
        name = "Bootcamp 07"
        agilytics_workspace_id = "ws-1"

    monkeypatch.setattr(svc, "_bootcamp", lambda db, actor, bid: Bootcamp())
    monkeypatch.setattr(svc.audit_service, "record", lambda *a, **k: None)
    return Bootcamp


# ---------------------------------------------------------------- eligible --


def test_eligible_splits_on_the_invited_timestamp(monkeypatch, wired):
    rows = [row("B07-001"), row("B07-002", invited=datetime.now(UTC)), row("B07-003")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)

    out = svc.eligible(None, None, uuid.uuid4())

    assert [r.candidate_code for r in out.new] == ["B07-001", "B07-003"]
    assert [r.candidate_code for r in out.already_invited] == ["B07-002"]


# ------------------------------------------------------------------ invite --


def test_only_members_the_workspace_confirms_are_stamped(monkeypatch, wired):
    """The whole point of the per-member check. `invitesIssued` is an aggregate
    over the workspace and says nothing about who — stamping from it would mark
    candidates invited who were never added."""
    rows = [row("B07-001"), row("B07-002")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(svc.agilytics, "bulk_invite", lambda ws: {"invitesIssued": 9})
    # B07-002 is not in the workspace — the ordinary answer for somebody who
    # reached onboarding after provisioning.
    monkeypatch.setattr(
        svc,
        "_confirm_membership",
        lambda ws, email: "PENDING" if email.startswith("b07-001") else None,
    )

    db = FakeDb(rows)
    out = svc.invite(db, None, uuid.uuid4(), application_ids=[r[0] for r in rows])

    assert out.confirmed == ["B07-001"]
    assert out.not_in_workspace == ["B07-002"]
    assert db.apps[rows[0][0]].agilytics_invited_at is not None
    assert db.apps[rows[1][0]].agilytics_invited_at is None


def test_a_failed_check_leaves_the_candidate_retryable(monkeypatch, wired):
    """A missing stamp costs a second invite; a wrong one costs a candidate who
    is never invited again. The safe direction is not to stamp."""
    rows = [row("B07-001")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(svc.agilytics, "bulk_invite", lambda ws: {"invitesIssued": 1})

    def boom(ws, email):
        raise UpstreamError("Could not reach Agilytics.")

    monkeypatch.setattr(svc, "_confirm_membership", boom)

    db = FakeDb(rows)
    out = svc.invite(db, None, uuid.uuid4(), application_ids=[rows[0][0]])

    assert out.check_failed == ["B07-001"]
    assert out.confirmed == []
    assert db.apps[rows[0][0]].agilytics_invited_at is None


def test_already_invited_candidates_are_refused(monkeypatch, wired):
    """Duplicate prevention: re-running the flow over the same people is a
    conflict, not a second round of invites."""
    rows = [row("B07-001", invited=datetime.now(UTC))]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)

    with pytest.raises(ConflictError, match="already"):
        svc.invite(FakeDb(rows), None, uuid.uuid4(), application_ids=[rows[0][0]])


def test_an_unprovisioned_intake_cannot_invite(monkeypatch):
    class Bare:
        id = uuid.uuid4()
        name = "Bootcamp 08"
        agilytics_workspace_id = None

    monkeypatch.setattr(svc, "_bootcamp", lambda db, actor, bid: Bare())
    with pytest.raises(ConflictError, match="Provision"):
        svc.invite(None, None, uuid.uuid4(), application_ids=[uuid.uuid4()])


def test_the_covering_email_goes_only_to_confirmed_candidates(monkeypatch, wired):
    """Emailing somebody the workspace rejected would tell them to accept an
    invitation that does not exist."""
    rows = [row("B07-001"), row("B07-002")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(svc.agilytics, "bulk_invite", lambda ws: {"invitesIssued": 1})
    monkeypatch.setattr(
        svc,
        "_confirm_membership",
        lambda ws, email: "PENDING" if email.startswith("b07-001") else None,
    )

    sent_to = {}

    class Result:
        sent, failed = 1, 0

    def fake_send(db, bid, *, application_ids, **kw):
        sent_to["ids"] = application_ids
        return Result()

    monkeypatch.setattr(svc.email_service, "send_to_applications", fake_send)

    svc.invite(
        FakeDb(rows),
        None,
        uuid.uuid4(),
        application_ids=[r[0] for r in rows],
        body_html="<p>hi</p>",
    )

    assert sent_to["ids"] == [rows[0][0]]


# -------------------------------------------------------------- sync_joins --


def test_only_approved_counts_as_a_join(monkeypatch, wired):
    """PENDING, REJECTED, REVOKED and LEFT are all not-a-join, and only a join
    moves a stage."""
    invited = datetime.now(UTC)
    rows = [
        row("B07-001", invited=invited),
        row("B07-002", invited=invited),
        row("B07-003", invited=invited),
    ]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    statuses = {"b07-001@example.com": "APPROVED", "b07-002@example.com": "PENDING",
                "b07-003@example.com": "REVOKED"}
    monkeypatch.setattr(svc, "_confirm_membership", lambda ws, email: statuses[email])

    moved = []
    monkeypatch.setattr(
        svc.application_service,
        "advance_stage",
        lambda db, aid, *, to_stage, actor, reason: moved.append((aid, to_stage, actor)),
    )

    out = svc.sync_joins(FakeDb(rows), None, uuid.uuid4())

    assert out.joined == ["B07-001"]
    assert out.advanced == ["B07-001"]
    assert len(moved) == 1
    assert moved[0][1] == ApplicationStage.ONBOARDED
    # Agilytics reported it; no admin decided it.
    assert moved[0][2] is None


def test_uninvited_candidates_are_never_checked(monkeypatch, wired):
    """One HTTP request each, so the scan is confined to people who could
    plausibly have joined."""
    rows = [row("B07-001"), row("B07-002", invited=datetime.now(UTC))]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    asked = []

    def spy(ws, email):
        asked.append(email)
        return "PENDING"

    monkeypatch.setattr(svc, "_confirm_membership", spy)
    out = svc.sync_joins(FakeDb(rows), None, uuid.uuid4())

    assert asked == ["b07-002@example.com"]
    assert out.checked == 1


def test_an_already_joined_candidate_is_never_rechecked(monkeypatch, wired):
    rows = [row("B07-001", invited=datetime.now(UTC), joined=datetime.now(UTC))]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc, "_confirm_membership", lambda ws, e: pytest.fail("should not re-check")
    )

    out = svc.sync_joins(FakeDb(rows), None, uuid.uuid4())
    assert out.checked == 0


def test_a_join_is_stamped_even_when_the_stage_will_not_move(monkeypatch, wired):
    """The stamp records what Agilytics says, independently of whether our own
    stage needed moving — otherwise the candidate is re-checked for ever."""
    rows = [row("B07-001", invited=datetime.now(UTC))]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(svc, "_confirm_membership", lambda ws, e: "APPROVED")

    def already(db, aid, *, to_stage, actor, reason):
        raise ConflictError("Application is already at ONBOARDED.")

    monkeypatch.setattr(svc.application_service, "advance_stage", already)

    db = FakeDb(rows)
    out = svc.sync_joins(db, None, uuid.uuid4())

    assert out.joined == ["B07-001"]
    assert out.advanced == []
    assert db.apps[rows[0][0]].agilytics_joined_at is not None


def test_an_unreachable_api_is_counted_not_raised(monkeypatch, wired):
    """One candidate's failed lookup must not abandon the rest of the scan."""
    invited = datetime.now(UTC)
    rows = [row("B07-001", invited=invited), row("B07-002", invited=invited)]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)

    def flaky(ws, email):
        if email.startswith("b07-001"):
            raise UpstreamError("Could not reach Agilytics.")
        return "APPROVED"

    monkeypatch.setattr(svc, "_confirm_membership", flaky)
    monkeypatch.setattr(
        svc.application_service, "advance_stage", lambda *a, **k: None
    )

    out = svc.sync_joins(FakeDb(rows), None, uuid.uuid4())

    assert out.unreachable == 1
    assert out.joined == ["B07-002"]


# --------------------------------------------------- membership resolution --


def test_a_404_from_their_lookup_means_not_a_member(monkeypatch):
    """Not an error: it is what anyone who reached onboarding after
    provisioning looks like, since their API has no add-member endpoint."""
    def missing(ws, *, email):
        raise NotFoundError("not found")

    monkeypatch.setattr(svc.agilytics, "onboarding_status", missing)
    assert svc._confirm_membership("ws-1", "nobody@example.com") is None


def test_their_status_is_upper_cased(monkeypatch):
    monkeypatch.setattr(
        svc.agilytics, "onboarding_status", lambda ws, *, email: {"status": "approved"}
    )
    assert svc._confirm_membership("ws-1", "a@example.com") == "APPROVED"
