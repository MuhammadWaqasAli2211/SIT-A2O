"""Provisioning an intake into Agilytics, and reading back what happened.

Agilytics picks up where our pipeline stops: a candidate who has finished
onboarding becomes a member of a workspace there. Three operations, all
admin-initiated from the HR Assessment screen — nothing here runs on a
timer or as a side effect of a stage change. That was a deliberate choice
(2026-09-05): provisioning is not idempotent on their side, so it should
happen because somebody decided it should, not because a candidate crossed
a threshold while nobody was watching.

## What gets sent

* **Students** — everyone in the intake at FORM or ONBOARDED, the same
  population the HR Assessment screen lists, so "provision this intake"
  provisions what the admin is looking at. Their `trackName` is our program
  title, which is also what we send as the workspace's track list.
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
    AppError,
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
    AgilyticsCandidateRow,
    AgilyticsEligibleList,
    AgilyticsInviteOutcome,
    AgilyticsJoinSyncResult,
    AgilyticsMemberStatus,
    AgilyticsProvisionResult,
    AgilyticsTrackCount,
    AgilyticsWorkspaceState,
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


def _members(db: Session, bootcamp_id: uuid.UUID) -> tuple[list[dict], list[str]]:
    """The students to provision, and the track names they belong to.

    Their schema wants camelCase (`fullName`, `trackName`); the rows are
    built in their shape here rather than converted downstream, where an open
    schema would silently drop a misspelled key instead of refusing it.

    A candidate with no name on file is sent with their candidate code as the
    name — an empty `fullName` is refused by their validator, and the code is
    the one identifier we can always produce.
    """
    rows = db.execute(
        select(Application.candidate_code, Profile.email, Profile.full_name, Program.title)
        .join(Profile, Profile.id == Application.profile_id)
        .outerjoin(Program, Program.id == Application.program_id)
        .where(
            Application.bootcamp_id == bootcamp_id,
            Application.stage.in_(_STUDENT_STAGES),
        )
        .order_by(Application.candidate_code)
    ).all()

    students = []
    tracks: list[str] = []
    for code, email, full_name, track in rows:
        student = {"email": email, "fullName": full_name or code}
        if track:
            student["trackName"] = track
            tracks.append(track)
        students.append(student)

    return students, list(dict.fromkeys(tracks))


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
    students, tracks = _members(db, bootcamp_id)
    leads = _leads(db, bootcamp_id)

    return AgilyticsProvisionResult(
        workspace_id=bootcamp.agilytics_workspace_id,
        already_provisioned=bootcamp.agilytics_workspace_id is not None,
        tracks=tracks,
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

    students, tracks = _members(db, bootcamp_id)
    if not students:
        raise ConflictError("Nobody in this intake has reached onboarding yet.")
    leads = _leads(db, bootcamp_id)

    data = agilytics.provision_workspace(
        name=bootcamp.name,
        description=bootcamp.description or "",
        tracks=tracks,
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
    summary = data.get("summary") or {}
    audit_service.record(
        db,
        actor=actor,
        action="agilytics.provision",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=f"Provisioned {bootcamp.name} into Agilytics",
        metadata={
            "workspace_id": str(workspace_id),
            "tracks": data.get("tracksCreated") or tracks,
            "leads_provisioned": summary.get("leadsProvisioned", len(leads)),
            "students_provisioned": summary.get("studentsProvisioned", len(students)),
        },
    )
    db.commit()

    return AgilyticsProvisionResult(
        workspace_id=str(workspace_id),
        already_provisioned=True,
        tracks=data.get("tracksCreated") or tracks,
        students=summary.get("studentsProvisioned", len(students)),
        leads=summary.get("leadsProvisioned", len(leads)),
        lead_emails=[lead["email"] for lead in leads],
    )


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


def send_invites(
    db: Session,
    actor: Profile,
    bootcamp_id: uuid.UUID,
    *,
    application_ids: list[uuid.UUID] | None = None,
    subject: str | None = None,
    body_html: str | None = None,
) -> dict:
    """Issue Agilytics invites, and optionally email the chosen candidates.

    Two halves, because their API and ours can each only do one of them.

    **Their half** — `bulk-invite` stages a token for every PENDING member of
    the workspace. It takes no member list, so a selection cannot narrow it:
    asking to invite three people invites everyone who is pending. Verified
    2026-09-05 against the live API, along with the other half of the problem
    — the response carries `invitesIssued` and `expiresAt` and *no tokens*, so
    we cannot build an accept URL and could not send their invitation
    ourselves even if we wanted to.

    **Our half** — a covering email to the applications named in
    `application_ids`. This is the part a selection actually controls, and it
    exists for the same reason the interview invite's covering mail does: the
    third party's own message is not ours to write, and everything specific to
    this intake has to come from us.

    Safe to repeat: their endpoint revokes and reissues rather than
    duplicating, so unlike provisioning this is not gated behind an
    already-done check. Zero pending members is a normal answer, not a failure.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    if not bootcamp.agilytics_workspace_id:
        raise ConflictError("Provision this intake in Agilytics before sending invites.")

    data = agilytics.bulk_invite(bootcamp.agilytics_workspace_id)
    issued = data.get("invitesIssued", 0)

    audit_service.record(
        db,
        actor=actor,
        action="agilytics.bulk_invite",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=f"Staged {issued} Agilytics invite(s) for {bootcamp.name}",
        metadata={
            "workspace_id": bootcamp.agilytics_workspace_id,
            "invites_issued": issued,
            "expires_at": data.get("expiresAt"),
        },
    )

    emailed = failed = 0
    if application_ids and body_html:
        # Ordinary send: scope-checked, per-recipient merge-field rendered and
        # logged to email_logs by the same path every other admin email takes.
        result = email_service.send_to_applications(
            db,
            bootcamp_id,
            application_ids=application_ids,
            subject=subject or f"Your {bootcamp.name} workspace access",
            body_html=body_html,
            template="agilytics_invite",
            actor=actor,
        )
        emailed, failed = result.sent, result.failed

    db.commit()

    return {
        "invites_issued": issued,
        "expires_at": data.get("expiresAt"),
        "emailed": emailed,
        "email_failed": failed,
    }


