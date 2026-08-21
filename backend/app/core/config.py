"""Application settings, loaded from environment. Fails fast on missing values."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
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

    # --- Candidate document uploads ---
    # Private bucket; files are only ever reachable through a short-lived
    # signed URL the API mints, never by a public path.
    DOCUMENTS_BUCKET: str = "candidate-documents"
    DOCUMENT_MAX_BYTES: int = 5 * 1024 * 1024
    # Seconds a download link stays valid. Short by intent: these are CNICs.
    DOCUMENT_SIGNED_URL_TTL: int = 120

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
    def storage_url(self) -> str:
        return f"{self.SUPABASE_URL}/storage/v1"

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
