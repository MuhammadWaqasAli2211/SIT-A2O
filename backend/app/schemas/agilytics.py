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
    """What provisioning did, or — from `preview` — what it would do.

    No `tracks`: their provisioning call no longer accepts or creates them,
    so reporting a track list here would describe something that did not
    happen. Tracks are configured in their workspace and mapped per program
    (`programs.agilytics_track_name`).

    The student figures are split the way their `summary.students` splits
    them, because the distinction is the useful part: re-running provisioning
    on an intake that has grown should show mostly `already_existed`, and a
    number that does not add up is the signal something is wrong.
    """

    workspace_id: str | None = None
    already_provisioned: bool = False
    students: int = 0
    students_created: int = 0
    students_already_existed: int = 0
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


class AgilyticsTrackProgress(BaseModel):
    """One track's figures from `/stats`.

    Distinct from `AgilyticsTrackCount` above, which models the *same-named*
    field on `onboarding-status`. Their two endpoints genuinely disagree:
    this one splits a track into onboarded and pending, that one reports a
    single membership count. Two shapes, two models, rather than one lossy
    union of both.
    """

    track_id: str | None = None
    track_name: str | None = None
    total_students: int = 0
    onboarded: int = 0
    pending: int = 0


class AgilyticsActivationHealth(BaseModel):
    """How many student accounts have actually been verified.

    Only `/stats` reports this. Surfaced exactly as given: their spec also
    says accounts are created auto-verified, which sits awkwardly with a
    non-zero `unverified`, but reinterpreting a partner's own figure is how
    a dashboard starts lying. It shows their number.
    """

    total_students: int = 0
    verified: int = 0
    unverified: int = 0


class AgilyticsWorkspaceStats(BaseModel):
    """`GET /workspaces/{id}/stats` — the Onboarded stats tab's source.

    Richer than `AgilyticsWorkspaceState` and does not replace it: that one
    is built from `onboarding-status`, which is the only endpoint carrying
    the `leads` roster and the `?email=` single-member lookup the HR screen
    needs. This one carries per-track progress and activation health, which
    that one has never had.

    `provisioned: False` is the ordinary pre-provisioning state, not an
    error — every other field is empty in that case.
    """

    provisioned: bool
    workspace_id: str | None = None
    workspace_name: str | None = None
    total_members: int | None = None

    leads_count: int | None = None
    sub_leads_count: int | None = None
    students_count: int | None = None

    approved: int | None = None
    pending: int | None = None
    left: int | None = None
    rejected: int | None = None
    revoked: int | None = None

    tracks: list[AgilyticsTrackProgress] = []
    activation: AgilyticsActivationHealth | None = None


class AgilyticsCandidateRow(BaseModel):
    """One candidate as the onboard modal and the folder badges show them."""

    application_id: uuid.UUID
    candidate_code: str
    full_name: str | None = None
    email: str
    program_title: str | None = None
    # What we will send as `trackName`, from this candidate's program. Null
    # means the program has no Agilytics mapping set and the student will be
    # onboarded ungrouped — shown in the modal so that is a visible choice
    # rather than a silent one.
    track_name: str | None = None
    # Null means not yet onboarded. There is no second state: their onboard
    # call makes a student an APPROVED member outright.
    onboarded_at: datetime | None = None


class AgilyticsEligibleList(BaseModel):
    """Who the onboard modal is about to send, and who it deliberately is not.

    `already_onboarded` is carried alongside so the modal can say "12
    eligible, 9 already onboarded, 3 new" rather than only showing the three
    and leaving an admin wondering where everyone went.

    `unmapped_programs` names the programs among the *new* rows that have no
    `agilytics_track_name`. Surfaced because their API accepts an unmatched
    track silently: without this the modal cannot warn, and the mistake only
    becomes visible much later as a workspace full of ungrouped students.
    """

    provisioned: bool
    workspace_id: str | None = None
    new: list[AgilyticsCandidateRow] = []
    already_onboarded: list[AgilyticsCandidateRow] = []
    unmapped_programs: list[str] = []


class AgilyticsOnboardOutcome(BaseModel):
    """The result of an onboard call.

    Every figure here comes from their per-email `results` array rather than
    being inferred, which is the substantive gain over the endpoint this
    replaced: `bulk-invite` answered with one aggregate count and forced a
    follow-up lookup per candidate to learn who it had actually covered.

    `skipped_not_found` is the one that needs acting on. It means the student
    has no account on their side yet — provisioning has not run for them —
    and is the case a candidate who reached onboarding after the workspace
    was created falls into.

    `ungrouped` counts students onboarded with no track resolved, whether
    because their program has no mapping or because the mapped name matched
    nothing in the workspace. Their API does not distinguish those two, and
    reports neither as an error.
    """

    onboarded: list[str] = []
    skipped_already_member: list[str] = []
    skipped_not_found: list[str] = []
    skipped_other: list[str] = []
    ungrouped: int = 0
    track_distribution: dict[str, int] = {}
    # Our own email, sent after a successful onboard. Theirs sends nothing.
    emailed: int = 0
    email_failed: int = 0
    # Candidates moved to ONBOARDED as a result — a real stage transition,
    # audited and notified, not a column write.
    advanced: list[str] = []


class AgilyticsOnboardRequest(BaseModel):
    """Which candidates to onboard.

    Unlike the request this replaces, the selection is real: their onboard
    endpoint takes the member list, so choosing three candidates onboards
    exactly those three.
    """

    application_ids: list[uuid.UUID] = Field(min_length=1)
