"""Onboarding candidates into an Agilytics workspace.

Their `onboard` endpoint makes a student an APPROVED member in the call
itself, and answers per email rather than with an aggregate — so unlike the
invite-and-poll flow this replaced, almost everything worth testing is about
reading their answer correctly and acting on each part of it exactly once.

Two behaviours carry most of the risk and get most of the tests: a student
whose track name matches nothing is onboarded *ungrouped and without an
error*, and a student with no account on their side is skipped rather than
added. Both look like success from the status code alone.
"""

import uuid
from datetime import UTC, datetime

import pytest

from app.core.exceptions import ConflictError
from app.models.enums import ApplicationStage
from app.services import agilytics_service as svc


class FakeApplication:
    def __init__(self):
        self.agilytics_onboarded_at = None


class FakeDb:
    """Enough Session for onboard(): row lookups and no-op writes."""

    def __init__(self, rows):
        self.apps = {r[0]: FakeApplication() for r in rows}
        self.commits = 0

    def get(self, _model, pk):
        return self.apps.get(pk)

    def add(self, _obj):
        pass

    def flush(self):
        pass

    def commit(self):
        self.commits += 1


def row(code, *, onboarded=None, email=None, title="Web & App Development", track="Web Dev"):
    """One `_eligible_rows` tuple.

    Shape: (id, code, onboarded_at, email, full_name, program_title,
    agilytics_track_name).
    """
    return (
        uuid.uuid4(),
        code,
        onboarded,
        email or f"{code.lower()}@example.com",
        f"Name {code}",
        title,
        track,
    )


def result(email, status="onboarded", reason=None):
    """One entry of their `results[]` array."""
    entry = {"email": email, "status": status}
    if reason:
        entry["reason"] = reason
    return entry


@pytest.fixture
def wired(monkeypatch):
    """Stub the boundaries: our bootcamp lookup, their API, audit, email, stage."""

    class Bootcamp:
        id = uuid.uuid4()
        name = "Bootcamp 07"
        agilytics_workspace_id = "ws-1"

    monkeypatch.setattr(svc, "_bootcamp", lambda db, actor, bid: Bootcamp())
    monkeypatch.setattr(svc.audit_service, "record", lambda *a, **k: None)
    monkeypatch.setattr(svc.email_service, "send_agilytics_onboarded", lambda **k: True)
    monkeypatch.setattr(svc.application_service, "advance_stage", lambda *a, **k: None)
    return Bootcamp


# ---------------------------------------------------------------- eligible --


def test_eligible_splits_on_the_onboarded_timestamp(monkeypatch, wired):
    rows = [row("B07-001"), row("B07-002", onboarded=datetime.now(UTC)), row("B07-003")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)

    out = svc.eligible(None, None, uuid.uuid4())

    assert [r.candidate_code for r in out.new] == ["B07-001", "B07-003"]
    assert [r.candidate_code for r in out.already_onboarded] == ["B07-002"]


def test_eligible_names_the_programs_with_no_track_mapping(monkeypatch, wired):
    """The warning the modal needs. Their API accepts an unmatched track
    silently, so without this the mistake only surfaces later as a workspace
    full of ungrouped students."""
    rows = [
        row("B07-001", title="Web & App Development", track="Web Dev"),
        row("B07-002", title="UI/UX Design", track=None),
        row("B07-003", title="Cloud & DevOps", track=None),
    ]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)

    out = svc.eligible(None, None, uuid.uuid4())

    assert out.unmapped_programs == ["Cloud & DevOps", "UI/UX Design"]


def test_an_unmapped_program_nobody_is_studying_is_not_a_warning(monkeypatch, wired):
    """Only the programs actually about to be sent. A gap elsewhere in the
    catalogue is not this screen's problem."""
    rows = [
        row("B07-001", track="Web Dev"),
        row("B07-002", title="UI/UX Design", track=None, onboarded=datetime.now(UTC)),
    ]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)

    assert svc.eligible(None, None, uuid.uuid4()).unmapped_programs == []


# ----------------------------------------------------------------- onboard --


