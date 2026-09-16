"""Thin client over the Agilytics external partner API.

Agilytics is where a candidate goes *after* our pipeline finishes: once they
clear onboarding, they become a member of an Agilytics workspace and their
learning progress lives there, not here. This module is the only place that
talks to it.

## The four endpoints

    POST /workspaces                  provision: workspace, leads, student accounts
    POST /workspaces/{id}/onboard     make students APPROVED members, at once
    GET  /workspaces/{id}/stats       roles, statuses, tracks, activation health
    GET  /workspaces/{id}/onboarding-status   whole workspace, or one member

`bulk-invite` used to be here and is gone: their current spec does not
document it, and the flow it served — stage a token, email an invitation,
wait for the candidate to accept — has been replaced by `onboard`, which
makes somebody a member outright. Nothing that waited on a "joined" signal
survives that change; see `agilytics_service`.

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

    # An HTML body means we did not reach the API at all — their host answered
    # with a page, which is what a Next.js deployment does for a route it does
    # not have. Echoing the markup put a screenful of `<!DOCTYPE html>` in the
    # admin's error toast and told them nothing; this says the one thing that
    # is actually actionable.
    body = response.text[:500]
    if body.lstrip()[:1] == "<":
        return (
            "Agilytics answered with a web page rather than API data — the "
            "partner API is not reachable at the configured URL "
            f"({settings.AGILYTICS_API_BASE_URL})."
        )
    return body or fallback


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
    leads: list[dict[str, str]] | None = None,
    students: list[dict[str, str]] | None = None,
) -> dict:
    """Create a workspace, its lead memberships, and student Auth accounts.

    Three things this does *not* do, each of which it used to or was assumed
    to under the previous revision of their API:

    * **It does not create tracks.** The `tracks` array is gone from their
      schema entirely — tracks must already exist in the workspace before
      anyone is assigned to one. See `onboard` for what that costs us.
    * **It does not make students members.** It creates their Supabase Auth
      account and a `User` row and stops. Membership is `onboard`'s job, and
      a student who has been provisioned but not onboarded is in no
      workspace at all.
    * **It does not send anything.** No confirmation email, no invitation —
      accounts arrive auto-verified and silent. Whatever the student hears
      about this, they hear from us.

    Leads *are* made members, APPROVED, in this call. An email in both lists
    is resolved as a lead.

    Their field names are camelCase (`fullName`); ours are not, so rows are
    built by the caller in their shape rather than converted here, where a
    silent mismatch would just be dropped by an open schema.

    Idempotent per person: re-running matches existing users by email rather
    than duplicating them. Whether it is idempotent per *workspace* is
    undocumented and untested — their note covers accounts and memberships
    and says nothing about the workspace itself — so callers must keep
    treating a second call for an already-provisioned intake as a mistake
    until that is confirmed.
    """
    body: dict[str, Any] = {"name": name, "description": description}
    if leads:
        body["leads"] = leads
    if students:
        body["students"] = students

    return _request("POST", "/api/v1/external/workspaces", body=body) or {}


def onboard(workspace_id: str, students: list[dict[str, str]]) -> dict:
    """Make students APPROVED members of a workspace, immediately.

    This replaces the invite-and-wait model entirely. There is no token, no
    acceptance step and no email: a student named here is a member the moment
    the call returns. Anything the student needs to be told is ours to send.

    `trackName` is optional per student and resolved to a track UUID on their
    side. **A name that matches nothing resolves to a null track rather than
    an error** — the student is still onboarded, just ungrouped — so a
    wholesale mapping failure looks exactly like success from the status code
    alone. `trackDistribution` in the response is the only thing that
    distinguishes them, which is why the service records it.

    Two skip reasons come back per email rather than as failures:
    "Already a workspace member" (the duplicate case, and the reason this is
    safe to repeat) and "User not found in system" — the latter meaning the
    student has no Auth account yet, i.e. `provision_workspace` has not run
    for them.
    """
    return (
        _request(
            "POST",
            f"/api/v1/external/workspaces/{workspace_id}/onboard",
            body={"students": students},
        )
        or {}
    )


def stats(workspace_id: str) -> dict:
    """Workspace health: roles, statuses, per-track progress, activation.

    Overlaps `onboarding_status` without replacing it, and the two disagree
    on `trackBreakdown` in the same spec revision — here each track carries
    `totalStudents`/`onboarded`/`pending`, there a single `memberCount`. This
    is the richer of the two and the one the stats screen reads; the other
    stays for its `?email=` single-member lookup, which this has no
    equivalent of.

    `activationHealth` is only available here: how many student accounts are
    verified against how many exist. Read and displayed as reported — their
    spec also says accounts are created auto-verified, which is hard to
    reconcile with a non-zero unverified count, but that is their number to
    explain and not ours to reinterpret.

    Their documented `/stats` path 404s with "Workspace not found." for a
    workspace `/onboarding-status` confirms exists, on both their preview
    deployments (checked 2026-09-16) — a bug on their side, not ours. Calling
    `/onboarding-status` here instead keeps this screen working, at the cost
    of `activation` always coming back `None` and `tracks` always reporting
    zero counts, since that shape carries `memberCount` only. Switch this
    back to `/stats` once Agilytics confirms it is fixed.
    """
    return _request("GET", f"/api/v1/external/workspaces/{workspace_id}/onboarding-status") or {}


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


