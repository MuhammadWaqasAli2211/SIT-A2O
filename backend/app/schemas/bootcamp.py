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


class PhaseUpdate(BaseModel):
    opens_at: datetime | None = None
    deadline_at: datetime | None = None


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