def test_the_selection_is_what_gets_sent(monkeypatch, wired):
    """The substantive gain over the endpoint this replaced: their onboard
    call takes the member list, so choosing two candidates onboards exactly
    those two rather than everyone pending in the workspace."""
    rows = [row("B07-001"), row("B07-002"), row("B07-003")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    sent = {}

    def fake_onboard(ws, students):
        sent["students"] = students
        return {"results": [result(s["email"]) for s in students]}

    monkeypatch.setattr(svc.agilytics, "onboard", fake_onboard)

    svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[rows[0][0], rows[2][0]])

    assert [s["email"] for s in sent["students"]] == [
        "b07-001@example.com",
        "b07-003@example.com",
    ]


def test_a_program_without_a_mapping_is_held_back_and_reported(monkeypatch, wired):
    """Their validator would reject a student with no track, so a candidate
    whose program has no mapping is never sent: it is reported back in
    `skipped_no_track` instead, and the mapped candidate goes through."""
    rows = [row("B07-001", track=None), row("B07-002", track="Web Dev")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    sent = {}

    def fake_onboard(ws, students):
        sent["students"] = students
        return {"results": [result(s["email"]) for s in students]}

    monkeypatch.setattr(svc.agilytics, "onboard", fake_onboard)

    outcome = svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[r[0] for r in rows])

    assert len(sent["students"]) == 1
    assert sent["students"][0]["trackName"] == "Web Dev"
    assert outcome.skipped_no_track == ["B07-001"]


def test_only_the_candidates_they_confirmed_are_stamped(monkeypatch, wired):
    rows = [row("B07-001"), row("B07-002")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {
            "results": [
                result("b07-001@example.com"),
                result(
                    "b07-002@example.com",
                    status="skipped",
                    reason="User not found in system",
                ),
            ]
        },
    )

    db = FakeDb(rows)
    out = svc.onboard(db, None, uuid.uuid4(), application_ids=[r[0] for r in rows])

    assert out.onboarded == ["B07-001"]
    assert out.skipped_not_found == ["B07-002"]
    assert db.apps[rows[0][0]].agilytics_onboarded_at is not None
    assert db.apps[rows[1][0]].agilytics_onboarded_at is None


def test_an_existing_member_is_recorded_as_onboarded(monkeypatch, wired):
    """Their side says the membership exists and ours says we never recorded
    it. Theirs is the authority, so the row is stamped rather than left to be
    retried for ever."""
    rows = [row("B07-001")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {
            "results": [
                result(
                    "b07-001@example.com",
                    status="skipped",
                    reason="Already a workspace member",
                )
            ]
        },
    )

    db = FakeDb(rows)
    out = svc.onboard(db, None, uuid.uuid4(), application_ids=[rows[0][0]])

    assert out.skipped_already_member == ["B07-001"]
    assert db.apps[rows[0][0]].agilytics_onboarded_at is not None


def test_an_existing_member_is_still_emailed(monkeypatch, wired):
    """The stamp records having *told* them. A candidate who is a member but
    has never been sent login instructions has not been onboarded in any
    sense they can act on."""
    rows = [row("B07-001")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {
            "results": [
                result(
                    "b07-001@example.com",
                    status="skipped",
                    reason="Already a workspace member",
                )
            ]
        },
    )
    sent = []
    monkeypatch.setattr(
        svc.email_service, "send_agilytics_onboarded", lambda **k: sent.append(k) or True
    )

    out = svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[rows[0][0]])

    assert [s["candidate_code"] for s in sent] == ["B07-001"]
    assert out.emailed == 1


def test_a_skipped_candidate_is_never_emailed(monkeypatch, wired):
    rows = [row("B07-001")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {
            "results": [
                result(
                    "b07-001@example.com",
                    status="skipped",
                    reason="User not found in system",
                )
            ]
        },
    )
    monkeypatch.setattr(
        svc.email_service,
        "send_agilytics_onboarded",
        lambda **k: pytest.fail("must not email a candidate who was not onboarded"),
    )

    out = svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[rows[0][0]])

    assert out.emailed == 0


def test_onboarding_advances_the_candidate_to_onboarded(monkeypatch, wired):
    """Through the real stage path, so it writes a transition row, an audit
    entry and the candidate's notification rather than setting a column."""
    rows = [row("B07-001")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {"results": [result("b07-001@example.com")]},
    )
    moved = []
    monkeypatch.setattr(
        svc.application_service,
        "advance_stage",
        lambda db, aid, *, to_stage, actor, reason: moved.append((aid, to_stage)),
    )

    out = svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[rows[0][0]])

    assert moved[0][1] == ApplicationStage.ONBOARDED
    assert out.advanced == ["B07-001"]


