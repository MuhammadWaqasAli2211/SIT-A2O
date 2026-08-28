"""Thin client over the InterviewerAI bulk-invite API.

This is a third-party service, not ours: once a candidate is invited here,
InterviewerAI conducts the interview itself — there is no admin-picked time,
the candidate takes it whenever they like. It is the Phase 2 AI screening
step; the interview_service module's scheduled interviews are the Phase 3
physical/HR round instead. See docs/project-status.md for how that split was
decided.

No results/webhook API exists yet, so this client only covers sending and
polling send-progress — nothing here can tell a caller whether a candidate
actually completed the interview or what they scored.
"""

import httpx

from app.core.config import settings
from app.core.exceptions import ConflictError, ServiceNotConfiguredError, UpstreamError


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
) -> dict:
    """POST /bulk-invites. Returns the batch object from the response.

    Validation failures are all-or-nothing on InterviewerAI's side — a single
    bad row refuses the whole batch, none of it sent — so a 400 here means
    nothing went out, not a partial send.
    """
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
