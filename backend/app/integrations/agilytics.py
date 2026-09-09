"""Thin client over the Agilytics external partner API.

Agilytics is where a candidate goes *after* our pipeline finishes: once they
clear onboarding, they become a member of an Agilytics workspace and their
learning progress lives there, not here. This module is the only place that
talks to it.

## Authentication

There is no bearer token. Every request carries two headers:

    x-portal-timestamp   milliseconds since the epoch, as a decimal string
    x-portal-signature   HMAC-SHA256 over the request payload, hex

`PORTAL_AGILYTICS_SECRET` is the shared HMAC key. It never leaves the backend
and the frontend can neither see nor recompute it — the same standard the
InterviewerAI key is held to. Agilytics rejects a timestamp more than five
minutes from its own clock, so a signature cannot be replayed indefinitely.

What gets signed depends on the method:

* POST/PUT — the raw JSON body, byte for byte as transmitted.
* GET/DELETE — the query string, keys sorted, values URL-encoded.

"Byte for byte" is the reason `_request` serialises the body itself and hands
httpx `content=` rather than `json=`. Signing one serialisation and sending
another is the classic way this scheme fails: any difference in key order or
separator spacing changes the digest, and the only symptom is a bare 403.

Their server additionally accepts `timestamp.payload` and `payload.timestamp`
for backwards compatibility. We send the plain payload — the documented
primary form — and do not rely on the fallbacks. (Worth knowing when
debugging: a probe that signs the wrong thing can still be accepted by one of
those variants, so "it returned 200" does not by itself prove the canonical
string is right.)

## Response shape

Success bodies are enveloped as `{"success": true, "data": {...}}`; errors as
`{"error": "...", "message": "..."}`. Callers here get the `data` object
unwrapped, because the envelope carries no information the status code has
not already given us.
"""

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    ServiceNotConfiguredError,
    UpstreamError,
)

_TIMEOUT = httpx.Timeout(30.0, connect=5.0)

# Methods whose signature covers the body rather than the query string.
_BODY_SIGNED = {"POST", "PUT", "PATCH"}


def _now_ms() -> int:
    """Milliseconds since the epoch — the units Agilytics expects.

    Their spec describes this as `Date.now()`, which is a JavaScript idiom
    for exactly this. Sending seconds instead reads as a timestamp ~55 years
    in the past and is refused for clock drift.
    """
    return int(time.time() * 1000)


def canonical_payload(
    method: str,
    *,
    params: dict[str, Any] | None = None,
    body: bytes | None = None,
) -> str:
    """The exact string the signature is computed over.

    Isolated as its own function because it is the single thing most likely
    to be wrong in an HMAC integration, and the only thing worth pinning with
    fixed test vectors.

    Query strings are built with `urlencode` over sorted items, which matches
    JavaScript's `URLSearchParams` (sorted, `+` for spaces, percent-encoding
    elsewhere) for every character these endpoints actually carry — ids and
    email addresses. The two disagree on a handful of sub-delimiters (`!`,
    `'`, `(`, `)`, `*`), so a future parameter containing one of those needs
    checking rather than assuming.

    `signature`/`sig` are excluded by their spec because those endpoints also
    accept the signature as a query param. We always send it as a header, so
    there is nothing to strip — but the exclusion is kept so that stays true
    if a caller ever passes one.
    """
    if method.upper() in _BODY_SIGNED:
        return (body or b"").decode("utf-8")
    signable = {k: v for k, v in (params or {}).items() if k not in ("signature", "sig")}
    return urlencode(sorted(signable.items()))


