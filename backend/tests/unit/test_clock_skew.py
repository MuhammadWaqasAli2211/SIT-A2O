"""Clock skew between Supabase's auth servers and this one.

GoTrue stamps `iat` from its own clock. If it runs a second ahead of ours, a
token is "not yet valid" for the first moments of its life — so a user who has
just signed in successfully is met with 401s. Observed against the live
project: a freshly minted token raised ImmatureSignatureError while an older
one from the same session verified fine.
"""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core import security
from app.core.config import settings
from app.core.exceptions import AuthenticationError

SECRET = "test-signing-secret-not-a-real-key"


def make_token(*, iat_offset=0, exp_offset=3600, **overrides) -> str:
    """An HS256 token, so these tests need no JWKS and no network."""
    now = datetime.now(UTC)
    claims = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "aud": settings.JWT_AUDIENCE,
        "iat": now + timedelta(seconds=iat_offset),
        "nbf": now + timedelta(seconds=iat_offset),
        "exp": now + timedelta(seconds=exp_offset),
        **overrides,
    }
    return jwt.encode(claims, SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def _use_test_secret(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", SECRET)


def test_a_token_issued_now_verifies():
    assert security.decode_access_token(make_token())["sub"]


@pytest.mark.parametrize("seconds_ahead", [1, 5, 30, 59])
def test_a_token_from_a_slightly_fast_clock_still_verifies(seconds_ahead):
    """The regression: this is exactly what a fresh login produced."""
    token = make_token(iat_offset=seconds_ahead)

    assert security.decode_access_token(token)["sub"]


def test_a_token_from_an_absurdly_fast_clock_is_still_rejected():
    """Leeway is for drift, not for accepting anything a forger claims."""
    with pytest.raises(AuthenticationError) as caught:
        security.decode_access_token(make_token(iat_offset=3600))

    assert caught.value.code == "invalid_token"


def test_an_expired_token_is_still_rejected():
    with pytest.raises(AuthenticationError) as caught:
        security.decode_access_token(make_token(exp_offset=-3600))

    assert caught.value.code == "token_expired"


def test_expiry_inside_the_leeway_is_tolerated():
    """The documented trade-off: a few seconds of grace on expiry."""
    assert security.decode_access_token(make_token(exp_offset=-5))["sub"]


def test_the_leeway_is_bounded():
    """A minute of grace, not an open door."""
    assert security._CLOCK_SKEW_LEEWAY <= timedelta(minutes=5)


def test_audience_is_still_enforced():
    with pytest.raises(AuthenticationError):
        security.decode_access_token(make_token(aud="some-other-project"))


def test_a_missing_subject_is_still_rejected():
    now = datetime.now(UTC)
    token = jwt.encode(
        {"aud": settings.JWT_AUDIENCE, "exp": now + timedelta(hours=1)},
        SECRET,
        algorithm="HS256",
    )

    with pytest.raises(AuthenticationError):
        security.decode_access_token(token)


def test_a_wrong_signature_is_still_rejected():
    forged = jwt.encode(
        {
            "sub": "x",
            "aud": settings.JWT_AUDIENCE,
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        "a-different-secret",
        algorithm="HS256",
    )

    with pytest.raises(AuthenticationError):
        security.decode_access_token(forged)
