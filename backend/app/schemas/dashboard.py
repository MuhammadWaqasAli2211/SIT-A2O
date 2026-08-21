"""Aggregates for the admin dashboard.

Computed in SQL rather than by pulling rows and counting in Python: the
candidate table is the one that grows into the thousands.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import ApplicationStage, BootcampStatus, InterviewStatus


class StageCount(BaseModel):
    stage: ApplicationStage
    count: int


class ProgramCount(BaseModel):
    program_id: uuid.UUID
    title: str
    count: int


class DailyCount(BaseModel):
    day: date
    count: int


class UpcomingInterview(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    candidate_code: str
    candidate_name: str | None = None
    scheduled_at: datetime
    status: InterviewStatus
    location: str | None = None


class BootcampStats(BaseModel):
    """Everything the admin dashboard header and charts need, in one call."""

    bootcamp_id: uuid.UUID
    bootcamp_name: str
    bootcamp_number: int
    status: BootcampStatus

    total_applications: int = 0
    active_applications: int = 0
    rejected_applications: int = 0
    onboarded: int = 0

    # Interview funnel
    interviews_scheduled: int = 0
    interviews_completed: int = 0
    interviews_no_show: int = 0
    average_score: float | None = None

    applications_last_7_days: int = 0
    emails_sent: int = 0

    by_stage: list[StageCount] = Field(default_factory=list)
    by_program: list[ProgramCount] = Field(default_factory=list)
    applications_over_time: list[DailyCount] = Field(default_factory=list)
    upcoming_interviews: list[UpcomingInterview] = Field(default_factory=list)


class CityCount(BaseModel):
    city: str
    count: int


class BootcampSummary(BaseModel):
    """One intake as it appears in the super-admin overview list."""

    id: uuid.UUID
    bootcamp_number: int
    name: str
    status: BootcampStatus
    starts_at: date | None = None
    application_count: int = 0
    admin_count: int = 0
    admin_names: list[str] = Field(default_factory=list)


class PlatformStats(BaseModel):
    """Super-admin view across every intake."""

    total_bootcamps: int = 0
    active_bootcamps: int = 0
    total_candidates: int = 0
    total_admins: int = 0
    total_applications: int = 0
    total_interviews: int = 0
    emails_sent: int = 0
    by_stage: list[StageCount] = Field(default_factory=list)
    by_program: list[ProgramCount] = Field(default_factory=list)
    # Sourced from candidate_profiles.city, which is optional — candidates who
    # never filled it in are simply absent rather than bucketed as "Unknown".
    by_city: list[CityCount] = Field(default_factory=list)
    applications_over_time: list[DailyCount] = Field(default_factory=list)
    bootcamps: list[BootcampSummary] = Field(default_factory=list)
