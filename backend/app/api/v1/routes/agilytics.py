"""Agilytics provisioning, status and invites, per intake.

Every route resolves one of our admins and checks them against the intake
before touching the external service. `PORTAL_AGILYTICS_SECRET` never leaves
the backend — the browser sees results, never a signature it could replay.
"""

import uuid

from fastapi import APIRouter

from app.api.deps import AdminUser, DbSession
from app.schemas.agilytics import (
    AgilyticsCandidateInviteRequest,
    AgilyticsEligibleList,
    AgilyticsInviteOutcome,
    AgilyticsInviteRequest,
    AgilyticsJoinSyncResult,
    AgilyticsInviteResult,
    AgilyticsMemberStatus,
    AgilyticsProvisionResult,
    AgilyticsWorkspaceState,
)
from app.services import agilytics_service

router = APIRouter(tags=["agilytics"])


@router.get(
    "/bootcamps/{bootcamp_id}/agilytics", response_model=AgilyticsWorkspaceState
)
def workspace_state(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> AgilyticsWorkspaceState:
    """This intake's Agilytics side. `provisioned: false` before it exists —
    not a 404, because not-yet-provisioned is the normal starting state."""
    return agilytics_service.workspace_state(db, user, bootcamp_id)


@router.get(
    "/bootcamps/{bootcamp_id}/agilytics/preview", response_model=AgilyticsProvisionResult
)
def provision_preview(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> AgilyticsProvisionResult:
    """What provisioning would send. Read-only — nothing is created.

    Exists because their provisioning call cannot be undone from our side:
    the admin confirms against real counts rather than pressing a button and
    finding out.
    """
    return agilytics_service.preview(db, user, bootcamp_id)


@router.post("/bootcamps/{bootcamp_id}/agilytics", response_model=AgilyticsProvisionResult)
def provision(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> AgilyticsProvisionResult:
    """Create the workspace and link it to this intake.

    Refused if one already exists — their endpoint is not idempotent and
    would create a duplicate we could not delete.
    """
    return agilytics_service.provision(db, user, bootcamp_id)


@router.post(
    "/bootcamps/{bootcamp_id}/agilytics/invites", response_model=AgilyticsInviteResult
)
def send_invites(
    bootcamp_id: uuid.UUID,
    payload: AgilyticsInviteRequest,
    user: AdminUser,
    db: DbSession,
) -> AgilyticsInviteResult:
    """Issue Agilytics invites, and optionally email the selected candidates.

    `application_ids` does not narrow the Agilytics half — their endpoint
    takes no member list and always covers every pending member. It selects
    who receives our own covering email. Safe to repeat.
    """
    return AgilyticsInviteResult.model_validate(
        agilytics_service.send_invites(
            db,
            user,
            bootcamp_id,
            application_ids=payload.application_ids,
            subject=payload.subject,
            body_html=payload.body_html,
        )
    )


@router.get(
    "/bootcamps/{bootcamp_id}/agilytics/eligible", response_model=AgilyticsEligibleList
)
def eligible(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> AgilyticsEligibleList:
    """Who this intake could invite to Agilytics, split by already-invited.

    Eligibility is having cleared the Physical Interview — nothing to do with
    form or document progress. Read-only; no Agilytics call is made.
    """
    return agilytics_service.eligible(db, user, bootcamp_id)


@router.post(
    "/bootcamps/{bootcamp_id}/agilytics/invite", response_model=AgilyticsInviteOutcome
)
def invite(
    bootcamp_id: uuid.UUID,
    payload: AgilyticsCandidateInviteRequest,
    user: AdminUser,
    db: DbSession,
) -> AgilyticsInviteOutcome:
    """Stage invites, then confirm membership per candidate before stamping.

    Their bulk-invite covers every pending member of the workspace and cannot
    be narrowed, so `application_ids` says whose membership to confirm and
    stamp afterwards — not who Agilytics invites.
    """
    return agilytics_service.invite(
        db,
        user,
        bootcamp_id,
        application_ids=payload.application_ids,
        subject=payload.subject,
        body_html=payload.body_html,
    )


@router.post(
    "/bootcamps/{bootcamp_id}/agilytics/sync-joins", response_model=AgilyticsJoinSyncResult
)
def sync_joins(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> AgilyticsJoinSyncResult:
    """Check invited candidates for a join, and advance those who have to
    ONBOARDED.

    An explicit action rather than something a page load triggers: it costs
    one request to Agilytics per un-joined candidate, because their
    workspace-wide response reports students as counts only.
    """
    return agilytics_service.sync_joins(db, user, bootcamp_id)


@router.get(
    "/bootcamps/{bootcamp_id}/agilytics/members/{email}",
    response_model=AgilyticsMemberStatus,
)
def member_status(
    bootcamp_id: uuid.UUID, email: str, user: AdminUser, db: DbSession
) -> AgilyticsMemberStatus:
    """One member's status, fetched on demand for a single row."""
    return agilytics_service.member_status(db, user, bootcamp_id, email)
