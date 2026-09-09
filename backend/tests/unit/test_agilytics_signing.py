"""The Agilytics request signature, pinned to fixed vectors.

A signing bug on this integration surfaces as a bare 403 with no detail,
so the algorithm is tested against known secret/payload/digest triples
here rather than against the live API. These digests were computed
independently of `agilytics.sign` — if the implementation drifts, one of
these fails immediately and says which part moved.
"""

import hashlib
import hmac

import pytest

from app.core.exceptions import ServiceNotConfiguredError
from app.integrations import agilytics

SECRET = "test-portal-secret"

# HMAC-SHA256(SECRET, payload), lowercase hex.
VECTORS = {
    "": "31b29625568d6fd80d3d5a766076956ae546d13d341dc5e0d7c801a1ef5cc0e0",
    "email=someone%40example.com": (
        "012dd3342e0114f5de82eec0afaf19acbd9468d3dd432d256e1d3124e755fc8f"
    ),
    "email=someone%40example.com&limit=10": (
        "39c630391d46cd2496db7f9050da83b2148d5614159b43085e323419ee23a6e7"
    ),
    '{"name": "Batch 8"}': (
        "175abb82ae5b39bc466191e8b9668734e65c0f5b55ecda3ea9c724f5feeed0e2"
    ),
}


@pytest.fixture(autouse=True)
def _use_test_secret(monkeypatch):
    monkeypatch.setattr(agilytics.settings, "PORTAL_AGILYTICS_SECRET", SECRET)


@pytest.mark.parametrize("payload,expected", VECTORS.items(), ids=range(len(VECTORS)))
def test_signature_matches_the_fixed_vector(payload, expected):
    assert agilytics.sign(payload) == expected


def test_signature_is_hmac_not_a_plain_digest():
    """A plain sha256 of the payload would also be 64 hex chars and would
    also look fine in a header — this pins that the key is actually used."""
    payload = "email=someone%40example.com"
    assert agilytics.sign(payload) != hashlib.sha256(payload.encode()).hexdigest()
    assert agilytics.sign(payload) == hmac.new(
        SECRET.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()


def test_a_different_secret_gives_a_different_signature(monkeypatch):
    first = agilytics.sign("email=someone%40example.com")
    monkeypatch.setattr(agilytics.settings, "PORTAL_AGILYTICS_SECRET", "another-secret")
    assert agilytics.sign("email=someone%40example.com") != first


def test_signing_without_a_secret_is_refused_not_silently_wrong(monkeypatch):
    """Signing with an empty key produces a perfectly valid-looking digest
    that Agilytics would reject as a bare 403. Failing loudly here names
    the actual problem instead."""
    monkeypatch.setattr(agilytics.settings, "PORTAL_AGILYTICS_SECRET", "")
    with pytest.raises(ServiceNotConfiguredError):
        agilytics.sign("email=someone%40example.com")


# ----------------------------------------------------- canonical payload --


def test_get_signs_the_sorted_query_string():
    payload = agilytics.canonical_payload(
        "GET", params={"limit": 10, "email": "someone@example.com"}
    )
    assert payload == "email=someone%40example.com&limit=10"


def test_get_with_no_params_signs_the_empty_string():
    assert agilytics.canonical_payload("GET", params={}) == ""
    assert agilytics.canonical_payload("GET") == ""


def test_query_keys_are_sorted_not_insertion_ordered():
    """Sorting is the whole point — the other side rebuilds this string from
    a dict of its own and cannot reproduce our insertion order."""
    forward = agilytics.canonical_payload("GET", params={"a": 1, "b": 2})
    backward = agilytics.canonical_payload("GET", params={"b": 2, "a": 1})
    assert forward == backward == "a=1&b=2"


def test_post_signs_the_raw_body_verbatim():
    """Not a re-serialisation of it: the bytes signed must be the bytes sent,
    down to separator spacing."""
    body = b'{"name": "Batch 8"}'
    assert agilytics.canonical_payload("POST", body=body) == '{"name": "Batch 8"}'


def test_post_ignores_query_params_when_signing():
    body = b'{"name": "Batch 8"}'
    assert (
        agilytics.canonical_payload("POST", params={"email": "x@y.com"}, body=body)
        == '{"name": "Batch 8"}'
    )


def test_a_body_less_post_signs_the_empty_string():
    assert agilytics.canonical_payload("POST") == ""


@pytest.mark.parametrize("method", ["get", "Get", "GET"])
def test_method_matching_is_case_insensitive(method):
    """`_request` passes the method through from a caller that may spell it
    either way; picking the wrong branch on case would sign the wrong thing."""
    assert agilytics.canonical_payload(method, params={"a": 1}, body=b"x") == "a=1"


def test_timestamp_is_in_milliseconds():
    """Seconds would read as a timestamp decades in the past and be refused
    for clock drift — a failure that looks identical to a bad signature."""
    now_ms = agilytics._now_ms()
    # Comfortably past the point where a seconds-valued epoch could reach.
    assert now_ms > 1_000_000_000_000
    assert len(str(now_ms)) == 13


@pytest.mark.parametrize("key", ["signature", "sig"])
def test_the_signature_param_is_never_part_of_what_it_signs(key):
    """Their endpoints also accept the signature as a query param, so it is
    excluded from the signed string. We send it as a header and never as a
    param — this keeps that true if anyone ever changes that."""
    assert agilytics.canonical_payload("GET", params={key: "abc", "email": "a@b.com"}) == (
        "email=a%40b.com"
    )
