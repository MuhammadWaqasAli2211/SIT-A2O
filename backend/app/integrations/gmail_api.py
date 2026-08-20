"""Thin client over the Gmail API for backend-triggered email.

This is distinct from Supabase's own SMTP configuration: that path only
covers Supabase Auth's built-in emails (signup confirmation, password reset).
Everything the recruitment workflow itself sends — interview invitations,
batch results, onboarding links — goes through here instead, using an OAuth2
refresh token obtained once via the Google OAuth Playground (see
docs/security.md for the setup steps).

No google-api-python-client dependency: the two calls this needs (refresh a
token, send a message) are a handful of lines over httpx, consistent with how
app/integrations/supabase_auth.py talks to GoTrue.
"""

import base64
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import settings
from app.core.exceptions import EmailNotConfiguredError, UpstreamError

_TOKEN_URL = "https://oauth2.googleapis.com/token"
_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)

# Access tokens are short-lived (~1 hour); cached in memory so a burst of
# sends (a batch of 50+ interview invitations) doesn't refresh once per email.
_cached_token: str | None = None
_cached_token_expires_at: float = 0.0
# Refresh a little early so a token doesn't expire mid-request.
_EXPIRY_SAFETY_MARGIN_SECONDS = 60


def _get_access_token() -> str:
    global _cached_token, _cached_token_expires_at

    if not settings.gmail_configured:
        raise EmailNotConfiguredError()

    if _cached_token and time.monotonic() < _cached_token_expires_at:
        return _cached_token

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(
                _TOKEN_URL,
                data={
                    "client_id": settings.GMAIL_CLIENT_ID,
                    "client_secret": settings.GMAIL_CLIENT_SECRET,
                    "refresh_token": settings.GMAIL_REFRESH_TOKEN,
                    "grant_type": "refresh_token",
                },
            )
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach Google's OAuth endpoint.") from exc

    if not response.is_success:
        raise UpstreamError(
            "Failed to refresh the Gmail access token.",
            details=response.text[:300],
        )

    payload = response.json()
    _cached_token = payload["access_token"]
    _cached_token_expires_at = (
        time.monotonic() + payload.get("expires_in", 3600) - _EXPIRY_SAFETY_MARGIN_SECONDS
    )
    return _cached_token


def _build_raw_message(*, to: str, subject: str, html_body: str, text_body: str) -> str:
    message = MIMEMultipart("alternative")
    message["To"] = to
    message["From"] = settings.GMAIL_SENDER_EMAIL
    message["Subject"] = subject
    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    # Gmail API expects URL-safe base64, no padding trimmed but padding is fine.
    return base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")


def send_email(*, to: str, subject: str, html_body: str, text_body: str | None = None) -> str:
    """Send one email via the Gmail API. Returns Gmail's message id.

    `text_body` defaults to a stripped-down copy of the HTML content's intent
    left to the caller; pass an explicit plain-text version for anything where
    the fallback rendering matters.
    """
    access_token = _get_access_token()
    raw = _build_raw_message(
        to=to, subject=subject, html_body=html_body, text_body=text_body or ""
    )

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(
                _SEND_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                json={"raw": raw},
            )
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach the Gmail API.") from exc

    if not response.is_success:
        raise UpstreamError("Gmail API rejected the send.", details=response.text[:300])

    return response.json()["id"]