# ------------------------------------------------ per-candidate membership --
# Everything below tracks Agilytics membership one candidate at a time, which
# their API does not do for us. `bulk-invite` takes no member list and answers
# with a single count; the only per-person signal available anywhere is the
# per-member `onboarding-status` lookup, one HTTP request each. So an invite
# is *confirmed* rather than assumed, and a join is *checked* rather than
# pushed to us.


def _eligible_rows(db: Session, bootcamp_id: uuid.UUID) -> list:
    """Everyone who has cleared the Physical Interview, invited or not.

    Deliberately independent of form and document progress: reaching FORM is
    what makes somebody part of the cohort, and their paperwork is a separate
    track Agilytics does not care about. Same `_STUDENT_STAGES` the
    provisioning call and the onboarding list are built from.
    """
    return db.execute(
        select(
            Application.id,
            Application.candidate_code,
            Application.agilytics_invited_at,
            Application.agilytics_joined_at,
            Profile.email,
            Profile.full_name,
            Program.title,
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
    app_id, code, invited_at, joined_at, email, full_name, track = record
    return AgilyticsCandidateRow(
        application_id=app_id,
        candidate_code=code,
        full_name=full_name,
        email=email,
        program_title=track,
        invited_at=invited_at,
        joined_at=joined_at,
    )


def eligible(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> AgilyticsEligibleList:
    """Who the invite modal should offer, split by whether they were invited.

    Not-yet-invited is `agilytics_invited_at IS NULL` — the same
    timestamp-not-flag shape the interview and physical-interview invites use,
    so re-running the flow cannot pick the same candidate up twice.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    rows = [_to_row(r) for r in _eligible_rows(db, bootcamp_id)]

    return AgilyticsEligibleList(
        provisioned=bootcamp.agilytics_workspace_id is not None,
        workspace_id=bootcamp.agilytics_workspace_id,
        new=[r for r in rows if r.invited_at is None],
        already_invited=[r for r in rows if r.invited_at is not None],
    )


def _confirm_membership(workspace_id: str, email: str) -> str | None:
    """Their status for one address, or None if the workspace has never heard
    of it.

    A 404 here is the ordinary answer for somebody who reached onboarding
    after the workspace was provisioned: their API has no add-member call, so
    those candidates genuinely are not members. Treated as "not a member",
    never as an error, because it is not one.
    """
    try:
        data = agilytics.onboarding_status(workspace_id, email=email)
    except NotFoundError:
        return None
    return str(data.get("status") or "").upper() or None


def invite(
    db: Session,
    actor: Profile,
    bootcamp_id: uuid.UUID,
    *,
    application_ids: list[uuid.UUID],
    subject: str | None = None,
    body_html: str | None = None,
) -> AgilyticsInviteOutcome:
    """Stage Agilytics invites, then confirm and stamp them one at a time.

    Two things are true at once and the shape follows from both: their
    `bulk-invite` covers every pending member of the workspace and cannot be
    narrowed, and it reports only a total. So the call is made once for the
    workspace, and `agilytics_invited_at` is then written per candidate only
    where that candidate's own per-member lookup confirms they are really
    there.

    The confirmation is what makes the stamp mean something. Writing it from
    `invitesIssued` alone would mark candidates invited who were never added —
    exactly the state of anyone who reached onboarding after provisioning,
    since their API offers no way to add them.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    workspace_id = bootcamp.agilytics_workspace_id
    if not workspace_id:
        raise ConflictError("Provision this intake in Agilytics before sending invites.")
    if not application_ids:
        raise ConflictError("Select at least one candidate to invite.")

    wanted = set(application_ids)
    chosen = [r for r in _eligible_rows(db, bootcamp_id) if r[0] in wanted and r[2] is None]
    if not chosen:
        raise ConflictError("Those candidates have all been invited already.")

    data = agilytics.bulk_invite(workspace_id)
    issued = data.get("invitesIssued", 0)

    now = datetime.now(UTC)
    confirmed: list[str] = []
    confirmed_ids: list[uuid.UUID] = []
    not_in_workspace: list[str] = []
    check_failed: list[str] = []

    for application_id, code, _invited, _joined, email, _name, _track in chosen:
        try:
            status = _confirm_membership(workspace_id, email)
        except AppError:
            # Their side answered the bulk call and not this one. Leaving the
            # candidate unstamped keeps them retryable, which is the safe
            # direction: a missing stamp costs a second invite, a wrong one
            # costs a candidate who is never invited again.
            check_failed.append(code)
            continue

        if status is None:
            not_in_workspace.append(code)
            continue

        application = db.get(Application, application_id)
        if application is not None:
            application.agilytics_invited_at = now
            confirmed.append(code)
            confirmed_ids.append(application_id)

    audit_service.record(
        db,
        actor=actor,
        action="agilytics.invite",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=(
            f"Agilytics: staged {issued} invite(s), confirmed "
            f"{len(confirmed)} candidate(s) for {bootcamp.name}"
        ),
        metadata={
            "workspace_id": workspace_id,
            "invites_issued": issued,
            "confirmed": confirmed,
            "not_in_workspace": not_in_workspace,
            "check_failed": check_failed,
        },
    )

    emailed = failed = 0
    if body_html and confirmed_ids:
        result = email_service.send_to_applications(
            db,
            bootcamp_id,
            application_ids=confirmed_ids,
            subject=subject or f"Your {bootcamp.name} workspace access",
            body_html=body_html,
            template="agilytics_invite",
            actor=actor,
        )
        emailed, failed = result.sent, result.failed

    db.commit()

    return AgilyticsInviteOutcome(
        invites_issued=issued,
        expires_at=data.get("expiresAt"),
        confirmed=confirmed,
        not_in_workspace=not_in_workspace,
        check_failed=check_failed,
        emailed=emailed,
        email_failed=failed,
    )


def sync_joins(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> AgilyticsJoinSyncResult:
    """Check who has joined, and advance them to ONBOARDED.

    Read-time reconciliation, the shape this codebase uses in place of the
    scheduler it does not have — `_mark_interviewed` on a candidate poll, the
    announced-verdict catch-up on an admin list, phase expiry derived rather
    than swept. Nothing here runs on a timer.

    Deliberately *not* wired into a page load. Each un-joined candidate costs
    one request to their API, because students are reported as counts in the
    workspace-wide response and can only be resolved one address at a time. A
    screen doing this on every render would issue a request per candidate per
    refresh, so it sits behind an explicit action instead.

    Only candidates already stamped as invited are checked, and one who has
    joined is stamped so they are never checked again.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    workspace_id = bootcamp.agilytics_workspace_id
    if not workspace_id:
        raise ConflictError("This intake has not been provisioned in Agilytics yet.")

    pending = [r for r in _eligible_rows(db, bootcamp_id) if r[2] is not None and r[3] is None]

    joined: list[str] = []
    advanced: list[str] = []
    unreachable = 0

    for application_id, code, _invited, _joined, email, _name, _track in pending:
        try:
            status = _confirm_membership(workspace_id, email)
        except AppError:
            unreachable += 1
            continue

        # APPROVED is their word for "this member is in". Everything else —
        # PENDING, REJECTED, REVOKED, LEFT, or absent — is not a join, and
        # only a join advances a stage.
        if status != "APPROVED":
            continue

        application = db.get(Application, application_id)
        if application is None:
            continue

        application.agilytics_joined_at = datetime.now(UTC)
        joined.append(code)

        # The real transition, through the same path every other stage move
        # takes, so this writes a stage_transitions row, an audit row and the
        # candidate's notification rather than quietly setting a column.
        # Attributed to nobody: Agilytics reported it, no admin decided it.
        try:
            application_service.advance_stage(
                db,
                application_id,
                to_stage=ApplicationStage.ONBOARDED,
                actor=None,
                reason="Joined the Agilytics workspace",
            )
            advanced.append(code)
        except (ConflictError, NotFoundError):
            # Already ONBOARDED, or no longer active. The join stamp stands:
            # it records what Agilytics says, independently of whether our
            # own stage needed moving.
            continue

    if joined:
        audit_service.record(
            db,
            actor=actor,
            action="agilytics.sync_joins",
            entity_type="bootcamp",
            entity_id=bootcamp.id,
            summary=f"Agilytics: {len(advanced)} candidate(s) advanced to Onboarded",
            metadata={"workspace_id": workspace_id, "joined": joined, "advanced": advanced},
        )

    db.commit()

    return AgilyticsJoinSyncResult(
        checked=len(pending),
        joined=joined,
        advanced=advanced,
        still_pending=len(pending) - len(joined) - unreachable,
        unreachable=unreachable,
    )
