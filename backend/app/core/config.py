"""Application settings, loaded from environment. Fails fast on missing values."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The backend package root, resolved from this file rather than from the
# working directory. `.env` lives beside it, and anchoring the path here means
# the app starts the same way whether it was launched from backend/, from the
# repo root, or by a supervisor with no meaningful cwd at all.
_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
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
    # The one frontend origin this backend hands out *links* to — signup's
    # email-confirmation redirect today, and the natural home for any future
    # emailed link. Deliberately separate from CORS_ORIGINS, which is a list
    # of origins allowed to *call* the API and normally holds more than one
    # (a deployed frontend plus a local dev server); a link can only point
    # at one place, so this is a single value, not the first item of that list.
    FRONTEND_URL: str = "http://localhost:5173"

    PROJECT_NAME: str = "Saylani Bootcamp Recruitment Platform"

    # --- Candidate document uploads ---
    # Private bucket; files are only ever reachable through a short-lived
    # signed URL the API mints, never by a public path.
    DOCUMENTS_BUCKET: str = "candidate-documents"
    DOCUMENT_MAX_BYTES: int = 5 * 1024 * 1024
    # Seconds a download link stays valid. Short by intent: these are CNICs.
    DOCUMENT_SIGNED_URL_TTL: int = 120

    # --- Bulk document export (HOD hand-off) ---
    # A separate, much longer life than the single-document link above, and
    # deliberately its own setting rather than a reuse of it: that one covers
    # an admin clicking a file they are already looking at, where 2 minutes is
    # generous. This one covers an HOD opening a mailbox some time later and
    # then pulling several hundred MB over whatever connection they have —
    # 2 minutes would expire mid-download, if not before they clicked.
    EXPORT_SIGNED_URL_TTL: int = 86_400  # 24 hours
    # Its own bucket, not a prefix inside the documents one: exports are
    # derived, disposable copies with a different retention story, and a
    # cleanup job pointed at this must never be able to reach the originals.
    EXPORTS_BUCKET: str = "document-exports"

    # --- InterviewerAI (Phase 2 AI screening invites) ---
    # A third-party service, not ours: it conducts the self-service AI
    # interview itself once a candidate is invited. Empty by default so the
    # app still boots without it configured; interview_invite_service raises
    # a clear error if a send is attempted with no key set.
    INTERVIEWER_AI_API_KEY: str = ""
    INTERVIEWER_AI_BASE_URL: str = "https://interviewerai-production-b311.up.railway.app/api/v1"

    # --- Agilytics (post-onboarding workspace provisioning) ---
    # A shared HMAC secret, not a bearer token: every request we send is
    # signed with it (see app/integrations/agilytics.py). It stays server-side
    # and is never handed to, nor derivable by, the frontend — same standard
    # as INTERVIEWER_AI_API_KEY above.
    PORTAL_AGILYTICS_SECRET: str = ""
    # `agilytics-preview.vercel.app` is a Vercel *preview* deployment. Kept in
    # configuration precisely so pointing at the eventual production host is
    # an env change rather than a code change.
    AGILYTICS_API_BASE_URL: str = "https://agilytics-preview.vercel.app"
    # AGILYTICS_API_BASE_URL: str = "https://agilytics-preview-git-hasn-4828d1-fareedanwer381-2351s-projects.vercel.app/"

    # Where we send *students*, as distinct from where we send API calls. The
    # two are the same host today, but they are separate settings because
    # there is no guarantee they stay that way — a partner serving its API
    # from `api.` and its app from `app.` is the ordinary arrangement, and
    # discovering that later should not mean unpicking one value used for two
    # purposes.
    #
    # Both of these are provisional. Their spec documents no student-facing
    # URL at all: it says accounts are created "auto-verified, no confirmation
    # email" and stops there, so how a student actually signs in for the first
    # time is our assumption, not their documentation. `/reset-password` is
    # the common convention and a guess. See the note in email_service's
    # `send_agilytics_onboarded`.
    #
    # Confirmed answers change these two lines and nothing else.
    AGILYTICS_APP_URL: str = "https://agilytics-preview.vercel.app"
    # Full URL, so a partner whose reset page lives somewhere unrelated to the
    # app root is a one-value change rather than a path-joining puzzle. Empty
    # derives it from AGILYTICS_APP_URL.
    AGILYTICS_PASSWORD_RESET_URL: str = ""

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

    @property
    def interviewer_ai_configured(self) -> bool:
        return bool(self.INTERVIEWER_AI_API_KEY)

    @property
    def agilytics_configured(self) -> bool:
        return bool(self.PORTAL_AGILYTICS_SECRET and self.AGILYTICS_API_BASE_URL)

    @property
    def agilytics_login_url(self) -> str:
        """Where a student signs in to Agilytics. Assumed, not documented."""
        return self.AGILYTICS_APP_URL.rstrip("/")

    @property
    def agilytics_password_reset_url(self) -> str:
        """Where a student sets their password the first time.

        Assumed, not documented — see AGILYTICS_PASSWORD_RESET_URL above.
        Derived from the app URL unless overridden outright, so the common
        case is one setting and the awkward case is still one setting.
        """
        if self.AGILYTICS_PASSWORD_RESET_URL:
            return self.AGILYTICS_PASSWORD_RESET_URL.rstrip("/")
        return f"{self.agilytics_login_url}/reset-password"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
