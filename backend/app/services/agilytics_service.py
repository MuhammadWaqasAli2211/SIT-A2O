"""Provisioning an intake into Agilytics, and reading back what happened.

Agilytics picks up where our pipeline stops: a candidate who has finished
onboarding becomes a member of a workspace there. Every operation is
admin-initiated — nothing here runs on a timer or as a side effect of a
stage change. That was a deliberate choice (2026-09-05) and it survives the
API change: provisioning still creates things that cannot be deleted, so it
should happen because somebody decided it should, not because a candidate
crossed a threshold while nobody was watching.

## Two steps, not one

Their API separates having an account from being a member, and so does this
module:

1. **Provision** (`POST /workspaces`) creates the workspace, makes the
   intake's admins leads, and creates Auth accounts for its students. It
   does *not* make students members and does *not* create tracks.
2. **Onboard** (`POST /workspaces/{id}/onboard`) makes chosen students
   APPROVED members, immediately, with a per-student track name.

The consequence worth knowing: a candidate who reaches onboarding *after*
provisioning has no account on their side, and `onboard` reports them as
"User not found in system" rather than adding them. Provisioning would
create the account — but whether re-running it against an existing intake
returns the same workspace or makes a second one is undocumented, so that
path is deliberately not automated here. It is reported to the admin
instead.

## What gets sent

* **Students** — everyone in the intake at FORM or ONBOARDED, the same
  population the HR Assessment screen lists, so "provision this intake"
  provisions what the admin is looking at.
* **Track names** — `programs.agilytics_track_name`, set per program by an
  admin. Not the program title: their API resolves an unmatched track name
  to no track at all, silently and without erroring, so a guessed mapping
  fails invisibly. Null sends no track.
* **Leads** — the intake's own bootcamp admins. Worth being explicit that
  this creates accounts for our staff in a third-party system; it is what
  makes them able to approve students on the Agilytics side without an
  Agilytics operator in the loop.

## Audit

The two writes are recorded; the status read is not. That matches how the
AI Interviewer integration is treated — our own actions against a third
party are auditable events, their data is not something we log every time
somebody looks at it. Reading a status is a page load, and an audit trail
that fills with page loads stops being one.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    ServiceNotConfiguredError,
)
from app.integrations import agilytics
from app.models.application import Application
from app.models.bootcamp import Bootcamp, BootcampAdmin, Program
from app.models.enums import ApplicationStage
from app.models.user import Profile
from app.schemas.agilytics import (
    AgilyticsActivationHealth,
    AgilyticsCandidateRow,
    AgilyticsEligibleList,
    AgilyticsMemberStatus,
    AgilyticsOnboardOutcome,
    AgilyticsProvisionResult,
    AgilyticsTrackCount,
    AgilyticsTrackProgress,
    AgilyticsWorkspaceState,
    AgilyticsWorkspaceStats,
)
from app.services import (
    application_service,
    audit_service,
    bootcamp_service,
    email_service,
    onboarding_document_service,
)

# The population sent as students. Deliberately the same tuple the HR
# Assessment screen and the onboarding list are built from, imported rather
# than repeated so the three cannot drift into disagreeing about who is "in
# onboarding".
_STUDENT_STAGES = onboarding_document_service.ONBOARDING_LIST_STAGES


def _bootcamp(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> Bootcamp:
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
    bootcamp = db.get(Bootcamp, bootcamp_id)
    if bootcamp is None:
        raise NotFoundError("Bootcamp not found.")
    return bootcamp


def _members(db: Session, bootcamp_id: uuid.UUID) -> list[dict]:
    """The students to provision, in their schema's shape.

    Accounts only — this feeds `provision_workspace`, which creates Auth
    users and nothing else. No `trackName` here: their provisioning call has
    no concept of one, and membership (where the track actually applies) is
    `onboard`'s job.

    Their schema wants camelCase (`fullName`); the rows are built in their
    shape here rather than converted downstream, where an open schema would
    silently drop a misspelled key instead of refusing it.

    A candidate with no name on file is sent with their candidate code as the
    name — an empty `fullName` is refused by their validator, and the code is
    the one identifier we can always produce.
    """
    rows = db.execute(
        select(Application.candidate_code, Profile.email, Profile.full_name)
        .join(Profile, Profile.id == Application.profile_id)
        .where(
            Application.bootcamp_id == bootcamp_id,
            Application.stage.in_(_STUDENT_STAGES),
        )
        .order_by(Application.candidate_code)
    ).all()

    return [{"email": email, "fullName": full_name or code} for code, email, full_name in rows]


def _leads(db: Session, bootcamp_id: uuid.UUID) -> list[dict]:
    """This intake's admins, as workspace leads.

    Note what this does: it hands our staff's names and addresses to a third
    party, which creates accounts for them there. Chosen deliberately
    (2026-09-05) so an admin can approve students on the Agilytics side
    without going through an Agilytics operator.
    """
    rows = db.execute(
        select(Profile.email, Profile.full_name)
        .join(BootcampAdmin, BootcampAdmin.profile_id == Profile.id)
        .where(BootcampAdmin.bootcamp_id == bootcamp_id)
    ).all()
    return [{"email": email, "fullName": name or email} for email, name in rows]


def preview(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> AgilyticsProvisionResult:
    """What provisioning would send, without sending it.

    Their provisioning call cannot be undone from our side — there is no
    delete endpoint — so the admin sees the counts first and confirms.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    students = _members(db, bootcamp_id)
    leads = _leads(db, bootcamp_id)

    return AgilyticsProvisionResult(
        workspace_id=bootcamp.agilytics_workspace_id,
        already_provisioned=bootcamp.agilytics_workspace_id is not None,
        students=len(students),
        leads=len(leads),
        lead_emails=[lead["email"] for lead in leads],
    )


