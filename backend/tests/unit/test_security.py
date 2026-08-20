"""Token verification must reject anything not signed by this Supabase project."""

import time

import jwt
import pytest

from app.core.config import settings
from app.core.exceptions import AuthenticationError
from app.core.security import decode_access_token

USER_ID = "0f8fad5b-d9cb-469f-a165-70867728950e"


def make_token(*, secret: str | None = None, audience: str = "authenticated", ttl: int = 3600):
    now = int(time.time())
    return jwt.encode(
        {"sub": USER_ID, "aud": audience, "iat": now, "exp": now + ttl},
        secret or settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )


def test_valid_token_returns_claims():
    claims = decode_access_token(make_token())
    assert claims["sub"] == USER_ID


def test_expired_token_is_rejected():
    with pytest.raises(AuthenticationError) as exc:
        decode_access_token(make_token(ttl=-60))
    assert exc.value.code == "token_expired"


def test_token_signed_with_another_secret_is_rejected():
    with pytest.raises(AuthenticationError) as exc:
        decode_access_token(make_token(secret="an-attackers-secret"))
    assert exc.value.code == "invalid_token"


def test_token_for_another_audience_is_rejected():
    with pytest.raises(AuthenticationError) as exc:
        decode_access_token(make_token(audience="some-other-app"))
    assert exc.value.code == "invalid_token"


def test_garbage_is_rejected():
    with pytest.raises(AuthenticationError):
        decode_access_token("not-a-token")


def test_alg_none_is_rejected():
    """An unsigned token must never be accepted, whatever it claims."""
    import base64
    import json

    def seg(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    now = int(time.time())
    forged = (
        f"{seg({'alg': 'none', 'typ': 'JWT'})}."
        f"{seg({'sub': USER_ID, 'aud': 'authenticated', 'exp': now + 3600})}."
    )
    with pytest.raises(AuthenticationError) as exc:
        decode_access_token(forged)
    assert exc.value.code == "invalid_token"


def test_unsupported_algorithm_is_rejected():
    import base64
    import json

    def seg(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    now = int(time.time())
    token = (
        f"{seg({'alg': 'HS512', 'typ': 'JWT'})}."
        f"{seg({'sub': USER_ID, 'aud': 'authenticated', 'exp': now + 3600})}.sig"
    )
    with pytest.raises(AuthenticationError) as exc:
        decode_access_token(token)
    assert exc.value.code == "invalid_token"


def test_hs256_path_still_verifies():
    """Legacy symmetric projects must keep working alongside JWKS ones."""
    claims = decode_access_token(make_token())
    assert claims["sub"] == USER_ID
