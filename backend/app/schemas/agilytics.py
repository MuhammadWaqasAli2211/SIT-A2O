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
from datetime import datetime

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


class AgilyticsTrackCount(BaseModel):
    track_id: str | None = None
    track_name: str | None = None
    member_count: int = 0


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
    # The rest of their statusBreakdown. Read but previously discarded — the
    # HR screen only needed approved/pending, whereas the stats page wants the
    # whole distribution, and a member who left or was revoked is exactly the
    # kind of thing a join-rate figure must not quietly omit.
    left: int | None = None
    rejected: int | None = None
    revoked: int | None = None
    # roleBreakdown / trackBreakdown, likewise already returned by their
    # endpoint and not previously surfaced.
    leads_count: int | None = None
    sub_leads_count: int | None = None
    students_count: int | None = None
    tracks: list[AgilyticsTrackCount] = []
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


class AgilyticsCandidateRow(BaseModel):
    """One candidate as the invite modal and the folder badges show them."""

    application_id: uuid.UUID
    candidate_code: str
    full_name: str | None = None
    email: str
    program_title: str | None = None
    # None on both means "not invited"; invited without joined means "invited";
    # joined means they are a member and have been advanced to ONBOARDED.
    invited_at: datetime | None = None
    joined_at: datetime | None = None


class AgilyticsEligibleList(BaseModel):
    """Who the invite modal is about to invite, and who it deliberately is not.

    `already_invited` is carried alongside so the modal can say "12 eligible,
    9 already invited, 3 new" rather than only showing the three and leaving
    an admin wondering where everyone went.
    """

    provisioned: bool
    workspace_id: str | None = None
    new: list[AgilyticsCandidateRow] = []
    already_invited: list[AgilyticsCandidateRow] = []


class AgilyticsInviteOutcome(BaseModel):
    """The result of a verified bulk invite.

    `invites_issued` is Agilytics' own aggregate — how many tokens their
    endpoint staged across the whole workspace, which is not the same as how
    many of *our* candidates it covered. `confirmed` is that second number:
    the candidates whose membership we then checked one by one and stamped.

    `not_in_workspace` is the gap that matters. Their API has no add-member
    endpoint, so anyone who reached onboarding after the workspace was
    provisioned is simply not there — they come back from the per-member
    lookup as a 404, are left unstamped, and stay eligible for a retry once
    somebody can add them.
    """

    invites_issued: int
    expires_at: str | None = None
    confirmed: list[str] = []
    not_in_workspace: list[str] = []
    check_failed: list[str] = []
    emailed: int = 0
    email_failed: int = 0


class AgilyticsJoinSyncResult(BaseModel):
    """What a join reconciliation found.

    `advanced` is the important one: those candidates were moved to ONBOARDED,
    which is a real stage transition with its own audit row and notification.
    """

    checked: int = 0
    joined: list[str] = []
    advanced: list[str] = []
    still_pending: int = 0
    unreachable: int = 0


class AgilyticsCandidateInviteRequest(BaseModel):
    """Who to confirm and stamp after the bulk call.

    Named apart from `AgilyticsInviteRequest` above because it means something
    different: that one's `application_ids` chose who received our covering
    email, this one's chooses whose Agilytics membership is verified and
    stamped. Neither can narrow the bulk-invite itself.
    """

    application_ids: list[uuid.UUID] = Field(min_length=1)
    subject: str | None = Field(default=None, max_length=300)
    body_html: str | None = Field(default=None, max_length=20_000)
