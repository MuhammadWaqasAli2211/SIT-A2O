"""Thin client over Supabase Auth (GoTrue).

The frontend never talks to GoTrue directly for email/password flows; it goes
through our API so signup, profile creation, and error shaping stay in one place.
OAuth (Google) will be the exception later: that redirect flow happens in the
browser and lands back with a Supabase token our /auth/me endpoint verifies.
"""

from typing import Any, Literal

import httpx

from app.core.config import settings
from app.core.exceptions import (
    AppError,
    ConflictError,
    EmailNotVerifiedError,
    InvalidCredentialsError,
    InvalidEmailError,
    RateLimitedError,
    SignupDisabledError,
    UpstreamError,
    WeakPasswordError,
)

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

Operation = Literal["signup", "token", "resend"]

# GoTrue's `error_code` is stable and specific; prefer it over status code or
# message text, both of which vary between Supabase releases.
_BY_ERROR_CODE: dict[str, type[AppError]] = {
    "email_address_invalid": InvalidEmailError,
    "validation_failed": InvalidEmailError,
    "user_already_exists": ConflictError,
    "email_exists": ConflictError,
    "weak_password": WeakPasswordError,
    "email_not_confirmed": EmailNotVerifiedError,
    "invalid_credentials": InvalidCredentialsError,
    "signup_disabled": SignupDisabledError,
    "over_email_send_rate_limit": RateLimitedError,
    "over_request_rate_limit": RateLimitedError,
}


def _headers() -> dict[str, str]:
    return {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }


def _translate(response: httpx.Response, operation: Operation) -> None:
    """Map a GoTrue error response onto our own error types.

    `operation` decides the fallback only. A 400 from /token means the password
    was wrong; a 400 from /signup means the submission was rejected, and
    reporting that as "incorrect email or password" would be actively misleading.
    """
    if response.is_success:
        return

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    error_code = str(payload.get("error_code") or "")
    message = str(
        payload.get("msg")
        or payload.get("message")
        or payload.get("error_description")
        or ""
    )

    if exc_type := _BY_ERROR_CODE.get(error_code):
        # GoTrue's own wording is more specific than our defaults for the
        # rejection cases, so pass it through where it is safe to show.
        if exc_type in (InvalidEmailError, WeakPasswordError) and message:
            raise exc_type(message)
        raise exc_type()

    # Older GoTrue builds omit error_code and only vary the message.
    haystack = message.lower()
    if "already registered" in haystack or "already been registered" in haystack:
        raise ConflictError("An account with this email already exists.")
    if "not confirmed" in haystack:
        raise EmailNotVerifiedError()

    if response.status_code == 429:
        raise RateLimitedError()
    if operation == "token" and response.status_code in (400, 401):
        raise InvalidCredentialsError()

    raise UpstreamError(
        "Authentication service error.", details=message or response.text[:200]
    )


def _post(
    path: str,
    *,
    operation: Operation,
    json: dict[str, Any],
    params: dict[str, str] | None = None,
) -> dict:
    url = f"{settings.auth_url}{path}"
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(url, json=json, params=params, headers=_headers())
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach the authentication service.") from exc

    _translate(response, operation)
    return response.json() if response.content else {}


def sign_up(email: str, password: str, metadata: dict[str, Any]) -> dict:
    """Create a user. Supabase sends the confirmation email when enabled."""
    return _post(
        "/signup",
        operation="signup",
        json={"email": email, "password": password, "data": metadata},
    )


def sign_in(email: str, password: str) -> dict:
    return _post(
        "/token",
        operation="token",
        params={"grant_type": "password"},
        json={"email": email, "password": password},
    )


def resend_confirmation(email: str) -> dict:
    """Ask GoTrue to send the signup confirmation email again.

    Uses the anon key, not service_role: this is reachable by an anonymous
    caller, and GoTrue's own per-address and per-IP send limits are the
    rate limiting. Handing it a privileged key would remove them.
    """
    return _post(
        "/resend",
        operation="resend",
        json={"type": "signup", "email": email},
    )


def refresh(refresh_token: str) -> dict:
    return _post(
        "/token",
        operation="token",
        params={"grant_type": "refresh_token"},
        json={"refresh_token": refresh_token},
    )


def sign_out(access_token: str) -> None:
    """Revoke the refresh token server-side. Best effort: never blocks logout."""
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            client.post(
                f"{settings.auth_url}/logout",
                headers={**_headers(), "Authorization": f"Bearer {access_token}"},
            )
    except httpx.RequestError:
        pass


# ------------------------------------------------------------ admin API --
# These carry the service_role key and can act on any account without a user
# session. Reachable only from routes behind require_super_admin — never from
# anything a candidate can call.


def _admin_headers() -> dict[str, str]:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def _admin_request(method: str, path: str, json: dict[str, Any] | None = None) -> dict:
    url = f"{settings.auth_url}/admin/users{path}"
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.request(method, url, json=json, headers=_admin_headers())
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach the authentication service.") from exc

    _translate(response, "signup")
    return response.json() if response.content else {}


def admin_create_user(
    email: str, password: str, metadata: dict[str, Any], *, email_confirm: bool = True
) -> dict:
    """Create an account directly, bypassing self-service signup.

    `email_confirm=True` marks the address verified without sending a
    confirmation mail: a staff account is provisioned by someone who already
    knows the address is real, and waiting on an inbox click would leave the
    account unusable in the meantime.
    """
    return _admin_request(
        "POST",
        "",
        {
            "email": email,
            "password": password,
            "email_confirm": email_confirm,
            "user_metadata": metadata,
        },
    )


def admin_update_user(user_id: str, changes: dict[str, Any]) -> dict:
    return _admin_request("PUT", f"/{user_id}", changes)


def admin_delete_user(user_id: str) -> None:
    _admin_request("DELETE", f"/{user_id}")
