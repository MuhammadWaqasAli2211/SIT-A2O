"""Thin client over the InterviewerAI partner API (`/api/v1`).

This is a third-party service, not ours: once a candidate is invited here,
InterviewerAI conducts the interview itself — there is no admin-picked time,
the candidate takes it whenever they like. It is the Phase 2 AI screening
step; the interview_service module's scheduled interviews are the Phase 3
physical/HR round instead. See docs/project-status.md for how that split was
decided.

Only the `/api/v1` namespace belongs to us. Their `/api/admin/*` and
`/api/superadmin/*` routes are their own product's UI talking to itself with
a session cookie; our key does not carry those rights and must not be pointed
at them.

**Their responses are undocumented.** The OpenAPI spec they publish types the
query parameters but leaves every `/api/v1` response schema empty, and as of
2026-08-29 their tenant holds no completed interviews to read a real shape
from. Everything below therefore returns raw dicts and every caller treats
fields as optional — see app/services/ai_interview_service.py, which does the
normalising. Guessing a schema here and having it silently not match is the
failure this avoids.
"""

from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    ServiceNotConfiguredError,
    UpstreamError,
)


def _detail_message(response: httpx.Response, fallback: str) -> str:
    """Pull the human-readable `detail` field out of InterviewerAI's error
    body, e.g. "1 row(s) failed validation... row 1: Invalid email format".
    Falls back to the raw body if the shape is ever not what's expected,
    rather than raising a second error while reporting the first."""
    try:
        detail = response.json().get("detail")
        if isinstance(detail, str) and detail:
            return detail
    except ValueError:
        pass
    return response.text[:500] or fallback

_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


def _headers() -> dict[str, str]:
    if not settings.interviewer_ai_configured:
        raise ServiceNotConfiguredError("InterviewerAI is not configured.")
    return {"X-API-Key": settings.INTERVIEWER_AI_API_KEY, "Content-Type": "application/json"}


def send_bulk_invite(
    *,
    subject: str,
    rows: list[dict[str, str]],
    batch_name: str | None = None,
    personalize: bool = True,
    question_difficulty: str | None = None,
) -> dict:
    """POST /bulk-invites. Returns the batch object from the response.

    Validation failures are all-or-nothing on InterviewerAI's side — a single
    bad row refuses the whole batch, none of it sent — so a 400 here means
    nothing went out, not a partial send.

    `question_difficulty` is stamped onto every row as `questionDifficulty`.
    Their spec documents that key on `/candidates/{id}/invite` only and says
    nothing about it here — the documented row shape is
    `{name, email, cnic, category, course_status}`. It is sent anyway because
    it was **verified working**: a probe batch on 2026-09-01 carrying
    `questionDifficulty: MEDIUM_TO_HARD` produced a candidate whose
    `question_difficulty_range` read back `MEDIUM_TO_HARD`. Their request body
    is `additionalProperties: true`, so the 200 alone proved nothing — the
    read-back is what settled it.

    Per row rather than top-level because that is the placement that was
    actually tested; a top-level key was never confirmed and would be
    silently ignored if wrong.
    """
    if question_difficulty:
        rows = [{**row, "questionDifficulty": question_difficulty} for row in rows]

    body: dict = {"subject": subject, "personalize": personalize, "rows": rows}
    if batch_name:
        body["batch_name"] = batch_name

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(
                f"{settings.INTERVIEWER_AI_BASE_URL}/bulk-invites",
                headers=_headers(),
                json=body,
            )
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach InterviewerAI.") from exc

    if response.status_code == 400:
        # A rejection is a data problem an admin can act on — a bad email,
        # a bad CNIC, a wrong course_status — not the service being down.
        # Surfacing it as a 502 would tell the caller to try again later,
        # when what they actually need to do is fix a row and resend.
        raise ConflictError(_detail_message(response, "InterviewerAI rejected the batch."))
    if not response.is_success:
        raise UpstreamError("InterviewerAI request failed.", details=response.text[:500])

    return response.json()["batch"]


def get_batch(external_batch_id: int) -> dict:
    """GET /bulk-invites/{id}. Returns the batch object, including per-row
    `failures` (each `{row, email, error}`, `row` being the 0-based index
    into the `rows` array the batch was created with)."""
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.get(
                f"{settings.INTERVIEWER_AI_BASE_URL}/bulk-invites/{external_batch_id}",
                headers=_headers(),
            )
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach InterviewerAI.") from exc

    if not response.is_success:
        raise UpstreamError("Could not fetch batch status.", details=response.text[:500])

    return response.json()["batch"]


# --------------------------------------------------------------- plumbing --
#
# Everything below this line is the scoped partner surface added 2026-08-29.
# The two functions above predate it and keep their own bodies rather than
# being rewritten onto `_request` — the bulk-invite pair has error handling
# specific to all-or-nothing batch validation that does not generalise.


