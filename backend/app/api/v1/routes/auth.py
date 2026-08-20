from fastapi import APIRouter, status

from app.api.deps import AccessToken, CurrentUser, DbSession
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    SignupResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.user import ProfileOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest) -> SignupResponse:
    """Register a candidate account."""
    return auth_service.signup(payload)


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
