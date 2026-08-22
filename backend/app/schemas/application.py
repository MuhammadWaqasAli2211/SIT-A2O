import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import ApplicationStage, ApplicationStatus
from app.schemas.bootcamp import PhaseOut, ProgramOut


# Mirrors the choices offered by the registration form. Literal rather than
# free str so an unknown value is a 422 at the boundary rather than a row that
# violates a CHECK constraint three layers in.
Gender = Literal["Male", "Female"]
CourseStatus = Literal["Completed", "In Progress"]
Proficiency = Literal["Beginner", "Intermediate", "Advanced"]

CNIC_PATTERN = r"^\d{5}-?\d{7}-?\d$"
PK_PHONE_PATTERN = r"^(\+92|0)?3\d{2}[\s-]?\d{7}$"


class ApplicationCreate(BaseModel):
    """The registration form, as submitted.

    One payload covering both destinations: person-level answers are written
    to candidate_profiles, intake-specific ones to applications. Splitting it
    into two requests would let half a registration succeed.
    """

    bootcamp_id: uuid.UUID
    program_id: uuid.UUID
    statement: str | None = Field(default=None, max_length=2000)

    # --- person-level -> candidate_profiles ---
    full_name: str = Field(min_length=2, max_length=100)
    father_name: str = Field(min_length=2, max_length=100)
    gender: Gender
    date_of_birth: date
    city: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(pattern=PK_PHONE_PATTERN)
    father_phone: str = Field(pattern=PK_PHONE_PATTERN)

    # Optional: candidates under 18 may not hold a CNIC yet.
    cnic: str | None = Field(default=None, pattern=CNIC_PATTERN)
    # Required: a guardian always has one.
    father_cnic: str = Field(pattern=CNIC_PATTERN)

    address: str = Field(min_length=10, max_length=220)
    saylani_roll_number: str = Field(pattern=r"^\d+$", max_length=30)

    # --- intake-specific -> applications ---
    prior_course: str = Field(min_length=2, max_length=120)
    prior_course_status: CourseStatus
    campus: str = Field(min_length=2, max_length=120)
    computer_proficiency: Proficiency
    last_qualification: str = Field(min_length=2, max_length=40)
    referral_source: str = Field(min_length=2, max_length=40)
    has_laptop: bool

    # Which wording was accepted. Sent by the client and re-checked against
    # the server's current version, so a stale tab cannot record consent to
    # text it never showed.
    terms_version: str = Field(max_length=20)

    @field_validator("cnic")
    @classmethod
    def _blank_cnic_is_none(cls, v: str | None) -> str | None:
        # The form submits '' for "I do not have one"; the column is nullable
        # and unique, so '' would collide on the second such applicant.
        return v or None


class StageTransitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_stage: ApplicationStage | None = None
    to_stage: ApplicationStage
    reason: str | None = None
    created_at: datetime


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_code: str
    bootcamp_id: uuid.UUID
    program_id: uuid.UUID
    stage: ApplicationStage
    status: ApplicationStatus

    # None until the interview has been decided. The tracker uses it to tell
    # "waiting on a result" apart from "cleared it", which the stage alone
    # cannot express while a candidate is still sitting at INTERVIEWED.
    is_selected: bool | None = None

    statement: str | None = None
    applied_at: datetime


class RegistrationResult(BaseModel):
    """What the success modal needs, and nothing more.

    Deliberately narrow rather than returning the whole application: the modal
    shows a code and a confirmation, and every extra field here is one more
    thing to keep in step with the form.
    """

    application_id: uuid.UUID
    candidate_code: str
    bootcamp_name: str
    program_title: str
    email: EmailStr
    """Where the confirmation was sent, so the modal can say so."""


class ApplicationDetail(ApplicationOut):
    program: ProgramOut
    bootcamp_name: str
    timeline: list[StageTransitionOut] = Field(default_factory=list)

    # The applicant's own deadlines. Carried here rather than behind a separate
    # candidate endpoint because the tracker needs them on every render and
    # they cost no extra query — the bootcamp is already loaded.
    #
    # Safe to expose: PhaseOut is windows and an open flag, nothing about other
    # applicants or the intake's internal status.
    phases: list[PhaseOut] = Field(default_factory=list)


class ApplicantRow(BaseModel):
    """One row of an admin's candidate list.

    Flattened from the joined profile so the admin table does not need a
    nested shape, and carries no contact detail beyond what the list displays.
    """

    id: uuid.UUID
    candidate_code: str
    full_name: str | None = None
    email: EmailStr
    program_title: str
    stage: ApplicationStage
    status: ApplicationStatus
    applied_at: datetime


class ApplicantPage(BaseModel):
    items: list[ApplicantRow]
    total: int
    limit: int
    offset: int


class StageAdvance(BaseModel):
    to_stage: ApplicationStage
    reason: str | None = Field(default=None, max_length=500)


class ApplicationEdit(BaseModel):
    """Admin correction of an application's own fields.

    Stage and status are absent deliberately: they move through
    advance_stage/reinstate so every change leaves a StageTransition behind.
    """

    program_id: uuid.UUID | None = None
    statement: str | None = Field(default=None, max_length=2000)


class AdminApplicationDetail(ApplicationDetail):
    """The full record for an administrator.

    Kept separate from ApplicationDetail rather than adding optional fields to
    it: the candidate-facing route returns that shape, and personal contact
    data must not be one forgotten `exclude` away from leaking into it.
    """

    full_name: str | None = None
    email: EmailStr
    phone: str | None = None
    city: str | None = None
    education: str | None = None
    date_of_birth: date | None = None
    bootcamp_number: int
    interview_count: int = 0
