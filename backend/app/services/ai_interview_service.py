"""Reads and writes against the AI Interviewer API, scoped to our own roles.

Every function here takes our `Profile` and enforces our access model before
touching the external service. The API key itself is unscoped-per-user — it
carries all ten scopes for the whole company — so *our* checks are the only
thing standing between an admin and another intake's data. Nothing in this
module may be called from a route that has not already resolved a user.

Two scoping problems worth knowing about, both resolved conservatively:

1. Their service has no concept of our bootcamps. The only link is the
   `interview_invites` rows we wrote when we invited someone, so an external
   interview is "in" a bootcamp exactly when we can trace its candidate back
   to an invite in that bootcamp. An interview we can't trace is visible to
   super admins only — it belongs to someone we did not invite.

2. Their `/audit-log` and `/analytics/summary` are tenant-wide with no filter.
   Passing either straight through to a bootcamp-scoped admin would leak
   other intakes. So the audit read is super-admin only, and an admin's
   analytics are computed from their own bootcamp's interviews rather than
   from that endpoint.
"""

import uuid
from datetime import UTC, datetime, timedelta
from html import escape
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy import true as sa_true
from sqlalchemy.orm import Session

from app.core.exceptions import (
    AppError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)
from app.integrations import interviewer_ai
from app.models.application import Application
from app.models.bootcamp import Bootcamp, BootcampAdmin, Program
from app.models.enums import AiScope, EmailStatus, UserRole
from app.models.interview_invite import InterviewInvite, InterviewInviteBatch
from app.models.notification import Notification
from app.models.ops import EmailLog
from app.models.user import Profile
from app.services import audit_service, bootcamp_service, email_service, permission_service

# Field names their API might use for the headline score. Undocumented and
# unobservable today (no completed interviews exist), so we look for any of
# them rather than committing to one that may not be there. Order is
# preference, not likelihood.
_SCORE_KEYS = (
    "overall_score",
    "final_score",
    "total_score",
    "score",
    "overall",
    "percentage",
)

# Where a score might sit if it is nested rather than top-level.
_SCORE_CONTAINERS = ("scoring", "report", "result", "summary", "evaluation")

_COMPLETED_STATUSES = {"completed", "complete", "finished", "done", "evaluated"}

# Decided 2026-08-30: 50/100. A fact about the number, not an automated
# verdict — nothing here rejects a candidate on its own account, an admin
# still makes that call (see the stage-advance actions on the report screen).
PASS_THRESHOLD = 50.0


def _as_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip().rstrip("%"))
        except ValueError:
            return None
    return None


def extract_score(payload: dict | None) -> float | None:
    """Pull a headline score out of an interview or report body.

    Returns None rather than guessing when nothing recognisable is present —
    a candidate seeing "0" because we failed to find their score would be
    worse than seeing "not available yet".
    """
    if not isinstance(payload, dict):
        return None

    for key in _SCORE_KEYS:
        found = _as_number(payload.get(key))
        if found is not None:
            return found

    for container in _SCORE_CONTAINERS:
        nested = payload.get(container)
        if isinstance(nested, dict):
            for key in _SCORE_KEYS:
                found = _as_number(nested.get(key))
                if found is not None:
                    return found
    return None


def is_completed(payload: dict | None) -> bool:
    if not isinstance(payload, dict):
        return False
    return str(payload.get("status", "")).strip().lower() in _COMPLETED_STATUSES


# ------------------------------------------------------------- correlation --


def _bootcamp_for_candidate(
    db: Session, *, external_candidate_id: int | None = None, email: str | None = None
) -> uuid.UUID | None:
    """Which of our bootcamps invited this external candidate, if any.

    Matches on the stored external id first and falls back to email, which is
    the only link available for invites sent before the id was captured.
    """
    conditions = []
    if external_candidate_id is not None:
        conditions.append(InterviewInvite.external_candidate_id == external_candidate_id)
    if email:
        conditions.append(func.lower(InterviewInvite.email) == email.strip().lower())
    if not conditions:
        return None

    return db.scalar(
        select(InterviewInviteBatch.bootcamp_id)
        .join(InterviewInvite, InterviewInvite.batch_id == InterviewInviteBatch.id)
        .where(or_(*conditions))
        .order_by(InterviewInvite.created_at.desc())
        .limit(1)
    )


