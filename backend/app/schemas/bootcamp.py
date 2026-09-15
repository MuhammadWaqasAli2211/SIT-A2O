import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import BootcampStatus, PhaseType


class ProgramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    tagline: str
    description: str | None = None
    duration: str | None = None
    mode: str | None = None
    level: str | None = None


class PhaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phase: PhaseType
    opens_at: datetime | None = None
    deadline_at: datetime | None = None
    is_open: bool
    # Only the INTERVIEW phase uses this today — when its AI interview
    # results were announced to candidates. Null means not announced.
    results_announced_at: datetime | None = None


class PhaseUpdate(BaseModel):
    """Partial by design.

    Both fields are nullable *and* optional, which are different things here:
    omitting `deadline_at` must leave the stored deadline alone, while sending
    an explicit null must clear it. The service distinguishes the two with
    `model_dump(exclude_unset=True)`; assigning both unconditionally would wipe
    a deadline every time somebody edited only the open date.
    """

    opens_at: datetime | None = None
    deadline_at: datetime | None = None


class ProgramCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=2, max_length=150)
    tagline: str = Field(min_length=2, max_length=300)
    description: str | None = Field(default=None, max_length=4000)
    duration: str | None = Field(default=None, max_length=60)
    mode: str | None = Field(default=None, max_length=60)
    level: str | None = Field(default=None, max_length=60)
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0, le=999)
    # Their track name for this program. Null sends no track when onboarding,
    # which leaves the student ungrouped in Agilytics rather than erroring.
    agilytics_track_name: str | None = Field(default=None, max_length=150)


class ProgramUpdate(BaseModel):
    """Partial update; the slug is immutable because the frontend maps it to
    icons and curriculum copy, and a rename would silently break that link."""

    title: str | None = Field(default=None, min_length=2, max_length=150)
    tagline: str | None = Field(default=None, min_length=2, max_length=300)
    description: str | None = Field(default=None, max_length=4000)
    duration: str | None = Field(default=None, max_length=60)
    mode: str | None = Field(default=None, max_length=60)
    level: str | None = Field(default=None, max_length=60)
    is_active: bool | None = None
    agilytics_track_name: str | None = Field(default=None, max_length=150)
    sort_order: int | None = Field(default=None, ge=0, le=999)


class ProgramAdminOut(ProgramOut):
    """Adds the operational fields a public visitor has no business seeing."""

    is_active: bool
    sort_order: int
    # Admin-only, and deliberately not on `ProgramOut`: this is the name of a
    # track inside a partner's workspace, which is an operational detail of
    # the handover and nothing a site visitor should be shown.
    agilytics_track_name: str | None = None
    bootcamp_count: int = 0
    application_count: int = 0


class BootcampCreate(BaseModel):
    bootcamp_number: int = Field(ge=1, le=99, description="Drives the candidate code: 7 -> B07")
    name: str = Field(min_length=3, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    starts_at: date | None = None
    program_ids: list[uuid.UUID] = Field(default_factory=list)


class BootcampUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    starts_at: date | None = None
    status: BootcampStatus | None = None
    # Not a column: the service replaces the bootcamp_programs rows to match.
    # Omitted leaves the offered tracks alone; an empty list clears them.
    program_ids: list[uuid.UUID] | None = None


class BootcampOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bootcamp_number: int
    name: str
    description: str | None = None
    status: BootcampStatus
    starts_at: date | None = None
    created_at: datetime


class BootcampDetail(BootcampOut):
    """Adds the pieces a detail view needs but a list view should not pay for."""

    programs: list[ProgramOut] = Field(default_factory=list)
    phases: list[PhaseOut] = Field(default_factory=list)
    application_count: int = 0


class PublicBootcampOut(BaseModel):
    """What an unauthenticated visitor may see about an open intake.

    Deliberately narrower than BootcampOut: no internal status, no counts.
    """

    id: uuid.UUID
    bootcamp_number: int
    name: str
    description: str | None = None
    starts_at: date | None = None
    registration_deadline: datetime | None = None
    programs: list[ProgramOut] = Field(default_factory=list)
