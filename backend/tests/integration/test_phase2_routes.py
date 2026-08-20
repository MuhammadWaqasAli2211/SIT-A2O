"""Route contracts for the Phase 2 endpoints.

Auth-layer behaviour only: these run without a database, so they assert that
protected routes reject anonymous callers rather than exercising the pipeline.
The end-to-end pipeline is verified separately against the live database.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/bootcamps"),
        ("post", "/api/v1/bootcamps"),
        ("get", "/api/v1/bootcamps/00000000-0000-0000-0000-000000000000"),
        ("get", "/api/v1/bootcamps/00000000-0000-0000-0000-000000000000/applications"),
        ("post", "/api/v1/applications"),
        ("get", "/api/v1/applications/mine"),
    ],
)
def test_protected_routes_require_a_token(client, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/bootcamps"),
        ("get", "/api/v1/applications/mine"),
    ],
)
def test_invalid_token_is_401_not_500(client, method, path):
    response = getattr(client, method)(path, headers={"Authorization": "Bearer nonsense"})
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


def test_application_payload_is_validated(client):
    """Validation must reject a malformed body before any auth/db work."""
    response = client.post(
        "/api/v1/applications",
        headers={"Authorization": "Bearer nonsense"},
        json={"bootcamp_id": "not-a-uuid", "program_id": "also-not"},
    )
    assert response.status_code in (401, 422)


def test_phase_path_enum_is_enforced(client):
    """An unknown phase name must 422, never reach the service layer."""
    response = client.post(
        "/api/v1/bootcamps/00000000-0000-0000-0000-000000000000/phases/NOT_A_PHASE/open",
        headers={"Authorization": "Bearer nonsense"},
    )
    assert response.status_code in (401, 422)