def _identity_of(interview: dict) -> tuple[int | None, str | None]:
    """The external candidate id and email an interview record carries, under
    whichever of several plausible key names their payload uses."""
    candidate = interview.get("candidate")
    if isinstance(candidate, dict):
        raw_id = candidate.get("id")
        email = candidate.get("email")
    else:
        raw_id = interview.get("candidate_id") or interview.get("user_id")
        email = interview.get("candidate_email") or interview.get("email")

    external_id = int(raw_id) if isinstance(raw_id, (int, str)) and str(raw_id).isdigit() else None
    return external_id, (str(email) if email else None)


def _assert_can_view(db: Session, user: Profile, interview: dict) -> None:
    """An admin may see an interview only when we can trace its candidate to
    a bootcamp they manage. Untraceable interviews are super-admin only."""
    if user.role == UserRole.SUPER_ADMIN:
        return

    external_id, email = _identity_of(interview)
    bootcamp_id = _bootcamp_for_candidate(db, external_candidate_id=external_id, email=email)
    if bootcamp_id is None:
        raise PermissionDeniedError(
            "This interview is not linked to any intake you manage."
        )
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)


def _invited_identities(db: Session, bootcamp_id: uuid.UUID) -> tuple[set[int], set[str]]:
    """Every external candidate id and email this bootcamp has invited."""
    ids, emails, _ = _invited_index(db, bootcamp_id)
    return ids, emails


def _invited_index(
    db: Session, bootcamp_id: uuid.UUID | None = None
) -> tuple[set[int], set[str], dict[str, dict]]:
    """Who this bootcamp invited, and what *we* know about them.

    The third value is the fix for candidates rendering as "Unknown
    candidate": their interview payloads are undocumented and may carry no
    name under any key we recognise, so the name is taken from our own joined
    record instead of from whatever their API happened to return. Keyed by
    both external id and lowercased email, so a record matches on either.
    """
    rows = db.execute(
        select(
            InterviewInvite.external_candidate_id,
            InterviewInvite.email,
            InterviewInvite.full_name,
            Application.id,
            Application.candidate_code,
            Application.stage,
            Application.status,
            Profile.full_name,
            InterviewInviteBatch.bootcamp_id,
            Bootcamp.name,
            Program.title,
        )
        .join(InterviewInviteBatch, InterviewInvite.batch_id == InterviewInviteBatch.id)
        .outerjoin(Application, Application.id == InterviewInvite.application_id)
        .outerjoin(Profile, Profile.id == Application.profile_id)
        .outerjoin(Bootcamp, Bootcamp.id == InterviewInviteBatch.bootcamp_id)
        .outerjoin(Program, Program.id == Application.program_id)
        # No bootcamp means every intake — used for the super admin's unscoped
        # view, where narrowing per intake would be one query per bootcamp.
        .where(
            InterviewInviteBatch.bootcamp_id == bootcamp_id
            if bootcamp_id is not None
            else sa_true()
        )
    ).all()

    ids: set[int] = set()
    emails: set[str] = set()
    index: dict[str, dict] = {}

    for (
        external_id,
        email,
        invite_name,
        application_id,
        code,
        app_stage,
        app_status,
        profile_name,
        row_bootcamp_id,
        bootcamp_name,
        program_title,
    ) in rows:
        # The profile is the most authoritative name we hold; the invite row's
        # copy covers manually-added rows that have no application behind them.
        known = {
            "candidate_name": profile_name or invite_name,
            "candidate_code": code,
            "application_id": str(application_id) if application_id else None,
            # The application's live stage/status, so the report screen can
            # offer "advance to Physical Interview" / "reject" without a
            # second lookup — and so it knows when not to (already moved on,
            # or no longer ACTIVE).
            "application_stage": app_stage.value if app_stage else None,
            "application_status": app_status.value if app_status else None,
            "email": email,
            "bootcamp_id": str(row_bootcamp_id) if row_bootcamp_id else None,
            "bootcamp_name": bootcamp_name,
            "program_title": program_title,
        }
        if external_id is not None:
            ids.add(external_id)
            index[f"id:{external_id}"] = known
        if email:
            lowered = email.strip().lower()
            emails.add(lowered)
            index[f"email:{lowered}"] = known

    return ids, emails, index