def sign(payload: str) -> str:
    """HMAC-SHA256 of `payload` under the shared secret, lowercase hex."""
    if not settings.PORTAL_AGILYTICS_SECRET:
        raise ServiceNotConfiguredError("Agilytics is not configured.")
    return hmac.new(
        settings.PORTAL_AGILYTICS_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _headers(payload: str, *, timestamp: int) -> dict[str, str]:
    return {
        "x-portal-signature": sign(payload),
        "x-portal-timestamp": str(timestamp),
        "Content-Type": "application/json",
    }


def _detail_message(response: httpx.Response, fallback: str) -> str:
    """Pull the human-readable text out of an Agilytics error body.

    Their shape is `{"error": "Forbidden", "message": "Missing portal
    signature"}` — `message` is the useful half. Falls back to the raw body
    rather than raising a second error while reporting the first.
    """
    try:
        payload = response.json()
        if isinstance(payload, dict):
            for key in ("message", "error", "detail"):
                value = payload.get(key)
                if isinstance(value, str) and value:
                    return value
    except ValueError:
        pass
    return response.text[:500] or fallback


def _request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    body: dict | None = None,
) -> Any:
    """One signed request, with the whole error vocabulary mapped in one place.

    A 403 is deliberately *not* a PermissionDeniedError: the caller has
    already cleared our own role and scope checks by the time this runs, so a
    refusal here is our signature or our clock being wrong — an operator
    problem, not something the signed-in admin did. Reporting it as their
    permission failure would send them hunting for rights they already hold.
    """
    if not settings.agilytics_configured:
        raise ServiceNotConfiguredError("Agilytics is not configured.")

    params = {k: v for k, v in (params or {}).items() if v is not None}
    # Serialise once: these exact bytes are both signed and sent.
    content = json.dumps(body).encode("utf-8") if body is not None else None
    payload = canonical_payload(method, params=params, body=content)

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.request(
                method,
                f"{settings.AGILYTICS_API_BASE_URL}{path}",
                headers=_headers(payload, timestamp=_now_ms()),
                params=params or None,
                content=content,
            )
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach Agilytics.") from exc

    if response.status_code == 404:
        raise NotFoundError(_detail_message(response, "Not found on Agilytics."))
    if response.status_code in (401, 403):
        raise UpstreamError(
            "Agilytics refused our request signature.",
            details=_detail_message(response, "Signature or timestamp rejected."),
        )
    if response.status_code == 429:
        raise UpstreamError("Agilytics is rate limiting us. Try again shortly.")
    if response.status_code == 400:
        raise ConflictError(_detail_message(response, "Agilytics rejected the request."))
    if not response.is_success:
        raise UpstreamError("Agilytics request failed.", details=response.text[:500])

    if not response.content:
        return None
    try:
        payload_out = response.json()
    except ValueError as exc:
        raise UpstreamError("Agilytics returned a non-JSON response.") from exc

    # Unwrap `{"success": true, "data": {...}}`. Tolerates a bare object in
    # case an endpoint ever answers without the envelope, rather than
    # returning None and making the caller debug an empty result.
    if isinstance(payload_out, dict) and "data" in payload_out:
        return payload_out["data"]
    return payload_out


# ------------------------------------------------------------- endpoints --


def provision_workspace(
    *,
    name: str,
    description: str = "",
    tracks: list[str] | None = None,
    leads: list[dict[str, str]] | None = None,
    students: list[dict[str, str]] | None = None,
) -> dict:
    """Create a workspace with its tracks, leads and students in one call.

    Atomic on their side, and idempotent per person rather than per call:
    existing users are matched by email and new ones created, so a person who
    is already in the workspace is not duplicated. The call itself is *not*
    idempotent — calling it twice creates two workspaces — which is why the
    id it returns has to be stored against the intake that produced it.

    Their field names are camelCase (`fullName`, `trackName`); ours are not,
    so the rows are built by the caller in their shape rather than converted
    here, where a silent mismatch would just be dropped by an open schema.

    Leads come back APPROVED, students PENDING (a workspace lead approves
    them, or `bulk_invite` stages invitations for them). An email appearing
    in both lists is resolved as a lead.
    """
    body: dict[str, Any] = {"name": name, "description": description}
    if tracks:
        # They deduplicate anyway; doing it here keeps the request honest
        # about what we asked for.
        body["tracks"] = list(dict.fromkeys(tracks))
    if leads:
        body["leads"] = leads
    if students:
        body["students"] = students

    return _request("POST", "/api/v1/external/workspaces", body=body) or {}


def onboarding_status(workspace_id: str, *, email: str | None = None) -> dict:
    """A workspace's onboarding progress, or one member's if `email` is given.

    Two different shapes behind one path: without `email`, counts and
    breakdowns for the whole workspace; with it, that one member's status,
    role and track. Callers have to know which they asked for — see
    `agilytics_service` for the normalising.

    Read-only and idempotent, which is what made it the safe endpoint to
    verify the signing scheme against.
    """
    return (
        _request(
            "GET",
            f"/api/v1/external/workspaces/{workspace_id}/onboarding-status",
            params={"email": email},
        )
        or {}
    )


def bulk_invite(workspace_id: str) -> dict:
    """Stage invitation tokens for every PENDING member of a workspace.

    Takes no request body — the endpoint finds the pending members itself.
    That matters for the signature: the payload signed is the empty string,
    because the raw body is empty. Sending `{}` instead would sign `"{}"` and
    be refused.

    Safe to repeat: existing unrevoked invites for the same addresses are
    revoked and reissued rather than duplicated. Tokens expire after 7 days,
    and the response says how many were issued — zero, with a message, when
    nobody is pending.
    """
    return _request("POST", f"/api/v1/external/workspaces/{workspace_id}/bulk-invite") or {}
