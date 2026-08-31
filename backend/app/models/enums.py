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

    with INTERVIEW_SCHEDULED and AI_INTERVIEWED both rendering as the single
    "Interview" node. They stay separate here because batching depends on the
    difference: an admin has to be able to list who holds a slot but has not
    yet been seen.

    Selection is not a stage. Clearing the interview is what moves a candidate
    to PHYSICAL_INTERVIEW; the decision itself is recorded on
    `applications.is_selected`.

    AI_INTERVIEWED's *value* is "AI-INTERVIEWED" — deliberately not equal to
    its member name, since a Postgres enum label may contain a hyphen but a
    Python identifier cannot. `app/models/application.py`'s `_STAGE_ENUM`
    binds by value (`values_callable`) specifically so this one member does
    not silently fall back to matching by name against the database.
    """

    APPLIED = "APPLIED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    AI_INTERVIEWED = "AI-INTERVIEWED"
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


class InviteBatchStatus(StrEnum):
    PENDING = "PENDING"
    SENDING = "SENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class InviteStatus(StrEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class AiScope(StrEnum):
    """Write scopes on the AI Interviewer API key that a super admin may
    delegate to an individual admin.

    Only writes appear here. Every ADMIN may read from that API by default
    (bootcamp-scoped, like all admin reads), so read scopes are not grantable
    and storing them would imply a restriction that does not exist.

    Labels are our own; `external` is the spelling their API uses.
    """

    CANDIDATES_WRITE = "CANDIDATES_WRITE"
    INTERVIEWS_DELETE = "INTERVIEWS_DELETE"
    INVITES_SEND = "INVITES_SEND"
    REINTERVIEW_DECIDE = "REINTERVIEW_DECIDE"

    @property
    def external(self) -> str:
        """The scope string as the AI Interviewer API names it."""
        return _AI_SCOPE_EXTERNAL[self]

    @property
    def label(self) -> str:
        """Wording for a permission-assignment screen."""
        return _AI_SCOPE_LABEL[self]


_AI_SCOPE_EXTERNAL: dict[AiScope, str] = {
    AiScope.CANDIDATES_WRITE: "candidates:write",
    AiScope.INTERVIEWS_DELETE: "interviews:delete",
    AiScope.INVITES_SEND: "invites:send",
    AiScope.REINTERVIEW_DECIDE: "reinterview:decide",
}

_AI_SCOPE_LABEL: dict[AiScope, str] = {
    AiScope.CANDIDATES_WRITE: "Edit candidate records",
    AiScope.INTERVIEWS_DELETE: "Delete AI interviews",
    AiScope.INVITES_SEND: "Send AI interview invites",
    AiScope.REINTERVIEW_DECIDE: "Decide reinterview requests",
}
