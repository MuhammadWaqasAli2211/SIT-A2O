from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import ProfileOut


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class ResendConfirmationRequest(BaseModel):
    email: EmailStr


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    """Returned by login and refresh. `profile` is null until email is verified."""

    tokens: TokenPair
    profile: ProfileOut | None = None


class SignupResponse(BaseModel):
    message: str
    email: EmailStr
    email_confirmation_required: bool