def _hydrate(record: dict, index: dict[str, dict]) -> dict:
    """Attach what we know about the candidate to one of their records.

    Written under `local` rather than merged over the top level so their own
    fields are never silently overwritten by ours — the UI reads `local`
    first and falls back, and anyone debugging can still see exactly what
    their API returned.
    """
    external_id, email = _identity_of(record)
    known = None
    if external_id is not None:
        known = index.get(f"id:{external_id}")
    if known is None and email:
        known = index.get(f"email:{email.strip().lower()}")
    return {**record, "local": known} if known else {**record, "local": None}


# -------------------------------------------------------- admin: read side --


def list_for_bootcamp(
    db: Session, bootcamp_id: uuid.UUID, actor: Profile, *, limit: int = 50, offset: int = 0
) -> list[dict]:
    """Their interviews, narrowed to candidates this bootcamp invited.

    The filtering is ours, not theirs — their list endpoint has no bootcamp
    parameter — so we over-fetch and discard. Fine at current volumes; if a
    tenant ever holds tens of thousands of interviews this needs their side
    to grow a filter.
    """
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
    ids, emails, index = _invited_index(db, bootcamp_id)
    if not ids and not emails:
        return []

    interviews, _ = interviewer_ai.list_interviews(limit=limit, offset=offset)
    matched = []
    for interview in interviews:
        external_id, email = _identity_of(interview)
        if external_id in ids or (email and email.strip().lower() in emails):
            # Hydrated here rather than in the client: we matched this record
            # against our own invite rows a line ago, so the name is already
            # in hand and the UI should never have to guess it.
            matched.append(_hydrate(interview, index))
    return matched


# Matches analytics()'s own bound below, for the same reason: their list
# endpoint has no bootcamp filter, so this is how much gets over-fetched and
# discarded per request. Fine at current volumes; a tenant with thousands of
# completed interviews needs their side to grow a real filter.
_COMPLETED_FETCH_LIMIT = 200


def list_completed(db: Session, actor: Profile, bootcamp_id: uuid.UUID | None = None) -> dict:
    """Every completed AI interview visible to this actor, plus the summary
    figures the Completed Interviews screen shows above the table.

    One DB query (`_invited_index`) and one external HTTP call
    (`interviewer_ai.list_interviews`), regardless of row count and whether
    the view is bootcamp-scoped or platform-wide — the same round-trip
    discipline as the 2026-08-29 dashboard fix. Stats are computed here, over
    the same fetch, rather than as a second call: the alternative would be a
    second external round trip to answer figures this screen already has the
    data for.

    Status filtering happens on our side with `is_completed()`, not by
    passing `status=` to their API. Their real spelling is unverified — their
    docs say "completed", a live batch once returned "complete" (see
    interview_invite_service.py) — and trusting their filter to interpret
    ours correctly risks silently returning nothing.
    """
    if bootcamp_id is not None:
        bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
        ids, emails, index = _invited_index(db, bootcamp_id)
    elif actor.role == UserRole.SUPER_ADMIN:
        # Unscoped: every intake in one query, not one query per bootcamp.
        ids, emails, index = _invited_index(db)
    else:
        raise NotFoundError("Select an intake to see its completed interviews.")

    empty_stats = {
        "total": 0,
        "completed_today": 0,
        "completed_this_week": 0,
        "average_score": None,
    }
    if not ids and not emails:
        return {"items": [], "stats": empty_stats}

    interviews, _ = interviewer_ai.list_interviews(limit=_COMPLETED_FETCH_LIMIT)
    matched = []
    for interview in interviews:
        if not is_completed(interview):
            continue
        external_id, email = _identity_of(interview)
        if external_id in ids or (email and email.strip().lower() in emails):
            matched.append(_hydrate(interview, index))

    return {"items": matched, "stats": _completed_stats(matched)}


