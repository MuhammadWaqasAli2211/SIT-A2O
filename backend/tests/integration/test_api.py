"""Route-level contract: status codes and the shared error envelope."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_health_is_public(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_me_requires_a_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"


def test_invalid_token_is_401_not_500(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer nonsense"})
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


def test_signup_validation_lists_offending_fields(client):
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "nope", "password": "short", "full_name": "A"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert {d["field"] for d in body["details"]} == {"email", "password", "full_name"}


def test_errors_share_one_envelope(client):
    body = client.get("/api/v1/auth/me").json()
    assert set(body) == {"code", "message", "details"}
