"""Agilytics provisioning, status and invites, per intake.

Every route resolves one of our admins and checks them against the intake
before touching the external service. `PORTAL_AGILYTICS_SECRET` never leaves
the backend — the browser sees results, never a signature it could replay.
"""

import uuid

from fastapi import APIRouter

from app.api.deps import AdminUser, DbSession
from app.schemas.agilytics import (
    AgilyticsEligibleList,
    AgilyticsMemberStatus,
    AgilyticsOnboardOutcome,
    AgilyticsOnboardRequest,
    AgilyticsProvisionResult,
    AgilyticsWorkspaceState,
    AgilyticsWorkspaceStats,
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


@router.delete(
    "/bootcamps/{bootcamp_id}/agilytics", response_model=AgilyticsWorkspaceState
)
def unlink(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> AgilyticsWorkspaceState:
    """Forget this intake's workspace id, for one deleted directly on Agilytics.

    Never calls Agilytics — see `agilytics_service.unlink` for why an admin's
    confirmation is the only signal this can act on right now.
    """
    return agilytics_service.unlink(db, user, bootcamp_id)


@router.get(
    "/bootcamps/{bootcamp_id}/agilytics/stats", response_model=AgilyticsWorkspaceStats
)
def workspace_stats(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> AgilyticsWorkspaceStats:
    """Workspace health: roles, statuses, per-track progress, activation.

    A different endpoint from the one behind `GET .../agilytics` above, not a
    richer view of it — theirs return different things, and only this one
    reports per-track onboarded/pending counts and account activation.
    """
    return agilytics_service.workspace_stats(db, user, bootcamp_id)


@router.get(
    "/bootcamps/{bootcamp_id}/agilytics/eligible", response_model=AgilyticsEligibleList
)
def eligible(
    bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession
) -> AgilyticsEligibleList:
    """Who this intake could onboard, split by already-onboarded.

    Eligibility is having cleared the Physical Interview — nothing to do with
    form or document progress. Read-only; no Agilytics call is made.
    """
    return agilytics_service.eligible(db, user, bootcamp_id)


@router.post(
    "/bootcamps/{bootcamp_id}/agilytics/onboard", response_model=AgilyticsOnboardOutcome
)
def onboard(
    bootcamp_id: uuid.UUID,
    payload: AgilyticsOnboardRequest,
    user: AdminUser,
    db: DbSession,
) -> AgilyticsOnboardOutcome:
    """Make the selected candidates APPROVED members of the workspace.

    Immediate: there is no invitation and no acceptance step, so a candidate
    named here is a member when this returns. Each one is then advanced to
    ONBOARDED and emailed their first-login instructions.
    """
    return agilytics_service.onboard(
        db, user, bootcamp_id, application_ids=payload.application_ids
    )


@router.get(
    "/bootcamps/{bootcamp_id}/agilytics/members/{email}",
    response_model=AgilyticsMemberStatus,
)
def member_status(
    bootcamp_id: uuid.UUID, email: str, user: AdminUser, db: DbSession
) -> AgilyticsMemberStatus:
    """One member's status, fetched on demand for a single row."""
    return agilytics_service.member_status(db, user, bootcamp_id, email)