def _completed_at(item: dict) -> datetime | None:
    raw = item.get("completed_at") or item.get("updated_at") or item.get("created_at")
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    # Their timestamps are not guaranteed to carry a timezone; treat a naive
    # one as UTC rather than let the "today"/"this week" comparison below
    # raise on comparing naive and aware datetimes.
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _completed_stats(items: list[dict]) -> dict:
    """The stat-card row: computed in Python over an already-fetched list, not
    a second query or a second external call."""
    now = datetime.now(UTC)
    week_ago = now - timedelta(days=7)

    completed_today = 0
    completed_this_week = 0
    scores: list[float] = []

    for item in items:
        when = _completed_at(item)
        if when is not None:
            if when.date() == now.date():
                completed_today += 1
            if when >= week_ago:
                completed_this_week += 1
        score = extract_score(item)
        if score is not None:
            scores.append(score)

    return {
        "total": len(items),
        "completed_today": completed_today,
        "completed_this_week": completed_this_week,
        "average_score": round(sum(scores) / len(scores), 1) if scores else None,
    }


def get_interview(db: Session, interview_id: int, actor: Profile) -> dict:
    interview = interviewer_ai.get_interview(interview_id)
    _assert_can_view(db, actor, interview)
    return _hydrate_one(db, interview)


def _hydrate_one(db: Session, record: dict) -> dict:
    """Attach our own candidate details to a single record.

    Not bootcamp-scoped, because the caller has already established the actor
    may see this record — re-deriving the scope here would only repeat that
    query.
    """
    external_id, email = _identity_of(record)
    conditions = []
    if external_id is not None:
        conditions.append(InterviewInvite.external_candidate_id == external_id)
    if email:
        conditions.append(func.lower(InterviewInvite.email) == email.strip().lower())
    if not conditions:
        return {**record, "local": None}

    row = db.execute(
        select(
            InterviewInvite.full_name,
            Application.id,
            Application.candidate_code,
            Profile.full_name,
            InterviewInvite.email,
        )
        .outerjoin(Application, Application.id == InterviewInvite.application_id)
        .outerjoin(Profile, Profile.id == Application.profile_id)
        .where(or_(*conditions))
        .order_by(InterviewInvite.created_at.desc())
        .limit(1)
    ).first()
    if row is None:
        return {**record, "local": None}

    invite_name, application_id, code, profile_name, invite_email = row
    return {
        **record,
        "local": {
            "candidate_name": profile_name or invite_name,
            "candidate_code": code,
            "application_id": str(application_id) if application_id else None,
            "email": invite_email,
        },
    }


def get_report(db: Session, interview_id: int, actor: Profile) -> dict:
    """Full per-question report. Admin-facing; never reaches a candidate."""
    self_check = interviewer_ai.get_interview(interview_id)
    _assert_can_view(db, actor, self_check)
    return interviewer_ai.get_interview_report(interview_id)


def get_recording(db: Session, interview_id: int, actor: Profile) -> dict:
    """Their URL for the session video.

    We return their signed URL rather than mirroring the file: the external
    service stays the source of truth (decided 2026-08-29). Our API key is
    never included in what we hand back — only the URL their API already
    signed for playback.
    """
    self_check = interviewer_ai.get_interview(interview_id)
    _assert_can_view(db, actor, self_check)
    return interviewer_ai.get_interview_recording(interview_id)


def list_snapshots(db: Session, interview_id: int, actor: Profile) -> list[dict]:
    self_check = interviewer_ai.get_interview(interview_id)
    _assert_can_view(db, actor, self_check)
    snapshots, _ = interviewer_ai.list_proctor_snapshots(interview_id=interview_id, limit=100)
    return snapshots


