"""Signup's confirmation email has to point back at our own verification
page — that redirect is controlled by `redirect_to` on the /signup call
itself, not by the Supabase dashboard's Site URL field, which is a common
enough confusion that it is worth its own regression test.
"""

from app.integrations import supabase_auth


def test_signup_points_the_confirmation_link_at_our_frontend(monkeypatch):
    captured = {}
    monkeypatch.setattr(supabase_auth.settings, "FRONTEND_URL", "http://localhost:5173")
    monkeypatch.setattr(
        supabase_auth,
        "_post",
        lambda path, *, operation, json, params=None: captured.update(
            path=path, json=json, params=params
        )
        or {},
    )

    supabase_auth.sign_up("someone@example.com", "hunter22", {"full_name": "Someone"})

    assert captured["path"] == "/signup"
    assert captured["json"] == {
        "email": "someone@example.com",
        "password": "hunter22",
        "data": {"full_name": "Someone"},
    }
    assert captured["params"] == {"redirect_to": "http://localhost:5173/verify-email"}


def test_signup_redirect_follows_frontend_url_setting(monkeypatch):
    """A deployed frontend must not get a localhost link baked into its emails."""
    captured = {}
    monkeypatch.setattr(supabase_auth.settings, "FRONTEND_URL", "https://app.example.com")
    monkeypatch.setattr(
        supabase_auth,
        "_post",
        lambda path, *, operation, json, params=None: captured.update(params=params) or {},
    )

    supabase_auth.sign_up("someone@example.com", "hunter22", {})

    assert captured["params"] == {"redirect_to": "https://app.example.com/verify-email"}
