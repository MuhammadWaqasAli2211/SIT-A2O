"""Onboarding Form submission and Documents Hub upload/review schemas."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    DocumentStatus,
    OnboardingDocumentType,
    OnboardingFormStatus,
    OnboardingFormType,
)

# ------------------------------------------------------------------ forms --


class OnboardingFormSubmit(BaseModel):
    """The answers for one form. Shape is form_type-specific and validated in
    the service layer, which is the only place that also knows the
    candidate's age — not reachable from a plain schema validator."""

    submitted_data: dict[str, Any]


class OnboardingFormSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    form_type: OnboardingFormType
    submitted_data: dict[str, Any]
    status: OnboardingFormStatus
    submitted_at: datetime
    reopened_at: datetime | None = None
    reopen_note: str | None = None


class OnboardingFormRow(BaseModel):
    """One row of the candidate's 4-item checklist: what it is, whether it
    has been submitted, and whether it is reachable yet."""

    form_type: OnboardingFormType
    submission: OnboardingFormSubmissionOut | None = None
    unlocked: bool


class OnboardingFormReopen(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


# -------------------------------------------------------------- documents --


class OnboardingDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    doc_type: OnboardingDocumentType
    file_name: str
    content_type: str
    size_bytes: int
    status: DocumentStatus
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class OnboardingDocumentReview(BaseModel):
    status: DocumentStatus
    review_note: str | None = Field(default=None, max_length=500)


class OnboardingDocumentLink(BaseModel):
    url: str
    expires_in: int


class RequiredOnboardingDocument(BaseModel):
    """One tab of the Documents Hub: what is asked for, and everything
    uploaded against it so far. A list rather than one optional document,
    since EDUCATIONAL_CERT and EXPERIENCE_LETTER can hold several."""

    doc_type: OnboardingDocumentType
    label: str
    required: bool
    multi: bool
    documents: list[OnboardingDocumentOut] = Field(default_factory=list)


# -------------------------------------------------------------- progress --


class OnboardingProgress(BaseModel):
    """What the candidate (and admin) sees as the top-level state: how far
    through the 4 forms they are, and whether the Documents Hub is open."""

    forms_submitted: int
    forms_total: int
    hub_unlocked: bool

    # Whether to offer this candidate their ID card. Two conditions, both
    # resolved server-side: the admin has issued cards for the intake, and
    # this candidate was selected at the physical interview. Defaulted so the
    # admin-facing caller, which has no candidate to answer for, need not
    # pass it.
    id_card_available: bool = False


class OnboardingCandidateSummary(BaseModel):
    """One row of the admin's bootcamp-level candidate-folder list."""

    application_id: uuid.UUID
    candidate_code: str
    full_name: str | None = None
    forms_submitted: int
    forms_total: int
    documents_required: int
    """Required document tabs for this candidate's age — the denominator."""
    documents_slots_filled: int
    """How many of those tabs hold at least one file. Never exceeds
    `documents_required`, which is what makes it safe to show as a ratio."""
    documents_uploaded: int
    """Total files across every tab, required or not. Can legitimately exceed
    `documents_required` — multi-file tabs and the optional experience-letter
    tab both add to it — so it is shown as a count, never as a fraction."""
    documents_approved: int
    documents_rejected: int
    documents_pending: int
    hub_unlocked: bool
