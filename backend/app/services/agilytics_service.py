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

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ServiceNotConfiguredError
from app.integrations import agilytics
from app.models.application import Application
from app.models.bootcamp import Bootcamp, BootcampAdmin, Program
from app.models.user import Profile
from app.schemas.agilytics import (
    AgilyticsMemberStatus,
    AgilyticsProvisionResult,
    AgilyticsWorkspaceState,
)
from app.services import (
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
    return AgilyticsWorkspaceState(
        provisioned=True,
        workspace_id=bootcamp.agilytics_workspace_id,
        workspace_name=data.get("workspaceName"),
        total_members=data.get("totalMembers"),
        approved=breakdown.get("approved"),
        pending=breakdown.get("pending"),
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