# ------------------------------------------------------- admin: write side --


def delete_interview(db: Session, interview_id: int, actor: Profile) -> None:
    """Deletes the record on *their* side only.

    Deliberately not wired to our own `POST /interviews/{id}/cancel`: that
    cancels a scheduled Phase 3 physical interview, a different object with a
    different meaning. Confirmed as separate actions, 2026-08-29.
    """
    # Our own permission first, before any outbound call. Fetching the record
    # to check bootcamp scope ahead of the scope check would let an admin who
    # holds no delete grant probe ids and tell an interview that exists from
    # one that does not, by whether they get a 404 or a 403.
    permission_service.assert_scope(db, actor, AiScope.INTERVIEWS_DELETE)

    interview = interviewer_ai.get_interview(interview_id)
    _assert_can_view(db, actor, interview)

    interviewer_ai.delete_interview(interview_id)
    audit_service.record(
        db,
        actor=actor,
        action="ai_interview.delete",
        entity_type="ai_interview",
        summary=f"Deleted AI interview #{interview_id} on InterviewerAI",
        metadata={"external_interview_id": interview_id},
    )
    db.flush()


def list_reinterview_requests(db: Session, actor: Profile, bootcamp_id: uuid.UUID | None = None):
    """Pending second-attempt requests, filtered the same way interviews are."""
    requests, _ = interviewer_ai.list_reinterview_requests(limit=100)

    if actor.role == UserRole.SUPER_ADMIN and bootcamp_id is None:
        # Still hydrated: a super admin looking at every intake at once is the
        # most likely person to meet a record whose payload carries no name.
        _, _, index = _invited_index(db)
        return [_hydrate(request, index) for request in requests]

    if bootcamp_id is not None:
        bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
        ids, emails, index = _invited_index(db, bootcamp_id)
    else:
        ids, emails, index = set(), set(), {}
        for bootcamp in bootcamp_service.visible_bootcamps(db, actor):
            b_ids, b_emails, b_index = _invited_index(db, bootcamp.id)
            ids |= b_ids
            emails |= b_emails
            index |= b_index

    visible = []
    for request in requests:
        external_id, email = _identity_of(request)
        if external_id in ids or (email and email.strip().lower() in emails):
            visible.append(_hydrate(request, index))
    return visible


def decide_reinterview(
    db: Session, request_id: int, actor: Profile, *, approve: bool, note: str | None = None
) -> dict:
    """Approve or refuse a second attempt.

    Logged into our own audit trail as well as theirs, so the decision sits
    beside every other privileged action rather than only in a system our
    admins do not otherwise read.
    """
    permission_service.assert_scope(db, actor, AiScope.REINTERVIEW_DECIDE)

    # Confirm the request is one this actor may act on before deciding it.
    for request in list_reinterview_requests(db, actor):
        if str(request.get("id")) == str(request_id):
            break
    else:
        raise NotFoundError("Reinterview request not found, or not in an intake you manage.")

    result = interviewer_ai.decide_reinterview(request_id, approve=approve, note=note)

    audit_service.record(
        db,
        actor=actor,
        action="ai_interview.reinterview_decision",
        entity_type="ai_interview",
        summary=(
            f"{'Approved' if approve else 'Refused'} reinterview request #{request_id}"
        ),
        metadata={
            "external_request_id": request_id,
            "approved": approve,
            "note": note,
        },
    )
    db.flush()
    return result or {}


# ---------------------------------------------------------------- analytics --


