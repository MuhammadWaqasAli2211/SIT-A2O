"""Verification of Supabase-issued access tokens.

This service does not issue tokens. Supabase Auth (GoTrue) signs them; our only
job is to prove a token is authentic, unexpired, and addressed to this project.

Supabase signs access tokens one of two ways depending on project vintage:

* **Asymmetric (ES256/RS256)** — the current default. Tokens carry a `kid`, and
  the matching public key comes from the project's JWKS endpoint.
* **Symmetric (HS256)** — legacy projects, verified with the shared JWT secret.

Both are supported, because the same codebase may face either, and a project can
be migrated from one to the other without a deployment.
"""

from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient, PyJWKClientError

from app.core.config import settings
from app.core.exceptions import AuthenticationError, UpstreamError

# Everything we are willing to verify. `none` is absent by construction, and the
# key source is chosen per algorithm below, so a forged header cannot make us
# check an asymmetric token against a symmetric key.
_ASYMMETRIC = ("ES256", "RS256")


@lru_cache
def _jwks_client() -> PyJWKClient:
    # Keys are cached in-process; PyJWKClient refetches only on an unknown kid,
    # so routine requests cost nothing and key rotation still resolves.
    return PyJWKClient(settings.jwks_url, cache_keys=True, max_cached_keys=8)


def _key_and_algorithms(token: str) -> tuple[Any, list[str]]:
    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError(
            "Invalid authentication token.", code="invalid_token"
        ) from exc

    if algorithm == "HS256":
        return settings.SUPABASE_JWT_SECRET, ["HS256"]

    if algorithm in _ASYMMETRIC:
        try:
            return _jwks_client().get_signing_key_from_jwt(token).key, list(_ASYMMETRIC)
        except PyJWKClientError as exc:
            # Either the kid is unknown (a forged or stale token) or the JWKS
            # endpoint is unreachable. Treat an unknown key as an auth failure
            # and a transport failure as an upstream failure.
            if "Unable to find" in str(exc):
                raise AuthenticationError(
                    "Invalid authentication token.", code="invalid_token"
                ) from exc
            raise UpstreamError("Could not verify the token signing key.") from exc

    raise AuthenticationError(
        "Unsupported token algorithm.", code="invalid_token"
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify a Supabase access token and return its claims.

    Raises AuthenticationError on any signature, audience, or expiry failure.
    """
    key, algorithms = _key_and_algorithms(token)
    try:
        return jwt.decode(
            token,
            key,
            algorithms=algorithms,
            audience=settings.JWT_AUDIENCE,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError(
            "Session expired. Please sign in again.", code="token_expired"
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError(
            "Invalid authentication token.", code="invalid_token"
        ) from exc