def _request(method: str, path: str, *, params: dict | None = None, json: dict | None = None) -> Any:
    """One request against the partner API, with the whole error vocabulary
    mapped in one place.

    A 403 is deliberately *not* a PermissionDeniedError: our caller has
    already passed our own role and scope checks by the time this runs, so a
    refusal here means our API key lacks the scope, which is an operator
    problem to fix in configuration, not something the signed-in user did
    wrong. Reporting it as their permission failure would send an admin
    hunting for rights they already hold.
    """
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.request(
                method,
                f"{settings.INTERVIEWER_AI_BASE_URL}{path}",
                headers=_headers(),
                params=params,
                json=json,
            )
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach InterviewerAI.") from exc

    if response.status_code == 404:
        raise NotFoundError("Not found on InterviewerAI.")
    if response.status_code in (401, 403):
        raise UpstreamError(
            "Our InterviewerAI key was refused for this action.",
            details=_detail_message(response, "Scope missing on the API key."),
        )
    if response.status_code == 429:
        raise UpstreamError("InterviewerAI is rate limiting us. Try again shortly.")
    if response.status_code == 400:
        raise ConflictError(_detail_message(response, "InterviewerAI rejected the request."))
    if not response.is_success:
        raise UpstreamError("InterviewerAI request failed.", details=response.text[:500])

    if not response.content:
        return None
    try:
        return response.json()
    except ValueError as exc:
        raise UpstreamError("InterviewerAI returned a non-JSON response.") from exc


def _collection(path: str, **params: Any) -> tuple[list[dict], dict]:
    """A `{data: [...], pagination: {...}}` list endpoint.

    Tolerates both that envelope and a bare array, since the shape is
    undocumented and only observed.
    """
    payload = _request("GET", path, params={k: v for k, v in params.items() if v is not None})
    if isinstance(payload, list):
        return payload, {}
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, list):
            return data, payload.get("pagination") or {}
    return [], {}


# ------------------------------------------------------------- candidates --


def list_candidates(*, limit: int = 50, offset: int = 0, search: str | None = None):
    return _collection("/candidates", limit=limit, offset=offset, search=search)


def get_candidate(candidate_id: int) -> dict:
    return _request("GET", f"/candidates/{candidate_id}")


def update_candidate(candidate_id: int, payload: dict) -> dict:
    """Requires `candidates:write` on the key, and on our side a granted
    CANDIDATES_WRITE permission — see permission_service."""
    return _request("PUT", f"/candidates/{candidate_id}", json=payload)


def invite_candidate(candidate_id: int) -> dict:
    """Single-candidate invite/resend. The bulk path stays the primary one;
    this exists for re-sending to one person without assembling a batch."""
    return _request("POST", f"/candidates/{candidate_id}/invite")


def find_candidate_by_email(email: str) -> dict | None:
    """Resolve their candidate id for an address we invited.

    Their list endpoint's `search` behaviour is unverified (no documentation,
    and too little data to probe), so the match is re-checked here rather
    than trusted — a search that quietly ignores the term would otherwise
    return the first candidate in the tenant for every lookup.
    """
    target = email.strip().lower()
    for candidate in (list_candidates(limit=100, search=target)[0] or []):
        if str(candidate.get("email", "")).strip().lower() == target:
            return candidate
    return None


# ------------------------------------------------------------- interviews --


def list_interviews(
    *, limit: int = 50, offset: int = 0, candidate_id: int | None = None, status: str | None = None
):
    return _collection(
        "/interviews", limit=limit, offset=offset, candidate_id=candidate_id, status=status
    )


def get_interview(interview_id: int) -> dict:
    return _request("GET", f"/interviews/{interview_id}")


def get_interview_report(interview_id: int) -> dict:
    """The full per-question report. Admin-facing only — never rendered into
    a candidate response. See ai_interview_service.candidate_score()."""
    return _request("GET", f"/interviews/{interview_id}/report")


def get_interview_recording(interview_id: int) -> dict:
    """Returns their signed/streamable URL for the session video. We hand the
    URL to the browser but never the API key; see the recording route."""
    return _request("GET", f"/interviews/{interview_id}/recording")


def delete_interview(interview_id: int) -> None:
    _request("DELETE", f"/interviews/{interview_id}")


# -------------------------------------------------- proctoring & evidence --


def list_proctor_snapshots(*, limit: int = 50, offset: int = 0, interview_id: int | None = None):
    return _collection(
        "/proctor-snapshots", limit=limit, offset=offset, interview_id=interview_id
    )


# ------------------------------------------------------------ reinterview --


def list_reinterview_requests(*, limit: int = 50, offset: int = 0):
    return _collection("/reinterview-requests", limit=limit, offset=offset)


def decide_reinterview(request_id: int, *, approve: bool, note: str | None = None) -> dict:
    """Their request body is untyped (`additionalProperties: true`) and there
    are no live requests to observe, so both the common spellings are sent.
    Extra keys are accepted by an open schema; a missing one would not be."""
    payload: dict[str, Any] = {
        "decision": "approved" if approve else "rejected",
        "status": "approved" if approve else "rejected",
        "approved": approve,
    }
    if note:
        payload["note"] = note
        payload["reason"] = note
    return _request("POST", f"/reinterview-requests/{request_id}/decision", json=payload)


# ------------------------------------------------------ analytics & audit --


def analytics_summary() -> dict:
    return _request("GET", "/analytics/summary") or {}


def audit_log(*, limit: int = 50, offset: int = 0):
    return _collection("/audit-log", limit=limit, offset=offset)


def whoami() -> dict:
    """Which scopes our key actually holds. Used by the permission screen to
    show a super admin what the key can do before they delegate any of it."""
    return _request("GET", "/whoami") or {}
