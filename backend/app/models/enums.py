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
    """Where an application stands, in pipeline order, plus a terminal REJECTED.

    Declaration order matches the Postgres enum, so `order by stage` sorts
    candidates by how far they have progressed.

    Seven values behind five visible steps. The candidate's stepper shows

        Application -> Interview -> Physical Interview -> Form -> Onboarded

    with INTERVIEW_SCHEDULED and INTERVIEWED both rendering as the single
    "Interview" node. They stay separate here because batching depends on the
    difference: an admin has to be able to list who holds a slot but has not
    yet been seen.

    Selection is not a stage. Clearing the interview is what moves a candidate
    to PHYSICAL_INTERVIEW; the decision itself is recorded on
    `applications.is_selected`.
    """

    APPLIED = "APPLIED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    INTERVIEWED = "INTERVIEWED"
    PHYSICAL_INTERVIEW = "PHYSICAL_INTERVIEW"
    FORM = "FORM"
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
