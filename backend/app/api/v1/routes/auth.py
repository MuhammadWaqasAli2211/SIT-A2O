from fastapi import APIRouter, status

from app.api.deps import AccessToken, CurrentUser, DbSession
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    ResendConfirmationRequest,
    SignupRequest,
    SignupResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.user import ProfileOut, SelfProfileUpdate, UserDetail
from app.services import auth_service, user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest) -> SignupResponse:
    """Register a candidate account."""
    return auth_service.signup(payload)


@router.post("/resend-confirmation", response_model=MessageResponse)
def resend_confirmation(payload: ResendConfirmationRequest) -> MessageResponse:
    """Send the signup confirmation email again.

    Deliberately unauthenticated: the caller cannot sign in yet, which is the
    whole reason they are here.
    """
    return auth_service.resend_confirmation(payload)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: DbSession) -> AuthResponse:
    return auth_service.login(db, payload)


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest, db: DbSession) -> AuthResponse:
    return auth_service.refresh(db, payload.refresh_token)


@router.post("/logout", response_model=MessageResponse)
def logout(token: AccessToken) -> MessageResponse:
    auth_service.logout(token)
    return MessageResponse(message="Signed out.")


@router.get("/me", response_model=ProfileOut)
def me(user: CurrentUser) -> ProfileOut:
    return ProfileOut.model_validate(user)


@router.get("/me/detail", response_model=UserDetail)
def me_detail(user: CurrentUser, db: DbSession) -> UserDetail:
    """The caller's own record, including their candidate fields."""
    return user_service.get_detail(db, user.id)


@router.patch("/me", response_model=UserDetail)
def update_me(payload: SelfProfileUpdate, user: CurrentUser, db: DbSession) -> UserDetail:
    """Update your own contact and candidate details.

    Deliberately a different schema from the admin `PATCH /users/{id}`: this
    one has no route to `role` or `is_active`, so a candidate editing their own
    phone number cannot reach a privilege field even if one were added to the
    admin schema later.
    """
    user_service.update_own_profile(db, user, payload)
    return user_service.get_detail(db, user.id)
