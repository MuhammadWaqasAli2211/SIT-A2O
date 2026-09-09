"""Resend confirmation: what it tells the caller, and what it refuses to."""

import pytest

from app.core.exceptions import (
    ConflictError,
    InvalidEmailError,
    NotFoundError,
    RateLimitedError,
    UpstreamError,
)
from app.integrations import supabase_auth
from app.schemas.auth import ResendConfirmationRequest
from app.services import auth_service

PAYLOAD = ResendConfirmationRequest(email="someone@example.com")


def _raise(exc):
    def _fn(email):
        raise exc

    return _fn


def test_success_returns_the_generic_message(monkeypatch):
    seen = {}
    monkeypatch.setattr(
        supabase_auth, "resend_confirmation", lambda email: seen.setdefault("email", email) or {}
    )
    result = auth_service.resend_confirmation(PAYLOAD)
    assert seen["email"] == "someone@example.com"
    assert "on its way" in result.message


@pytest.mark.parametrize(
    "exc",
    [
        NotFoundError("no such user"),
        ConflictError("already confirmed"),
        InvalidEmailError("rejected"),
    ],
    ids=["unknown-address", "already-confirmed", "rejected"],
)
def test_address_state_is_never_reflected_back(monkeypatch, exc):
    """The reply must not differ by address, or it becomes an enumeration oracle."""
    monkeypatch.setattr(supabase_auth, "resend_confirmation", _raise(exc))
    assert auth_service.resend_confirmation(PAYLOAD).message == (
        auth_service._RESEND_MESSAGE
    )


@pytest.mark.parametrize(
    "exc", [RateLimitedError(), UpstreamError("gotrue down")], ids=["rate-limited", "upstream"]
)
def test_actionable_failures_still_surface(monkeypatch, exc):
    """These say nothing about the address, and the caller has to act on both."""
    monkeypatch.setattr(supabase_auth, "resend_confirmation", _raise(exc))
    with pytest.raises(type(exc)):
        auth_service.resend_confirmation(PAYLOAD)


def test_resend_uses_the_anon_key_not_service_role(monkeypatch):
    """A privileged key here would bypass GoTrue's own send limits."""
    captured = {}

    def fake_post(path, *, operation, json, params=None):
        captured.update(path=path, operation=operation, json=json, params=params)
        return {}

    monkeypatch.setattr(supabase_auth, "_post", fake_post)
    supabase_auth.resend_confirmation("someone@example.com")

    assert captured["path"] == "/resend"
    assert captured["json"] == {"type": "signup", "email": "someone@example.com"}
    # _post builds anon headers; the admin path is _admin_request, unused here.
    assert captured["operation"] == "resend"


def test_resend_points_the_link_at_our_frontend(monkeypatch):
    """Regression: this used to be omitted, so a resent link fell back to
    whatever the Supabase dashboard's Site URL happened to be — not our
    verification page, and not necessarily even the right port."""
    captured = {}
    monkeypatch.setattr(supabase_auth.settings, "FRONTEND_URL", "http://localhost:5173")
    monkeypatch.setattr(
        supabase_auth,
        "_post",
        lambda path, *, operation, json, params=None: captured.update(params=params) or {},
    )
    supabase_auth.resend_confirmation("someone@example.com")

    assert captured["params"] == {"redirect_to": "http://localhost:5173/verify-email"}
