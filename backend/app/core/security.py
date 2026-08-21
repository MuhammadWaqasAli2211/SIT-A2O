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

from datetime import timedelta
from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient, PyJWKClientConnectionError, PyJWKClientError

from app.core.config import settings
from app.core.exceptions import AuthenticationError, UpstreamError

# Everything we are willing to verify. `none` is absent by construction, and the
# key source is chosen per algorithm below, so a forged header cannot make us
# check an asymmetric token against a symmetric key.
_ASYMMETRIC = ("ES256", "RS256")

# Tolerance for clock drift between Supabase's auth servers and this one.
#
# Not optional: GoTrue stamps `iat` from its own clock, and if it runs even a
# second ahead of ours, a token fails `iat` validation for the first moments of
# its life — so a user who has just signed in successfully gets 401s until the
# clocks converge. Observed in practice against the live project, where a
# freshly minted token raised ImmatureSignatureError while an older one from
# the same session verified fine.
#
# The same leeway also extends `exp` by this much, which is the accepted
# trade-off: a minute of grace on expiry is unremarkable, being unable to use
# a token you were just issued is not.
_CLOCK_SKEW_LEEWAY = timedelta(seconds=60)


@lru_cache
def _jwks_client() -> PyJWKClient:
    # Keys are cached in-process; PyJWKClient refetches only on an unknown kid,
    # so routine requests cost nothing and key rotation still resolves.
    return PyJWKClient(settings.jwks_url, cache_keys=True, max_cached_keys=8)


def _signing_keys_available(client: PyJWKClient) -> bool:
    """Whether the key set could be read at all, ignoring which keys it holds.

    Used to tell a bad token apart from a bad upstream: both surface as
    PyJWKClientError, and answering 401 to the second one tells the caller to
    sign in again for a problem that signing in again cannot fix.
    """
    try:
        return bool(client.get_jwk_set(refresh=True).keys)
    except Exception:
        return False


def _asymmetric_key(token: str) -> Any:
    """Resolve the JWKS public key for a token, refetching once on an unknown kid.

    The retry covers key rotation: a token minted with a key issued after our
    cached copy was fetched is legitimate, and must not be rejected just
    because the cache is stale.
    """
    client = _jwks_client()
    try:
        return client.get_signing_key_from_jwt(token).key
    except PyJWKClientConnectionError as exc:
        raise UpstreamError("Could not reach the token signing key service.") from exc
    except PyJWKClientError as exc:
        if not _signing_keys_available(client):
            raise UpstreamError("The token signing key set is unavailable.") from exc
        # The key set is readable and this kid genuinely is not in it.
        try:
            return client.get_signing_key_from_jwt(token).key
        except PyJWKClientError:
            raise AuthenticationError(
                "Invalid authentication token.", code="invalid_token"
            ) from exc


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
        return _asymmetric_key(token), list(_ASYMMETRIC)

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
            leeway=_CLOCK_SKEW_LEEWAY,
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
