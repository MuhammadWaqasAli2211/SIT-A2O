"""SUPABASE_URL must reduce to the project base however it was pasted."""

import pytest

from app.core.config import Settings


@pytest.fixture
def base_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "secret")


@pytest.mark.parametrize(
    "given",
    [
        "https://abc.supabase.co",
        "https://abc.supabase.co/",
        "https://abc.supabase.co/rest/v1/",
        "https://abc.supabase.co/auth/v1",
        "https://abc.supabase.co/storage/v1/",
    ],
)
def test_project_url_is_normalized(base_env, monkeypatch, given):
    monkeypatch.setenv("SUPABASE_URL", given)
    settings = Settings(_env_file=None)
    assert settings.SUPABASE_URL == "https://abc.supabase.co"
    assert settings.auth_url == "https://abc.supabase.co/auth/v1"


def test_cors_origins_split(base_env, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173, https://app.example.com ")
    settings = Settings(_env_file=None)
    assert settings.cors_origin_list == ["http://localhost:5173", "https://app.example.com"]
