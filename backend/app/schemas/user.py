import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr

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


class PictureOut(BaseModel):
    """Where the picture lives, and a short-lived URL to read it.

    The path is stable and stored; the URL expires, so it is generated per
    request rather than persisted.
    """

    picture_path: str | None = None
    url: str | None = None
