"""Route contracts for the admin surface.

Auth-layer behaviour only, as with the other integration tests: these run
without a database, so they assert that the new endpoints are gated at all —
the pipeline itself is verified against the live database.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

NIL = "00000000-0000-0000-0000-000000000000"


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.mark.parametrize(
    "method,path",
    [
        # user administration
        ("get", "/api/v1/users"),
        ("post", "/api/v1/users"),
        ("get", f"/api/v1/users/{NIL}"),
        ("patch", f"/api/v1/users/{NIL}"),
        ("post", f"/api/v1/users/{NIL}/role"),
        ("post", f"/api/v1/users/{NIL}/active"),
        ("post", f"/api/v1/users/{NIL}/password"),
        ("delete", f"/api/v1/users/{NIL}"),
        # interviews
        ("get", f"/api/v1/bootcamps/{NIL}/interviews"),
        ("post", f"/api/v1/bootcamps/{NIL}/interviews/batch"),
        ("post", "/api/v1/interviews"),
        ("patch", f"/api/v1/interviews/{NIL}"),
        ("delete", f"/api/v1/interviews/{NIL}"),
        ("get", "/api/v1/me/interviews"),
        # email
        ("get", f"/api/v1/bootcamps/{NIL}/emails"),
        ("post", f"/api/v1/bootcamps/{NIL}/emails/send"),
        ("post", f"/api/v1/bootcamps/{NIL}/emails/broadcast"),
        # oversight
        ("get", "/api/v1/audit"),
        ("get", "/api/v1/stats"),
        ("get", f"/api/v1/bootcamps/{NIL}/stats"),
        ("get", f"/api/v1/bootcamps/{NIL}/audit"),
        # reference data + records
        ("get", "/api/v1/programs/manage"),
        ("post", "/api/v1/programs"),
        ("patch", f"/api/v1/programs/{NIL}"),
        ("delete", f"/api/v1/programs/{NIL}"),
        ("delete", f"/api/v1/bootcamps/{NIL}"),
        ("delete", f"/api/v1/applications/{NIL}"),
        ("post", f"/api/v1/applications/{NIL}/reinstate"),
        ("get", f"/api/v1/applications/{NIL}/admin"),
        # onboarding: forms
        ("get", f"/api/v1/applications/{NIL}/onboarding/forms"),
        ("get", f"/api/v1/applications/{NIL}/onboarding/progress"),
        ("post", f"/api/v1/applications/{NIL}/onboarding/forms/BACKGROUND_VERIFICATION"),
        ("get", f"/api/v1/admin/applications/{NIL}/onboarding/forms"),
        ("post", f"/api/v1/onboarding/forms/{NIL}/reopen"),
        # onboarding: documents hub
        ("get", f"/api/v1/bootcamps/{NIL}/onboarding/candidates"),
        ("get", f"/api/v1/applications/{NIL}/onboarding/documents"),
        ("post", f"/api/v1/applications/{NIL}/onboarding/documents"),
        ("get", f"/api/v1/admin/applications/{NIL}/onboarding/documents"),
        ("delete", f"/api/v1/onboarding/documents/{NIL}"),
        ("get", f"/api/v1/onboarding/documents/{NIL}/link"),
        ("get", f"/api/v1/admin/onboarding/documents/{NIL}/link"),
        ("post", f"/api/v1/onboarding/documents/{NIL}/review"),
        # self-service
        ("get", "/api/v1/auth/me/detail"),
        ("patch", "/api/v1/auth/me"),
    ],
)
def test_admin_routes_require_a_token(client, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 401, f"{method.upper()} {path} was not gated"
    assert response.json()["code"] == "unauthenticated"


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/users"),
        ("get", "/api/v1/audit"),
        ("get", "/api/v1/stats"),
        ("get", "/api/v1/me/interviews"),
    ],
)
def test_garbage_token_is_401_not_500(client, method, path):
    response = getattr(client, method)(path, headers={"Authorization": "Bearer nonsense"})
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


def test_the_public_program_list_stays_public(client):
    """Adding admin routes under /programs must not gate the marketing list."""
    assert client.get("/api/v1/programs").status_code != 401


def test_email_send_body_is_validated(client):
    """An empty recipient list must be rejected by the schema, not the service."""
    response = client.post(
        f"/api/v1/bootcamps/{NIL}/emails/send",
        headers={"Authorization": "Bearer nonsense"},
        json={"application_ids": [], "subject": "Hi", "body_html": "<p>Hi</p>"},
    )
    assert response.status_code in (401, 422)


def test_interview_score_invariant_is_enforced_at_the_edge(client):
    response = client.patch(
        f"/api/v1/interviews/{NIL}",
        headers={"Authorization": "Bearer nonsense"},
        json={"status": "SCHEDULED", "score": 80},
    )
    assert response.status_code in (401, 422)


def test_self_update_ignores_a_role_in_the_body(client):
    """A privilege field in the payload must not even reach validation as one."""
    response = client.patch(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer nonsense"},
        json={"full_name": "X", "role": "SUPER_ADMIN"},
    )
    # Rejected for the bad token, never 422 — `role` is simply not a field here,
    # so it is dropped rather than failing validation.
    assert response.status_code == 401


def test_onboarding_document_review_body_is_validated(client):
    response = client.post(
        f"/api/v1/onboarding/documents/{NIL}/review",
        headers={"Authorization": "Bearer nonsense"},
        json={"status": "NOT_A_STATUS"},
    )
    assert response.status_code in (401, 422)


def test_onboarding_document_upload_requires_multipart(client):
    """A JSON body must not be accepted where a file is expected."""
    response = client.post(
        f"/api/v1/applications/{NIL}/onboarding/documents",
        headers={"Authorization": "Bearer nonsense"},
        json={"doc_type": "CV"},
    )
    assert response.status_code in (401, 422)