def test_a_candidate_already_at_that_stage_is_not_a_failure(monkeypatch, wired):
    """The ordinary case for an existing member: the membership is real, and
    a no-op stage move should not surface as an error."""
    rows = [row("B07-001")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {"results": [result("b07-001@example.com")]},
    )

    def already(db, aid, *, to_stage, actor, reason):
        raise ConflictError("Application is already at ONBOARDED.")

    monkeypatch.setattr(svc.application_service, "advance_stage", already)

    db = FakeDb(rows)
    out = svc.onboard(db, None, uuid.uuid4(), application_ids=[rows[0][0]])

    assert out.onboarded == ["B07-001"]
    assert out.advanced == []
    # The stamp stands regardless: they are a member either way.
    assert db.apps[rows[0][0]].agilytics_onboarded_at is not None


def test_email_failures_are_counted_not_raised(monkeypatch, wired):
    """The membership already exists on their side by the time this runs. A
    mail outage must not report a completed handover as a failure."""
    rows = [row("B07-001"), row("B07-002")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {"results": [result(s["email"]) for s in students]},
    )
    monkeypatch.setattr(
        svc.email_service,
        "send_agilytics_onboarded",
        lambda **k: k["candidate_code"] != "B07-002",
    )

    out = svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[r[0] for r in rows])

    assert (out.emailed, out.email_failed) == (1, 1)
    assert out.onboarded == ["B07-001", "B07-002"]


# ------------------------------------------------------- ungrouped students --
# The silent failure this integration is most exposed to: a track name that
# matches nothing resolves to no track, and their response reports it as an
# ordinary success.


def test_students_their_api_could_not_place_are_counted(monkeypatch, wired):
    """Measured from their own `trackDistribution` against their own
    onboarded count, so it catches both causes — no mapping sent, and a
    mapping that matched nothing — without needing to tell them apart."""
    rows = [row("B07-001"), row("B07-002"), row("B07-003")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {
            "results": [result(s["email"]) for s in students],
            # Only one of the three landed in a track.
            "trackDistribution": {"track-uuid-1": 1},
        },
    )

    out = svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[r[0] for r in rows])

    assert out.ungrouped == 2
    assert out.track_distribution == {"track-uuid-1": 1}


def test_everyone_placed_means_nobody_ungrouped(monkeypatch, wired):
    rows = [row("B07-001"), row("B07-002")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {
            "results": [result(s["email"]) for s in students],
            "trackDistribution": {"t-1": 1, "t-2": 1},
        },
    )

    out = svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[r[0] for r in rows])

    assert out.ungrouped == 0


def test_a_missing_track_distribution_does_not_break_the_count(monkeypatch, wired):
    rows = [row("B07-001")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {"results": [result("b07-001@example.com")]},
    )

    out = svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[rows[0][0]])

    assert out.ungrouped == 1
    assert out.track_distribution == {}


# --------------------------------------------------------------- refusals --


def test_already_onboarded_candidates_are_refused(monkeypatch, wired):
    """Duplicate prevention: re-running the flow over the same people is a
    conflict, not a second onboard."""
    rows = [row("B07-001", onboarded=datetime.now(UTC))]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: pytest.fail("nothing may be sent"),
    )

    with pytest.raises(ConflictError, match="already"):
        svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[rows[0][0]])


def test_an_empty_selection_is_refused(monkeypatch, wired):
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: [])
    with pytest.raises(ConflictError):
        svc.onboard(FakeDb([]), None, uuid.uuid4(), application_ids=[])


def test_a_result_for_somebody_we_did_not_send_is_ignored(monkeypatch, wired):
    """Their endpoint is addressed at a workspace. A response naming an
    address outside our selection is not ours to act on."""
    rows = [row("B07-001")]
    monkeypatch.setattr(svc, "_eligible_rows", lambda db, bid: rows)
    monkeypatch.setattr(
        svc.agilytics,
        "onboard",
        lambda ws, students: {
            "results": [
                result("b07-001@example.com"),
                result("stranger@example.com"),
            ]
        },
    )

    out = svc.onboard(FakeDb(rows), None, uuid.uuid4(), application_ids=[rows[0][0]])

    assert out.onboarded == ["B07-001"]
