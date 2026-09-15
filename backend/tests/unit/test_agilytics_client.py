"""What the Agilytics client sends, and what it makes of what comes back.

Signing itself is pinned in test_agilytics_signing.py. This file covers the
layer above it: the request each endpoint builds, the `{success, data}`
envelope, and the mapping from their status codes onto our exception
vocabulary — the parts that would otherwise only be discovered against a live
service that creates real workspaces when you get it wrong.
"""

import json

import httpx
import pytest

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    ServiceNotConfiguredError,
    UpstreamError,
)
from app.integrations import agilytics

SECRET = "test-portal-secret"
WORKSPACE = "d8c42c93-0000-0000-0000-000000000000"


@pytest.fixture(autouse=True)
def _configured(monkeypatch):
    monkeypatch.setattr(agilytics.settings, "PORTAL_AGILYTICS_SECRET", SECRET)
    monkeypatch.setattr(agilytics.settings, "AGILYTICS_API_BASE_URL", "https://agilytics.test")


class Capture:
    """Stands in for httpx.Client, recording the one request it is given."""

    def __init__(self, response: httpx.Response):
        self.response = response
        self.seen: dict = {}

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def request(self, method, url, *, headers, params, content):
        self.seen.update(
            method=method, url=url, headers=headers, params=params, content=content
        )
        return self.response


def respond(payload, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status,
        content=json.dumps(payload).encode() if payload is not None else b"",
        headers={"content-type": "application/json"},
        request=httpx.Request("GET", "https://agilytics.test"),
    )


def run(monkeypatch, call, response: httpx.Response) -> Capture:
    capture = Capture(response)
    monkeypatch.setattr(agilytics.httpx, "Client", lambda **kwargs: capture)
    capture.result = call()
    return capture


# --------------------------------------------------------------- envelope --


def test_the_success_envelope_is_unwrapped(monkeypatch):
    """Callers get `data`; `{"success": true}` tells them nothing the status
    code did not already say."""
    capture = run(
        monkeypatch,
        lambda: agilytics.onboarding_status(WORKSPACE),
        respond({"success": True, "data": {"workspaceId": WORKSPACE, "totalMembers": 25}}),
    )

    assert capture.result == {"workspaceId": WORKSPACE, "totalMembers": 25}


def test_an_unenveloped_body_is_passed_through(monkeypatch):
    """Tolerated rather than returned as None, so an endpoint that ever
    answers without the envelope does not read as an empty result."""
    capture = run(
        monkeypatch,
        lambda: agilytics.onboarding_status(WORKSPACE),
        respond({"workspaceId": WORKSPACE}),
    )

    assert capture.result == {"workspaceId": WORKSPACE}


# ------------------------------------------------------- onboarding status --


def test_status_without_an_email_sends_no_query_params(monkeypatch):
    capture = run(
        monkeypatch,
        lambda: agilytics.onboarding_status(WORKSPACE),
        respond({"success": True, "data": {}}),
    )

    assert capture.seen["method"] == "GET"
    assert capture.seen["url"].endswith(
        f"/api/v1/external/workspaces/{WORKSPACE}/onboarding-status"
    )
    # None, not {} — httpx would otherwise append a bare "?" to the URL.
    assert capture.seen["params"] is None
    assert capture.seen["content"] is None


def test_status_with_an_email_signs_that_query_string(monkeypatch):
    capture = run(
        monkeypatch,
        lambda: agilytics.onboarding_status(WORKSPACE, email="student@example.com"),
        respond({"success": True, "data": {}}),
    )

    assert capture.seen["params"] == {"email": "student@example.com"}
    assert capture.seen["headers"]["x-portal-signature"] == agilytics.sign(
        "email=student%40example.com"
    )


# ---------------------------------------------------------------- onboard --


def test_onboard_sends_the_student_list_and_signs_those_bytes(monkeypatch):
    """Unlike the endpoint this replaced, the member list is the request —
    so what is signed has to be exactly what was selected."""
    capture = run(
        monkeypatch,
        lambda: agilytics.onboard(
            WORKSPACE,
            [
                {"email": "one@example.com", "trackName": "Web Dev"},
                {"email": "two@example.com"},
            ],
        ),
        respond({"success": True, "data": {"onboardedCount": 2}}),
    )

    sent = capture.seen["content"]
    assert capture.seen["method"] == "POST"
    assert capture.seen["headers"]["x-portal-signature"] == agilytics.sign(sent.decode())
    assert json.loads(sent) == {
        "students": [
            {"email": "one@example.com", "trackName": "Web Dev"},
            {"email": "two@example.com"},
        ]
    }


def test_onboard_targets_the_workspaces_own_path(monkeypatch):
    capture = run(
        monkeypatch,
        lambda: agilytics.onboard(WORKSPACE, [{"email": "a@example.com"}]),
        respond({"success": True, "data": {}}),
    )

    assert capture.seen["url"].endswith(f"/workspaces/{WORKSPACE}/onboard")


# ------------------------------------------------------------------ stats --


