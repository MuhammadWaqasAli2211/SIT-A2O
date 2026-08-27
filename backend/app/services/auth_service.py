"""Authentication use-cases.

Supabase owns credentials; this layer owns what the product needs around them:
profile lookup, role resolution, and consistent responses.
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import (
    AppError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitedError,
    UpstreamError,
)
from app.integrations import supabase_auth
from app.models.user import Profile
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    ResendConfirmationRequest,
    SignupRequest,
    SignupResponse,
    TokenPair,
)
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)

# Said whatever actually happened, so the endpoint cannot be used to test
# whether an address has an account. See resend_confirmation().
_RESEND_MESSAGE = (
    "If that address has an unconfirmed account, a new confirmation email "
    "is on its way. Remember to check your spam folder."
)


def _tokens_from(payload: dict) -> TokenPair:
    return TokenPair(
        access_token=payload["access_token"],
        refresh_token=payload["refresh_token"],
        expires_in=payload.get("expires_in", 3600),
    )


def get_profile(db: Session, user_id: uuid.UUID) -> Profile:
    # candidate_profile is eager-loaded because /auth/me serialises it and
    # this runs on every authenticated request; lazy-loading it would add a
    # second round trip per call.
    profile = db.scalar(
        select(Profile)
        .where(Profile.id == user_id)
        .options(selectinload(Profile.candidate_profile))
    )
    if profile is None:
        # The auth.users row exists but the trigger has not produced a profile.
        raise NotFoundError("Profile not found for this account.", code="profile_missing")
    if not profile.is_active:
        raise PermissionDeniedError("This account has been deactivated.")
    return profile


def signup(payload: SignupRequest) -> SignupResponse:
    """Register a candidate.

    Only CANDIDATE accounts are self-service. Admin and super-admin accounts are
    provisioned deliberately, so no role is accepted from the request body.
    """
    result = supabase_auth.sign_up(
        email=payload.email,
        password=payload.password,
        metadata={"full_name": payload.full_name, "phone": payload.phone},
    )

    # GoTrue omits a session when email confirmation is required.
    confirmation_required = result.get("access_token") is None

    return SignupResponse(
        message=(
            "Account created. Check your email to confirm your address."
            if confirmation_required
            else "Account created."
        ),
        email=payload.email,
        email_confirmation_required=confirmation_required,
    )


def resend_confirmation(payload: ResendConfirmationRequest) -> MessageResponse:
    """Send the signup confirmation email again.

    Without this a candidate who never received the first email is stuck for
    good: they cannot sign in until the address is confirmed, and nothing else
    in the product re-triggers that mail.

    The reply is identical whether the address is unknown, already confirmed,
    or genuinely resent, because this endpoint needs no authentication and a
    truthful answer would turn it into a way to test which addresses have
    accounts. Rate limiting and upstream failures are the exceptions: both are
    things the caller has to act on, and neither reveals anything about a
    particular address.
    """
    try:
        supabase_auth.resend_confirmation(payload.email)
    except (RateLimitedError, UpstreamError):
        raise
    except AppError:
        # Unknown address, already confirmed, or rejected by GoTrue. Logged so
        # a support question can still be answered, but not reflected back.
        logger.info("Confirmation resend not actioned for %s", payload.email)

    return MessageResponse(message=_RESEND_MESSAGE)


def login(db: Session, payload: LoginRequest) -> AuthResponse:
    result = supabase_auth.sign_in(payload.email, payload.password)
    tokens = _tokens_from(result)
    user_id = uuid.UUID(result["user"]["id"])
    return AuthResponse(tokens=tokens, profile=get_profile(db, user_id))


def refresh(db: Session, refresh_token: str) -> AuthResponse:
    result = supabase_auth.refresh(refresh_token)
    tokens = _tokens_from(result)
    user_id = uuid.UUID(result["user"]["id"])
    return AuthResponse(tokens=tokens, profile=get_profile(db, user_id))


def logout(access_token: str) -> None:
    supabase_auth.sign_out(access_token)
