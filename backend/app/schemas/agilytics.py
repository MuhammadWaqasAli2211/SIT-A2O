"""Agilytics provisioning and status, as our own API shapes them.

Unlike the AI Interviewer schemas, these are closed models rather than raw
dicts. Their API is documented and its responses have a stated shape, so
there is nothing to lose by naming the fields — and the screen that reads
them wants a stable contract, not whatever came back.

Field names are snake_case here even though theirs are camelCase. The
translation happens once, in agilytics_service, rather than leaking their
convention through our API into the frontend.
"""

import uuid

from pydantic import BaseModel, Field


class AgilyticsProvisionResult(BaseModel):
    """What provisioning did, or — from `preview` — what it would do."""

    workspace_id: str | None = None
    already_provisioned: bool = False
    tracks: list[str] = []
    students: int = 0
    leads: int = 0
    # Shown in the confirm step on purpose: provisioning creates accounts for
    # these people in a third-party system, and the admin pressing the button
    # should see whose before they do.
    lead_emails: list[str] = []


class AgilyticsMemberStatus(BaseModel):
    email: str
    full_name: str | None = None
    status: str | None = None
    role: str | None = None
    track_name: str | None = None
    joined_at: str | None = None


class AgilyticsWorkspaceState(BaseModel):
    """The intake's Agilytics side.

    `provisioned: False` is the ordinary state before anyone has pressed the
    button, not an error — every other field is empty in that case.
    """

    provisioned: bool
    workspace_id: str | None = None
    workspace_name: str | None = None
    total_members: int | None = None
    approved: int | None = None
    pending: int | None = None
    # Keyed by lowercased email. Covers the leads only: their workspace-wide
    # response enumerates leads and reports students as counts. See
    # agilytics_service._member_index.
    members: dict[str, AgilyticsMemberStatus] = {}


class AgilyticsInviteRequest(BaseModel):
    """What to invite, and who to tell about it.

    The two halves are independent because their API and ours can each only
    do one. `application_ids` never reaches Agilytics — their bulk-invite
    takes no member list and covers every pending member regardless — it
    selects who receives *our* covering email.
    """

    application_ids: list[uuid.UUID] = Field(default_factory=list)
    subject: str | None = Field(default=None, max_length=300)
    body_html: str | None = Field(default=None, max_length=20_000)


class AgilyticsInviteResult(BaseModel):
    invites_issued: int
    expires_at: str | None = None
    # Our covering email, not theirs. Zero when none was requested.
    emailed: int = 0
    email_failed: int = 0