def analytics(db: Session, actor: Profile, bootcamp_id: uuid.UUID | None = None) -> dict:
    """Aggregates.

    A super admin with no bootcamp asked for gets the tenant-wide summary
    straight from their API. Anyone else gets figures computed from the
    interviews their own bootcamp invited — their `/analytics/summary` covers
    the whole company and has no filter, so passing it through would report
    other intakes' numbers to an admin who cannot see those intakes.
    """
    if actor.role == UserRole.SUPER_ADMIN and bootcamp_id is None:
        summary = interviewer_ai.analytics_summary()
        return {
            "scope": "platform",
            "candidates": summary.get("candidates"),
            "interviews_completed": summary.get("interviews_completed"),
            "average_score": summary.get("average_score"),
            "distribution": _distribution([]),
        }

    if bootcamp_id is None:
        raise NotFoundError("Select an intake to see its interview analytics.")

    interviews = list_for_bootcamp(db, bootcamp_id, actor, limit=200)
    completed = [i for i in interviews if is_completed(i)]
    scores = [s for s in (extract_score(i) for i in completed) if s is not None]

    return {
        "scope": "bootcamp",
        "candidates": len(interviews),
        "interviews_completed": len(completed),
        "average_score": round(sum(scores) / len(scores), 1) if scores else None,
        "distribution": _distribution(scores),
    }