def provision(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> AgilyticsProvisionResult:
    """Create this intake's Agilytics workspace and store its id.

    Refuses if one already exists. Their endpoint would happily create a
    second workspace with the same name, leaving the intake pointing at one
    of them and the students split across both — the kind of mess that is
    much easier to refuse than to unpick, since we cannot delete either.
    """
    if not agilytics.settings.agilytics_configured:
        raise ServiceNotConfiguredError("Agilytics is not configured.")

    bootcamp = _bootcamp(db, actor, bootcamp_id)
    if bootcamp.agilytics_workspace_id:
        raise ConflictError(
            f"{bootcamp.name} is already provisioned in Agilytics "
            f"(workspace {bootcamp.agilytics_workspace_id})."
        )

    students = _members(db, bootcamp_id)
    if not students:
        raise ConflictError("Nobody in this intake has reached onboarding yet.")
    leads = _leads(db, bootcamp_id)

    data = agilytics.provision_workspace(
        name=bootcamp.name,
        description=bootcamp.description or "",
        leads=leads,
        students=students,
    )

    workspace_id = data.get("workspaceId")
    if not workspace_id:
        # Their call may well have succeeded; we simply cannot address the
        # result. Saying so plainly beats storing None and later reporting
        # the intake as unprovisioned when it is not.
        raise ConflictError(
            "Agilytics created the workspace but returned no workspaceId, "
            "so it cannot be linked to this intake. Check their dashboard."
        )

    bootcamp.agilytics_workspace_id = str(workspace_id)
    # `summary.students` is an object of its own in the current API, where it
    # used to be a flat count. Read defensively: a missing key here should
    # leave a figure at zero rather than have us report our own request back
    # as though it were their answer.
    summary = data.get("summary") or {}
    student_summary = summary.get("students") or {}
    created = student_summary.get("newlyCreated", 0)
    existed = student_summary.get("alreadyExisted", 0)
    total = student_summary.get("total", len(students))
    leads_provisioned = summary.get("leadsProvisioned", len(leads))

    audit_service.record(
        db,
        actor=actor,
        action="agilytics.provision",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=f"Provisioned {bootcamp.name} into Agilytics",
        metadata={
            "workspace_id": str(workspace_id),
            "leads_provisioned": leads_provisioned,
            "students_total": total,
            "students_created": created,
            "students_already_existed": existed,
        },
    )
    db.commit()

    return AgilyticsProvisionResult(
        workspace_id=str(workspace_id),
        already_provisioned=True,
        students=total,
        students_created=created,
        students_already_existed=existed,
        leads=leads_provisioned,
        lead_emails=[lead["email"] for lead in leads],
    )


def unlink(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> AgilyticsWorkspaceState:
    """Forget this intake's workspace id without touching Agilytics.

    For when a workspace was deleted on Agilytics' side directly — something
    we cannot detect automatically. Their `onboarding-status` endpoint keeps
    answering for a workspace after it is gone on their dashboard (confirmed
    2026-09-16), and their `stats`/`onboard` endpoints 404 on workspaces that
    are demonstrably still live, so neither can be trusted to tell us a
    workspace was really deleted. An admin who has checked their dashboard
    is the only reliable signal available right now.

    This never calls Agilytics — there is nothing to delete over there from
    here, and nothing sent. It only clears our pointer so the intake reads as
    unprovisioned again and can be provisioned fresh.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    if not bootcamp.agilytics_workspace_id:
        raise ConflictError(f"{bootcamp.name} is not provisioned in Agilytics.")

    previous_workspace_id = bootcamp.agilytics_workspace_id
    bootcamp.agilytics_workspace_id = None

    audit_service.record(
        db,
        actor=actor,
        action="agilytics.unlink",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=f"Unlinked {bootcamp.name} from its Agilytics workspace",
        metadata={"workspace_id": previous_workspace_id},
    )
    db.commit()

    return AgilyticsWorkspaceState(provisioned=False)


def workspace_state(
    db: Session, actor: Profile, bootcamp_id: uuid.UUID
) -> AgilyticsWorkspaceState:
    """This intake's Agilytics side, as the HR Assessment screen shows it.

    An unprovisioned intake is not an error — it is the ordinary state before
    anyone has pressed the button — so it comes back as a state with
    `provisioned: False` rather than a 404 the screen would have to special-case.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    if not bootcamp.agilytics_workspace_id:
        return AgilyticsWorkspaceState(provisioned=False)

    data = agilytics.onboarding_status(bootcamp.agilytics_workspace_id)
    breakdown = data.get("statusBreakdown") or {}
    roles = data.get("roleBreakdown") or {}
    return AgilyticsWorkspaceState(
        provisioned=True,
        workspace_id=bootcamp.agilytics_workspace_id,
        workspace_name=data.get("workspaceName"),
        total_members=data.get("totalMembers"),
        approved=breakdown.get("approved"),
        pending=breakdown.get("pending"),
        left=breakdown.get("left"),
        rejected=breakdown.get("rejected"),
        revoked=breakdown.get("revoked"),
        leads_count=roles.get("leads"),
        sub_leads_count=roles.get("subLeads"),
        students_count=roles.get("students"),
        tracks=[
            AgilyticsTrackCount(
                track_id=t.get("trackId"),
                track_name=t.get("trackName"),
                member_count=t.get("memberCount") or 0,
            )
            for t in (data.get("trackBreakdown") or [])
        ],
        members=_member_index(data),
    )


def _member_index(data: dict) -> dict[str, AgilyticsMemberStatus]:
    """Per-member status keyed by lowercased email.

    Only the leads are enumerated in their workspace-wide response — students
    appear as counts, not rows — so this index covers the leads and the HR
    screen falls back to "provisioned" for everyone else. Fetching every
    student individually would be one request per row, which is exactly what
    the per-row status column must not cost.
    """
    index: dict[str, AgilyticsMemberStatus] = {}
    for lead in data.get("leads") or []:
        email = str(lead.get("email") or "").strip().lower()
        if email:
            index[email] = AgilyticsMemberStatus(
                email=email,
                full_name=lead.get("fullName"),
                status=lead.get("status"),
                role=lead.get("role") or "LEAD",
                track_name=lead.get("trackName"),
            )
    return index


def member_status(
    db: Session, actor: Profile, bootcamp_id: uuid.UUID, email: str
) -> AgilyticsMemberStatus:
    """One member's status, for the row an admin actually opens.

    Their per-member lookup is a separate request, which is why it is not
    used to build the table: this answers a single row on demand.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    if not bootcamp.agilytics_workspace_id:
        raise NotFoundError("This intake has not been provisioned in Agilytics yet.")

    data = agilytics.onboarding_status(bootcamp.agilytics_workspace_id, email=email)
    return AgilyticsMemberStatus(
        email=data.get("email") or email,
        full_name=data.get("fullName"),
        status=data.get("status"),
        role=data.get("role"),
        track_name=data.get("trackName"),
        joined_at=data.get("joinedAt"),
    )


def workspace_stats(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> AgilyticsWorkspaceStats:
    """This intake's workspace health, from their `/stats` endpoint.

    Kept apart from `workspace_state` above rather than replacing it: the two
    read different endpoints that return genuinely different things.
    `onboarding-status` carries the `leads` roster and answers `?email=` for
    one member, which this cannot; this carries per-track onboarded/pending
    and activation health, which that has never had.

    Everything is passed through as reported. Where their two endpoints
    disagree — `trackBreakdown` is `memberCount` there and a
    total/onboarded/pending split here — the disagreement is preserved in two
    models rather than flattened into one that would have to invent the
    missing halves.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    if not bootcamp.agilytics_workspace_id:
        return AgilyticsWorkspaceStats(provisioned=False)

    data = agilytics.stats(bootcamp.agilytics_workspace_id)
    roles = data.get("roleBreakdown") or {}
    status = data.get("statusBreakdown") or {}
    activation = data.get("activationHealth") or {}

    return AgilyticsWorkspaceStats(
        provisioned=True,
        workspace_id=bootcamp.agilytics_workspace_id,
        workspace_name=data.get("workspaceName"),
        total_members=data.get("totalMembers"),
        leads_count=roles.get("leads"),
        sub_leads_count=roles.get("subLeads"),
        students_count=roles.get("students"),
        approved=status.get("approved"),
        pending=status.get("pending"),
        left=status.get("left"),
        rejected=status.get("rejected"),
        revoked=status.get("revoked"),
        tracks=[
            AgilyticsTrackProgress(
                track_id=t.get("trackId"),
                track_name=t.get("trackName"),
                total_students=t.get("totalStudents") or 0,
                onboarded=t.get("onboarded") or 0,
                pending=t.get("pending") or 0,
            )
            for t in (data.get("trackBreakdown") or [])
        ],
        activation=(
            AgilyticsActivationHealth(
                total_students=activation.get("totalStudents") or 0,
                verified=activation.get("verified") or 0,
                unverified=activation.get("unverified") or 0,
            )
            if activation
            else None
        ),
    )


# ------------------------------------------------------------ onboarding --
# Their `onboard` endpoint makes a student an APPROVED workspace member in the
# call itself: no token, no acceptance step, no waiting. Everything below
# follows from that being one event rather than two.
#
# The endpoint this replaced (`bulk-invite`) took no member list and answered
# with a single aggregate count, which forced a follow-up lookup per candidate
# just to learn who it had covered. This one takes the list and answers per
# email, so all of that reconciliation machinery — the per-candidate
# confirmation loop, the join poller, the invited-versus-joined distinction —
# is gone rather than ported.


def _eligible_rows(db: Session, bootcamp_id: uuid.UUID) -> list:
    """Everyone who has cleared the Physical Interview, onboarded or not.

    Deliberately independent of form and document progress: reaching FORM is
    what makes somebody part of the cohort, and their paperwork is a separate
    track Agilytics does not care about. Same `_STUDENT_STAGES` the
    provisioning call and the onboarding list are built from.

    Carries both the program title (what an admin recognises) and its
    Agilytics track name (what we actually send), because the modal has to
    show the difference — a program with no mapping is a student who will be
    onboarded ungrouped.
    """
    return db.execute(
        select(
            Application.id,
            Application.candidate_code,
            Application.agilytics_onboarded_at,
            Profile.email,
            Profile.full_name,
            Program.title,
            Program.agilytics_track_name,
        )
        .join(Profile, Profile.id == Application.profile_id)
        .outerjoin(Program, Program.id == Application.program_id)
        .where(
            Application.bootcamp_id == bootcamp_id,
            Application.stage.in_(_STUDENT_STAGES),
        )
        .order_by(Application.candidate_code)
    ).all()


def _to_row(record) -> AgilyticsCandidateRow:
    app_id, code, onboarded_at, email, full_name, title, track_name = record
    return AgilyticsCandidateRow(
        application_id=app_id,
        candidate_code=code,
        full_name=full_name,
        email=email,
        program_title=title,
        track_name=track_name,
        onboarded_at=onboarded_at,
    )


def _revert_removed_members(
    db: Session, workspace_id: str, marked_onboarded: list[AgilyticsCandidateRow]
) -> set[uuid.UUID]:
    """Clear the local onboarded flag for anyone Agilytics no longer counts as
    a member, so someone removed there becomes onboardable again here.

    One live lookup per candidate — the same per-email call the HR screen's
    "Check" button makes, just run up front for this list instead of on
    click, since the onboard modal only ever lists one intake's handful of
    already-onboarded candidates rather than a whole table.
    """
    reverted: set[uuid.UUID] = set()
    for row in marked_onboarded:
        try:
            agilytics.onboarding_status(workspace_id, email=row.email)
        except NotFoundError:
            application = db.get(Application, row.application_id)
            if application is not None:
                application.agilytics_onboarded_at = None
                reverted.add(row.application_id)
    if reverted:
        db.commit()
    return reverted


def eligible(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> AgilyticsEligibleList:
    """Who the onboard modal should offer, split by whether they are already in.

    Not-yet-onboarded is `agilytics_onboarded_at IS NULL` — the same
    timestamp-not-flag shape the interview and physical-interview invites use,
    so re-running the flow cannot pick the same candidate up twice. But that
    flag only records what we did, not what is still true on their side, so a
    candidate marked onboarded is re-checked live against Agilytics here: if
    they are no longer a member (removed on their end), the flag is cleared
    and they move back into `new` rather than staying stuck as done.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    rows = [_to_row(r) for r in _eligible_rows(db, bootcamp_id)]
    new = [r for r in rows if r.onboarded_at is None]
    marked_onboarded = [r for r in rows if r.onboarded_at is not None]

    still_onboarded = marked_onboarded
    if bootcamp.agilytics_workspace_id and marked_onboarded:
        reverted_ids = _revert_removed_members(
            db, bootcamp.agilytics_workspace_id, marked_onboarded
        )
        if reverted_ids:
            still_onboarded = [
                r for r in marked_onboarded if r.application_id not in reverted_ids
            ]
            new = new + [
                r.model_copy(update={"onboarded_at": None})
                for r in marked_onboarded
                if r.application_id in reverted_ids
            ]

    # Only the programs actually about to be sent: a missing mapping on a
    # program nobody in this intake is studying is not this screen's problem.
    unmapped = sorted({r.program_title for r in new if not r.track_name and r.program_title})

    return AgilyticsEligibleList(
        provisioned=bootcamp.agilytics_workspace_id is not None,
        workspace_id=bootcamp.agilytics_workspace_id,
        new=new,
        already_onboarded=still_onboarded,
        unmapped_programs=unmapped,
    )


# How their `results[]` entries map onto our outcome buckets. Their two
# documented reasons are matched case-insensitively on a distinctive fragment
# rather than on the whole string: the reason is prose, and prose gets
# reworded without anyone telling us.
_SKIP_NOT_FOUND = "not found"
_SKIP_ALREADY_MEMBER = "already a workspace member"


def onboard(
    db: Session,
    actor: Profile,
    bootcamp_id: uuid.UUID,
    *,
    application_ids: list[uuid.UUID],
) -> AgilyticsOnboardOutcome:
    """Make the chosen candidates workspace members, and tell them so.

    One call to their API, then three consequences on our side for everyone it
    confirmed: the timestamp, the stage move to ONBOARDED, and the email.

    **Already a member** counts as onboarded here. Their side says the
    membership exists and ours says we never recorded it; of those two theirs
    is the authority, so the row is stamped. It is emailed too, on the
    reasoning that our stamp is the record of having *told* them — a candidate
    who is a member but has never been sent login instructions has not been
    onboarded in any sense they can act on.

    **Not found in system** is the one that needs an operator. It means the
    student has no account on their side, because provisioning has not run
    since that candidate arrived. Nothing about them is stamped, so they stay
    eligible for a retry once that is fixed.

    The stage move goes through `application_service.advance_stage` rather
    than writing a column, so it produces the same transition row, audit entry
    and candidate notification as every other stage change. Attributed to the
    admin, because unlike the join-polling this replaces, a person decided it.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    workspace_id = bootcamp.agilytics_workspace_id
    if not workspace_id:
        raise ConflictError("Provision this intake in Agilytics before onboarding anyone.")
    if not application_ids:
        raise ConflictError("Select at least one candidate to onboard.")

    wanted = set(application_ids)
    chosen = [r for r in _eligible_rows(db, bootcamp_id) if r[0] in wanted and r[2] is None]
    if not chosen:
        raise ConflictError("Those candidates have all been onboarded already.")

    by_email = {r[3].lower(): r for r in chosen if r[3]}
    payload: list[dict[str, str]] = []
    for _id, _code, _onboarded, email, _name, _title, track_name in chosen:
        student: dict[str, str] = {"email": email}
        # Omitted rather than sent empty when a program has no mapping: their
        # validator reads an absent trackName as "no track", whereas an empty
        # string is a name that matches nothing. Same outcome, but one of them
        # is us saying what we mean.
        if track_name:
            student["trackName"] = track_name
        payload.append(student)

    data = agilytics.onboard(workspace_id, payload)

    onboarded: list[str] = []
    already_member: list[str] = []
    not_found: list[str] = []
    other: list[str] = []
    confirmed_ids: list[uuid.UUID] = []

    for entry in data.get("results") or []:
        record = by_email.get(str(entry.get("email") or "").lower())
        if record is None:
            continue
        code = record[1]

        if entry.get("status") == "onboarded":
            onboarded.append(code)
            confirmed_ids.append(record[0])
            continue

        reason = str(entry.get("reason") or "").lower()
        if _SKIP_ALREADY_MEMBER in reason:
            already_member.append(code)
            confirmed_ids.append(record[0])
        elif _SKIP_NOT_FOUND in reason:
            not_found.append(code)
        else:
            other.append(code)

    now = datetime.now(UTC)
    stamped: list[tuple[uuid.UUID, str, str, str | None]] = []
    for record in chosen:
        if record[0] not in confirmed_ids:
            continue
        application = db.get(Application, record[0])
        if application is None:
            continue
        application.agilytics_onboarded_at = now
        stamped.append((record[0], record[1], record[3], record[4]))

    # Their numbers, not ours: `trackDistribution` counts the students they
    # actually resolved to a track, so the shortfall against the onboarded
    # count is everyone who landed ungrouped — whether because we sent no
    # track or because the one we sent matched nothing. Their response does
    # not distinguish those two and treats neither as an error, which is
    # exactly why the total is worth surfacing.
    distribution = data.get("trackDistribution")
    distribution = distribution if isinstance(distribution, dict) else {}
    ungrouped = max(0, len(onboarded) - sum(distribution.values()))

    audit_service.record(
        db,
        actor=actor,
        action="agilytics.onboard",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=f"Agilytics: onboarded {len(onboarded)} candidate(s) into {bootcamp.name}",
        metadata={
            "workspace_id": workspace_id,
            "onboarded": onboarded,
            "already_member": already_member,
            "not_found": not_found,
            "other_skips": other,
            "ungrouped": ungrouped,
            "track_distribution": distribution,
        },
    )

    # Committed before the stage moves and the emails: each of those tolerates
    # individual failure, and neither should be able to roll back a membership
    # that already exists on their side.
    db.commit()

    advanced = _advance_onboarded(db, stamped, actor)
    emailed, email_failed = _email_onboarded(db, bootcamp, stamped)

    return AgilyticsOnboardOutcome(
        onboarded=onboarded,
        skipped_already_member=already_member,
        skipped_not_found=not_found,
        skipped_other=other,
        ungrouped=ungrouped,
        track_distribution=distribution,
        emailed=emailed,
        email_failed=email_failed,
        advanced=advanced,
    )


def _advance_onboarded(
    db: Session, stamped: list[tuple[uuid.UUID, str, str, str | None]], actor: Profile
) -> list[str]:
    """Move each newly-onboarded candidate to ONBOARDED.

    A candidate already at that stage raises `ConflictError` from
    `advance_stage` — the ordinary case for anyone their side reported as an
    existing member. Swallowed, because the membership is still real and a
    no-op should not surface to the caller as a failure.
    """
    advanced: list[str] = []
    for application_id, code, _email, _name in stamped:
        try:
            application_service.advance_stage(
                db,
                application_id,
                to_stage=ApplicationStage.ONBOARDED,
                actor=actor,
                reason="Onboarded into the Agilytics workspace",
            )
            advanced.append(code)
        except (ConflictError, NotFoundError):
            continue
    if advanced:
        db.commit()
    return advanced


def _email_onboarded(
    db: Session,
    bootcamp: Bootcamp,
    stamped: list[tuple[uuid.UUID, str, str, str | None]],
) -> tuple[int, int]:
    """Tell each onboarded candidate they are in, and how to get in.

    Sent one at a time rather than through `email_service.send_to_applications`
    because this is a fixed transactional message with no admin-authored body
    and no merge fields to render — the same shape as the physical interview
    outcome mails, and held to the same never-raise contract. A mail server
    outage must not make a membership that already exists look like a failure.
    """
    sent = failed = 0
    for _application_id, code, email, full_name in stamped:
        if not email:
            continue
        if email_service.send_agilytics_onboarded(
            to=email,
            full_name=full_name,
            candidate_code=code,
            bootcamp_name=bootcamp.name,
        ):
            sent += 1
        else:
            failed += 1
    return sent, failed
