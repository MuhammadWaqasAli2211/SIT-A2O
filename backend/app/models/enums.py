"""Shared enumerations.

Values must match the Postgres enum types in supabase/migrations exactly, and
`ApplicationStage` additionally mirrors the frontend's `ApplicationStage` in
`frontend/src/lib/mock-data.ts`. All three must change together.
"""

from enum import StrEnum


class UserRole(StrEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    CANDIDATE = "CANDIDATE"


class BootcampStatus(StrEnum):
    DRAFT = "DRAFT"
    REG_OPEN = "REG_OPEN"
    REG_CLOSED = "REG_CLOSED"
    INTERVIEWING = "INTERVIEWING"
    ASSESSING = "ASSESSING"
    ONBOARDING = "ONBOARDING"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"


class PhaseType(StrEnum):
    REGISTRATION = "REGISTRATION"
    INTERVIEW = "INTERVIEW"
    FORM = "FORM"
    ONBOARDING = "ONBOARDING"


class ApplicationStage(StrEnum):
    APPLIED = "APPLIED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    INTERVIEWED = "INTERVIEWED"
    ASSESSMENT = "ASSESSMENT"
    FORM_PENDING = "FORM_PENDING"
    ONBOARDED = "ONBOARDED"
    REJECTED = "REJECTED"


class ApplicationStatus(StrEnum):
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class InterviewMode(StrEnum):
    ONLINE = "ONLINE"
    ONSITE = "ONSITE"


class InterviewStatus(StrEnum):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class EmailStatus(StrEnum):
    SENT = "SENT"
    FAILED = "FAILED"


class DocumentType(StrEnum):
    CNIC_FRONT = "CNIC_FRONT"
    CNIC_BACK = "CNIC_BACK"
    PHOTO = "PHOTO"
    QUALIFICATION = "QUALIFICATION"
    BANK_LETTER = "BANK_LETTER"
    OTHER = "OTHER"


class DocumentStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