def _distribution(scores: list[float]) -> list[dict]:
    """Score histogram in ten-point bands, always all ten buckets so a chart
    keeps a stable x-axis when a band happens to be empty."""
    buckets = [{"band": f"{low}-{low + 9}", "count": 0} for low in range(0, 100, 10)]
    for score in scores:
        index = min(int(score // 10), 9) if score >= 0 else 0
        buckets[index]["count"] += 1
    return buckets


# ---------------------------------------------------------------- the audit --


def audit_entries(db: Session, actor: Profile, *, limit: int = 50, offset: int = 0) -> list[dict]:
    """Their own audit trail, kept as a separate read from ours.

    Super admin only: the endpoint is tenant-wide with no filter, so there is
    no way to show a bootcamp-scoped admin only their own intake's entries.
    """
    if actor.role != UserRole.SUPER_ADMIN:
        raise PermissionDeniedError(
            "The InterviewerAI audit log covers every intake and is restricted "
            "to super administrators."
        )
    entries, _ = interviewer_ai.audit_log(limit=limit, offset=offset)
    return entries


def key_scopes() -> dict:
    """What our API key itself can do, for the permission screen."""
    return interviewer_ai.whoami()


# -------------------------------------------------------- candidate: score --


def candidate_score(db: Session, user: Profile) -> dict:
    """The candidate's own result, and nothing else.

    Returns a deliberately narrow dict — status, score, scale, completion
    time. There is no field here capable of carrying question text, proctor
    data, a recording URL, or an audit entry, so no future edit to a
    serializer can leak one by accident. The full report is fetched by
    `get_report`, which is admin-only and never called from this path.
    """
    empty = {"status": "not_invited", "score": None, "scale": 100, "completed_at": None}

    row = db.execute(
        select(
            InterviewInvite,
            InterviewInviteBatch,
            Application.id,
            Application.bootcamp_id,
            Application.candidate_code,
        )
        .join(InterviewInviteBatch, InterviewInvite.batch_id == InterviewInviteBatch.id)
        .join(Application, Application.id == InterviewInvite.application_id)
        .where(Application.profile_id == user.id)
        .order_by(InterviewInvite.created_at.desc())
        .limit(1)
    ).first()
    if row is None:
        return empty
    invite, batch, application_id, bootcamp_id, candidate_code = row

    # Everything from here carries the deadline, so the portal can count down
    # to it rather than show a bare date.
    base = {**empty, "deadline_at": batch.deadline_at}

    def expired() -> dict:
        """Past the deadline with nothing completed.

        The application is deliberately left where it is — no automatic
        rejection, no automatic progression — and the candidate is offered
        the explanation flow instead of a link that no longer works.
        """
        return {
            **base,
            "status": "expired",
            "can_explain": True,
            "explanation_sent": _explanation_sent(db, application_id),
        }

    external_id = invite.external_candidate_id
    if external_id is None:
        found = interviewer_ai.find_candidate_by_email(invite.email)
        if found is None:
            return expired() if batch.is_expired else {**base, "status": "invited"}
        external_id = found.get("id")
        # Cache it so the next read skips the lookup, and so an email change
        # later cannot break the link.
        if isinstance(external_id, int):
            invite.external_candidate_id = external_id
            db.flush()

    interviews, _ = interviewer_ai.list_interviews(candidate_id=external_id, limit=20)
    if not interviews:
        return expired() if batch.is_expired else {**base, "status": "invited"}

    completed = [i for i in interviews if is_completed(i)]
    if not completed:
        # An interview started but not finished before the deadline counts as
        # missed: the link stops working mid-attempt rather than letting an
        # unfinished session run past the date everyone else was held to.
        return expired() if batch.is_expired else {**base, "status": "in_progress"}

    # Best attempt, not most recent: a candidate who was approved for a
    # second try should not be shown a worse score than one they already got.
    best = max(completed, key=lambda i: extract_score(i) or -1.0)
    score = extract_score(best)
    if score is None:
        # Their record says finished but carries no score we recognise.
        # Reporting "in progress" is honest; inventing a 0 is not.
        return {**base, "status": "in_progress"}

    if invite.admin_notified_at is None:
        # Detected here rather than by a background job: this backend has no
        # scheduler and InterviewerAI sends no webhook, so "a candidate just
        # finished" is only knowable when something asks their own status —
        # which the candidate's own interview page already polls every 10s.
        # Traded off honestly: an admin is notified the next time that poll
        # runs after completion, not the instant it happens. Marked so a
        # second poll does not notify a second time.
        _notify_admins_of_completion(
            db,
            bootcamp_id=bootcamp_id,
            candidate_name=user.full_name or user.email,
            candidate_code=candidate_code,
            application_id=application_id,
            score=score,
        )
        invite.admin_notified_at = datetime.now(UTC)
        db.flush()

    # A completed interview outranks the deadline: someone who finished in
    # time keeps their result even when the phase has since closed.
    return {
        **base,
        "status": "completed",
        "score": round(score, 1),
        "passed": score >= PASS_THRESHOLD,
        "completed_at": best.get("completed_at") or best.get("updated_at"),
    }


def _notify_admins_of_completion(
    db: Session,
    *,
    bootcamp_id: uuid.UUID,
    candidate_name: str,
    candidate_code: str,
    application_id: uuid.UUID,
    score: float,
) -> None:
    """One notification per active admin assigned to the bootcamp, falling
    back to active super admins if none are assigned — same fallback
    `submit_deadline_explanation` uses, so an intake with nobody assigned
    still reaches someone rather than notifying no one."""
    admin_ids = list(
        db.scalars(
            select(Profile.id)
            .join(BootcampAdmin, BootcampAdmin.profile_id == Profile.id)
            .where(BootcampAdmin.bootcamp_id == bootcamp_id, Profile.is_active.is_(True))
        )
    )
    if not admin_ids:
        admin_ids = list(
            db.scalars(
                select(Profile.id).where(
                    Profile.role == UserRole.SUPER_ADMIN, Profile.is_active.is_(True)
                )
            )
        )

    title = "AI interview completed"
    body = f"{candidate_name} ({candidate_code}) finished their AI interview — score {score:.0f}/100."
    for admin_id in admin_ids:
        db.add(
            Notification(
                profile_id=admin_id,
                application_id=application_id,
                title=title,
                body=body,
            )
        )


_EXPLANATION_TEMPLATE = "interview_deadline_explanation"


def submit_deadline_explanation(db: Session, user: Profile, reason: str) -> None:
    """A candidate who missed their interview deadline writes to the admins.

    There is no agent judging the reason (decided 2026-08-29): the candidate
    writes it, it reaches the people who can act on it, and an administrator
    decides. Unsticking them is an ordinary stage move, which is already
    audited — so there is no separate verdict recorded here.

    Stored as an `email_log` row rather than its own table, also decided
    2026-08-29. That means the reason lives in `body_html` and there is no
    accepted/declined column; the trade-off was taken knowingly.
    """
    row = db.execute(
        select(InterviewInvite, InterviewInviteBatch, Application)
        .join(InterviewInviteBatch, InterviewInvite.batch_id == InterviewInviteBatch.id)
        .join(Application, Application.id == InterviewInvite.application_id)
        .where(Application.profile_id == user.id)
        .order_by(InterviewInvite.created_at.desc())
        .limit(1)
    ).first()
    if row is None:
        raise NotFoundError("You have no interview invite to explain.")
    _, batch, application = row

    # Only reachable once the deadline has actually passed. Checked server-side
    # rather than trusting the button being visible.
    if not batch.is_expired:
        raise ConflictError(
            "Your interview deadline has not passed yet — you can still take it."
        )
    if _explanation_sent(db, application.id):
        raise ConflictError(
            "You have already sent an explanation. The team will be in touch."
        )

    recipients = _admin_recipients(db, application.bootcamp_id)
    if not recipients:
        raise ConflictError(
            "There is no administrator assigned to this intake to write to. "
            "Please contact the admissions team directly."
        )

    subject = f"Missed interview deadline — {application.candidate_code}"
    body = (
        f"<p><strong>{user.full_name or user.email}</strong> "
        f"({application.candidate_code}) missed their AI interview deadline "
        f"of {batch.deadline_at:%d %B %Y} and has sent an explanation.</p>"
        f"<p><em>Their message:</em></p>"
        f"<blockquote>{escape(reason)}</blockquote>"
        f"<p>Their application is held at its current stage. To let them "
        f"continue, move their stage from the Candidates screen.</p>"
    )

    sent_any = False
    for email in recipients:
        log = EmailLog(
            bootcamp_id=application.bootcamp_id,
            application_id=application.id,
            recipient_email=email,
            subject=subject,
            template=_EXPLANATION_TEMPLATE,
            body_html=body,
            sent_by=user.id,
        )
        try:
            log.provider_message_id = email_service.send_email(
                to=email, subject=subject, html_body=body
            )
            log.status = EmailStatus.SENT
            sent_any = True
        except AppError as exc:
            # One unreachable admin must not lose the candidate's explanation:
            # the row is written either way, so the message survives even if
            # delivery failed and someone has to chase it.
            log.status = EmailStatus.FAILED
            log.error = f"{exc.code}: {exc.message}"[:500]
        db.add(log)

    # The reason text itself into the audit trail, as well as the mail — asked
    # for explicitly, so there is a record independent of the mailbox.
    audit_service.record(
        db,
        actor=user,
        action="interview.deadline_explanation",
        entity_type="application",
        entity_id=application.id,
        summary=f"{application.candidate_code} explained a missed interview deadline",
        metadata={
            "reason": reason[:2000],
            "deadline_at": batch.deadline_at.isoformat() if batch.deadline_at else None,
            "delivered": sent_any,
        },
    )
    db.flush()


def _admin_recipients(db: Session, bootcamp_id: uuid.UUID) -> list[str]:
    """The intake's own admins, falling back to super admins.

    An intake with nobody assigned would otherwise silently swallow the
    explanation, which is the one outcome the candidate cannot recover from.
    """
    assigned = list(
        db.scalars(
            select(Profile.email)
            .join(BootcampAdmin, BootcampAdmin.profile_id == Profile.id)
            .where(BootcampAdmin.bootcamp_id == bootcamp_id, Profile.is_active.is_(True))
        )
    )
    if assigned:
        return assigned
    return list(
        db.scalars(
            select(Profile.email).where(
                Profile.role == UserRole.SUPER_ADMIN, Profile.is_active.is_(True)
            )
        )
    )


def _explanation_sent(db: Session, application_id: uuid.UUID) -> bool:
    return (
        db.scalar(
            select(EmailLog.id)
            .where(
                EmailLog.application_id == application_id,
                EmailLog.template == _EXPLANATION_TEMPLATE,
            )
            .limit(1)
        )
        is not None
    )
