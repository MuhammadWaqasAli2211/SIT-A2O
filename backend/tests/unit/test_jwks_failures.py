"""How token verification behaves when the key service misbehaves.

An unreachable or empty JWKS must not look like a bad token. Answering 401 to
an upstream outage tells every signed-in user to sign in again, which cannot
fix it — and hides the actual fault.
"""

import pytest
from jwt import PyJWKClientConnectionError, PyJWKClientError

from app.core import security
from app.core.exceptions import AuthenticationError, UpstreamError

TOKEN = "header.payload.signature"


class FakeClient:
    """Stands in for PyJWKClient with a scripted outcome."""

    def __init__(self, *, raises=None, key_set=None, key_set_raises=False, succeed_on=None):
        self._raises = raises
        self._key_set = key_set
        self._key_set_raises = key_set_raises
        self._succeed_on = succeed_on
        self.lookups = 0

    def get_signing_key_from_jwt(self, _token):
        self.lookups += 1
        if self._succeed_on == self.lookups:
            return type("Key", (), {"key": "resolved-key"})()
        if self._raises:
            raise self._raises
        return type("Key", (), {"key": "resolved-key"})()

    def get_jwk_set(self, refresh=False):
        if self._key_set_raises:
            raise PyJWKClientConnectionError("boom")
        return type("Set", (), {"keys": self._key_set or []})()


@pytest.fixture(autouse=True)
def _asymmetric_header(monkeypatch):
    """Every case here is an ES256 token; the header is not what is under test."""
    monkeypatch.setattr(
        security.jwt, "get_unverified_header", lambda _t: {"alg": "ES256", "kid": "k1"}
    )


def use(monkeypatch, client):
    monkeypatch.setattr(security, "_jwks_client", lambda: client)
    return client


def test_unreachable_jwks_is_an_upstream_failure(monkeypatch):
    """502, not 401 — signing in again cannot fix a network outage."""
    use(monkeypatch, FakeClient(raises=PyJWKClientConnectionError("no route")))

    with pytest.raises(UpstreamError):
        security._key_and_algorithms(TOKEN)


def test_empty_key_set_is_an_upstream_failure(monkeypatch):
    """A rate-limited JWKS answers 200 with no keys, which is not a bad token."""
    use(
        monkeypatch,
        FakeClient(raises=PyJWKClientError("Unable to find a signing key"), key_set=[]),
    )

    with pytest.raises(UpstreamError):
        security._key_and_algorithms(TOKEN)


def test_unreadable_key_set_is_an_upstream_failure(monkeypatch):
    use(
        monkeypatch,
        FakeClient(
            raises=PyJWKClientError("Unable to find a signing key"), key_set_raises=True
        ),
    )

    with pytest.raises(UpstreamError):
        security._key_and_algorithms(TOKEN)


def test_unknown_kid_against_a_healthy_key_set_is_a_bad_token(monkeypatch):
    """The genuine 401: keys are readable, this one simply is not among them."""
    use(
        monkeypatch,
        FakeClient(
            raises=PyJWKClientError("Unable to find a signing key"), key_set=["k9"]
        ),
    )

    with pytest.raises(AuthenticationError) as caught:
        security._key_and_algorithms(TOKEN)
    assert caught.value.code == "invalid_token"


def test_rotation_resolves_on_the_retry(monkeypatch):
    """A key issued after our cache was filled is legitimate, not forged."""
    client = use(
        monkeypatch,
        FakeClient(
            raises=PyJWKClientError("Unable to find a signing key"),
            key_set=["k1"],
            succeed_on=2,
        ),
    )

    key, algorithms = security._key_and_algorithms(TOKEN)

    assert key == "resolved-key"
    assert "ES256" in algorithms
    assert client.lookups == 2, "the refreshed key set should be retried once"


def test_the_happy_path_costs_one_lookup(monkeypatch):
    client = use(monkeypatch, FakeClient())

    security._key_and_algorithms(TOKEN)

    assert client.lookups == 1
