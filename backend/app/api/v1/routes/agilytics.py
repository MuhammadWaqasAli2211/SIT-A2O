"""Agilytics provisioning, status and invites, per intake.

Every route resolves one of our admins and checks them against the intake
before touching the external service. `PORTAL_AGILYTICS_SECRET` never leaves
the backend — the browser sees results, never a signature it could replay.
"""

import uuid

from fastapi import APIRouter

from app.api.deps import AdminUser, DbSession
from app.schemas.agilytics import (
    AgilyticsInviteRequest,
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
    "/bootcamps/{bootcamp_id}/agilytics/members/{email}",
    response_model=AgilyticsMemberStatus,
)
def member_status(
    bootcamp_id: uuid.UUID, email: str, user: AdminUser, db: DbSession
) -> AgilyticsMemberStatus:
    """One member's status, fetched on demand for a single row."""
    return agilytics_service.member_status(db, user, bootcamp_id, email)