def test_stats_is_a_get_with_no_query_string(monkeypatch):
    """Nothing to sign but the empty string: the workspace is in the path,
    not a parameter."""
    capture = run(
        monkeypatch,
        lambda: agilytics.stats(WORKSPACE),
        respond({"success": True, "data": {"totalMembers": 27}}),
    )

    assert capture.seen["method"] == "GET"
    assert capture.seen["headers"]["x-portal-signature"] == agilytics.sign("")
    assert capture.seen["url"].endswith(f"/workspaces/{WORKSPACE}/stats")
    assert capture.result == {"totalMembers": 27}


# ------------------------------------------------------------ provisioning --


def test_provision_signs_exactly_the_bytes_it_sends(monkeypatch):
    """The whole point of serialising once: a second `json.dumps` with
    different separators would produce a valid-looking signature over a
    different string."""
    capture = run(
        monkeypatch,
        lambda: agilytics.provision_workspace(
            name="Bootcamp 7",
            description="Q3 cohort",
            students=[{"email": "s@example.com", "fullName": "John Smith"}],
        ),
        respond({"success": True, "data": {"workspaceId": WORKSPACE}}, status=201),
    )

    sent = capture.seen["content"]
    assert capture.seen["headers"]["x-portal-signature"] == agilytics.sign(sent.decode())
    assert json.loads(sent) == {
        "name": "Bootcamp 7",
        "description": "Q3 cohort",
        "students": [{"email": "s@example.com", "fullName": "John Smith"}],
    }


def test_provision_omits_empty_collections(monkeypatch):
    """Their schema defaults these; sending empty lists says something
    slightly different from saying nothing, and there is no reason to."""
    capture = run(
        monkeypatch,
        lambda: agilytics.provision_workspace(name="Bootcamp 8"),
        respond({"success": True, "data": {}}, status=201),
    )

    assert json.loads(capture.seen["content"]) == {"name": "Bootcamp 8", "description": ""}


def test_provision_never_sends_tracks(monkeypatch):
    """Their current schema has no `tracks` field — provisioning does not
    create them, and a workspace's tracks are pre-configured on their side.
    Sending one would be describing something that cannot happen."""
    capture = run(
        monkeypatch,
        lambda: agilytics.provision_workspace(
            name="B8", students=[{"email": "a@example.com", "fullName": "A"}]
        ),
        respond({"success": True, "data": {}}, status=201),
    )

    assert "tracks" not in json.loads(capture.seen["content"])


# ---------------------------------------------------------------- errors --


@pytest.mark.parametrize("status", [401, 403])
def test_a_refused_signature_is_an_upstream_problem_not_the_admins(monkeypatch, status):
    """The signed-in admin already passed our own checks — a 403 here is our
    key or our clock, which is an operator problem, not their permissions."""
    with pytest.raises(UpstreamError) as caught:
        run(
            monkeypatch,
            lambda: agilytics.onboarding_status(WORKSPACE),
            respond({"error": "Forbidden", "message": "Invalid HMAC signature"}, status),
        )

    assert "Invalid HMAC signature" in (caught.value.details or "")


def test_a_missing_workspace_is_a_not_found(monkeypatch):
    with pytest.raises(NotFoundError) as caught:
        run(
            monkeypatch,
            lambda: agilytics.onboarding_status(WORKSPACE),
            respond({"error": "Not found", "message": "Workspace not found."}, 404),
        )

    assert "Workspace not found." in str(caught.value)


def test_a_rejected_request_is_actionable_not_a_502(monkeypatch):
    """A 400 is a payload an admin can fix; reporting it as a 502 would tell
    them to try again later when the request will never succeed as sent."""
    with pytest.raises(ConflictError) as caught:
        run(
            monkeypatch,
            lambda: agilytics.provision_workspace(name=""),
            respond({"error": "Bad Request", "message": "name is required"}, 400),
        )

    assert "name is required" in str(caught.value)


def test_a_server_failure_is_an_upstream_error(monkeypatch):
    with pytest.raises(UpstreamError):
        run(
            monkeypatch,
            lambda: agilytics.stats(WORKSPACE),
            respond({"error": "Internal", "message": "boom"}, 500),
        )


def test_an_unreachable_service_is_an_upstream_error(monkeypatch):
    class Boom:
        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            return False

        def request(self, *args, **kwargs):
            raise httpx.ConnectError("no route")

    monkeypatch.setattr(agilytics.httpx, "Client", lambda **kwargs: Boom())

    with pytest.raises(UpstreamError):
        agilytics.onboarding_status(WORKSPACE)


def test_a_non_json_body_is_reported_as_such(monkeypatch):
    response = httpx.Response(
        200, content=b"<html>gateway</html>", request=httpx.Request("GET", "https://x.test")
    )

    with pytest.raises(UpstreamError):
        run(monkeypatch, lambda: agilytics.onboarding_status(WORKSPACE), response)


def test_nothing_is_sent_when_the_secret_is_missing(monkeypatch):
    """Signing with an empty key produces a valid-looking digest that would be
    refused as a bare 403. Failing here names the real problem."""
    monkeypatch.setattr(agilytics.settings, "PORTAL_AGILYTICS_SECRET", "")

    with pytest.raises(ServiceNotConfiguredError):
        agilytics.onboarding_status(WORKSPACE)
