import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.core.age import is_adult
from app.models.enums import ApplicationStage, ApplicationStatus
from app.schemas.bootcamp import PhaseOut, ProgramOut


# Mirrors the choices offered by the registration form. Literal rather than
# free str so an unknown value is a 422 at the boundary rather than a row that
# violates a CHECK constraint three layers in.
Gender = Literal["Male", "Female"]
CourseStatus = Literal["Completed", "In Progress"]
Proficiency = Literal["Beginner", "Intermediate", "Advanced"]
Semester = Literal["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "Other"]
ClassTiming = Literal["Morning", "Evening", "Weekend"]

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

    # The applicant's own identity number, always required. Which document it
    # is depends on age: a CNIC at 18 and over, a B-Form below that. Both are
    # 13 digits, so one pattern covers them and `date_of_birth` decides which
    # it is — see the validator below.
    cnic: str = Field(pattern=CNIC_PATTERN)
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

    is_university_student: bool
    university_semester: Semester | None = None
    university_name: str | None = Field(default=None, max_length=150)
    university_timing: ClassTiming | None = None

    # Which wording was accepted. Sent by the client and re-checked against
    # the server's current version, so a stale tab cannot record consent to
    # text it never showed.
    terms_version: str = Field(max_length=20)

    @model_validator(mode="after")
    def _university_details_complete(self) -> "ApplicationCreate":
        """All three university fields, or none.

        Mirrors the CHECK constraint on `applications`. Catching it here turns
        a 500 from the database into a 422 naming the missing field.
        """
        if not self.is_university_student:
            # Ignore anything sent alongside a "no" rather than rejecting it —
            # a user who answers yes, fills the fields, then switches to no
            # should not have to clear them by hand.
            self.university_semester = None
            self.university_name = None
            self.university_timing = None
            return self

        missing = [
            name
            for name, value in (
                ("university_semester", self.university_semester),
                ("university_name", self.university_name),
                ("university_timing", self.university_timing),
            )
            if not value
        ]
        if missing:
            raise ValueError(
                "University students must provide " + ", ".join(missing)
            )
        return self

    @property
    def id_document_type(self) -> str:
        """Which document `cnic` holds, derived from age at submission.

        Derived rather than sent: a client-supplied answer could disagree with
        the date of birth beside it, and the date is the one we can check.
        """
        return "CNIC" if is_adult(self.date_of_birth) else "B_FORM"


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
    # cannot express while a candidate is still sitting at AI_INTERVIEWED.
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
    # Not contact detail — just whether one exists. The AI interview invite
    # picker needs to grey out a candidate with none rather than let an admin
    # select them and have the whole batch refused for it.
    has_cnic: bool = False
    # Same reasoning: InterviewerAI currently refuses to invite anyone who
    # has not finished their prior course — verified against a live
    # rejection, 2026-08-27 ("'Ongoing' is currently disabled").
    course_completed: bool = False


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
