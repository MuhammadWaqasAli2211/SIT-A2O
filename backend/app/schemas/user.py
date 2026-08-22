import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class CandidateProfileOut(BaseModel):
    """Person-level details captured at registration.

    Absent until somebody registers — an account on its own has none of this,
    which is exactly the User/Candidate distinction the portal is built around.
    """

    model_config = ConfigDict(from_attributes=True)

    full_name: str | None = None
    father_name: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    city: str | None = None
    phone: str | None = None
    father_phone: str | None = None
    cnic: str | None = None
    father_cnic: str | None = None
    address: str | None = None
    saylani_roll_number: str | None = None
    education: str | None = None
    picture_path: str | None = None


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    phone: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime

    # None for anyone who has not registered. The profile page renders from
    # this rather than from placeholders.
    candidate_profile: CandidateProfileOut | None = None


class CandidateProfileSummary(BaseModel):
    """The subset of a candidate's profile an admin's user directory needs.

    Deliberately narrower than `CandidateProfileOut`: an admin looking up a
    user does not need their father's CNIC or picture path.
    """

    model_config = ConfigDict(from_attributes=True)

    cnic: str | None = None
    date_of_birth: date | None = None
    city: str | None = None
    education: str | None = None


class UserDetail(ProfileOut):
    candidate_profile: CandidateProfileSummary | None = None
    application_count: int = 0
    managed_bootcamp_ids: list[uuid.UUID] = Field(default_factory=list)


# ------------------------------------------------------------ admin edits --


class ProfileUpdate(BaseModel):
    """Fields an administrator may change on any profile.

    `role` and `is_active` are deliberately absent: both are privileged enough
    to warrant their own endpoint and their own audit entry.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    cnic: str | None = Field(default=None, max_length=20)
    date_of_birth: date | None = None
    city: str | None = Field(default=None, max_length=80)
    education: str | None = Field(default=None, max_length=120)


class SelfProfileUpdate(BaseModel):
    """What a signed-in user may change about themselves.

    A separate type from `ProfileUpdate` rather than a reuse: these two are
    reached by different callers with different rights, and sharing one schema
    would mean a field added for admins silently becomes self-editable.
    Neither carries `role` or `is_active`; those live on their own endpoints.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    cnic: str | None = Field(default=None, max_length=20)
    date_of_birth: date | None = None
    city: str | None = Field(default=None, max_length=80)
    education: str | None = Field(default=None, max_length=120)


class RoleChange(BaseModel):
    role: UserRole
    reason: str | None = Field(default=None, max_length=500)


class ActiveChange(BaseModel):
    is_active: bool
    reason: str | None = Field(default=None, max_length=500)


class StaffCreate(BaseModel):
    """Provision an ADMIN or SUPER_ADMIN account.

    Self-service signup can only ever produce a CANDIDATE, so staff accounts
    are created here — by a super admin — with the password set directly and
    the email pre-confirmed.
    """

    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    role: UserRole = UserRole.ADMIN
    bootcamp_ids: list[uuid.UUID] = Field(
        default_factory=list, description="Intakes to assign the new admin to immediately."
    )


class PasswordReset(BaseModel):
    password: str = Field(min_length=12, max_length=128)


class UserRow(BaseModel):
    """One row of the administrator/user directory."""

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    phone: str | None = None
    role: UserRole
    is_active: bool
    application_count: int = 0
    bootcamp_count: int = 0
    created_at: datetime


class PictureOut(BaseModel):
    """Where the picture lives, and a short-lived URL to read it.

    The path is stable and stored; the URL expires, so it is generated per
    request rather than persisted.
    """

    picture_path: str | None = None
    url: str | None = None
