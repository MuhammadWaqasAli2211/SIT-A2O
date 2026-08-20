"""Application settings, loaded from environment. Fails fast on missing values."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]

# Absolute, so the file is found no matter which directory the process was
# started from. A bare ".env" resolves against the current working directory,
# which meant running uvicorn from anywhere but backend/ silently loaded no
# settings at all and failed with a wall of "Field required" errors.
ENV_FILE = BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore"
    )

    # --- Supabase ---
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    # Treated as a raw UTF-8 HMAC key. Do not base64-decode: Supabase's legacy
    # JWT secret looks base64 but is used verbatim.
    SUPABASE_JWT_SECRET: str

    # --- Database ---
    DATABASE_URL: str = ""

    # --- Gmail API (backend-triggered emails: interview invites, results,
    # onboarding links) --- Separate from Supabase's own SMTP config, which
    # only covers Supabase's auth emails.
    GMAIL_SENDER_EMAIL: str = ""
    GMAIL_CLIENT_ID: str = ""
    GMAIL_CLIENT_SECRET: str = ""
    GMAIL_REFRESH_TOKEN: str = ""

    # --- App ---
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: str = "http://localhost:5173"

    PROJECT_NAME: str = "Saylani Bootcamp Recruitment Platform"

    # Supabase signs access tokens with this audience.
    JWT_AUDIENCE: str = "authenticated"
    # Algorithms are selected per token in app/core/security.py; Supabase may
    # sign with ES256 (JWKS) or HS256 (legacy shared secret).

    @field_validator("SUPABASE_URL")
    @classmethod
    def _strip_api_path(cls, v: str) -> str:
        """Accept a pasted REST/auth endpoint and reduce it to the project base URL."""
        v = v.rstrip("/")
        for suffix in ("/rest/v1", "/auth/v1", "/storage/v1"):
            if v.endswith(suffix):
                v = v[: -len(suffix)]
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "prod"}

    @property
    def auth_url(self) -> str:
        return f"{self.SUPABASE_URL}/auth/v1"

    @property
    def jwks_url(self) -> str:
        """Public signing keys for asymmetric (ES256/RS256) access tokens."""
        return f"{self.auth_url}/.well-known/jwks.json"

    @property
    def gmail_configured(self) -> bool:
        return bool(
            self.GMAIL_SENDER_EMAIL
            and self.GMAIL_CLIENT_ID
            and self.GMAIL_CLIENT_SECRET
            and self.GMAIL_REFRESH_TOKEN
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
