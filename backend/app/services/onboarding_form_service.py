"""The Onboarding Form sub-section: 4 items, filled in a fixed order.

Ownership and admin-scope checks mirror document_service's split — a
candidate reaches only their own application's rows, an admin only one they
manage — resolved from the submission's application, never inferred from the
request.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.age import is_adult
from app.core.exceptions import ConflictError, NotFoundError
from app.models.application import Application
from app.models.enums import ApplicationStage, OnboardingFormStatus, OnboardingFormType
from app.models.onboarding import OnboardingFormSubmission
from app.models.user import Profile
from app.schemas.onboarding import OnboardingFormRow, OnboardingProgress
from app.services import application_service, audit_service, bootcamp_service

# The fixed sequence. A candidate must complete each before the next unlocks.
FORM_ORDER: tuple[OnboardingFormType, ...] = (
    OnboardingFormType.BACKGROUND_VERIFICATION,
    OnboardingFormType.EMPLOYMENT_APPLICATION,
    OnboardingFormType.HALF_NAMA,
    OnboardingFormType.BANK_PAYMENT_DETAILS,
)

# The two stages that mean "cleared Physical Interview" — the gate for the
# whole Student's Folder tab, not just this sub-section.
_ONBOARDING_STAGES = (ApplicationStage.FORM, ApplicationStage.ONBOARDED)

_ADULT_BANK_FIELDS = ("bank_name", "account_title", "iban")
_MINOR_WALLET_FIELDS = ("wallet_provider", "wallet_number")


def assert_onboarding_unlocked(application: Application) -> None:
    """The Student's Folder gate: locked until Physical Interview is cleared.

    Enforced here too, not just by hiding the sidebar row — the same
    reasoning as RequiresApplication on the frontend: a locked tab is not a
    permissions boundary on its own.
    """
    if application.stage not in _ONBOARDING_STAGES:
        raise ConflictError("Onboarding is not open yet for this application.")


def validate_bank_payment_data(data: dict, *, is_adult: bool) -> None:
    """Age decides which fields are mandatory — see is_adult in app.core.age.

    A minor supplies a mobile wallet instead of bank details entirely, not in
    addition to them, so the two field sets are exclusive rather than layered.
    """
    required = _ADULT_BANK_FIELDS if is_adult else _MINOR_WALLET_FIELDS
    missing = [field for field in required if not str(data.get(field, "")).strip()]
    if missing:
        raise ConflictError(f"Missing required field(s): {', '.join(missing)}.")


def assert_in_order(form_type: OnboardingFormType, rows: dict) -> None:
    """Every form before `form_type` must already be SUBMITTED.

    A REOPENED predecessor blocks this too — that is precisely what re-locks
    the downstream forms when an admin sends an earlier one back.
    """
    for earlier in FORM_ORDER:
        if earlier == form_type:
            return
        row = rows.get(earlier)
        if row is None or row.status != OnboardingFormStatus.SUBMITTED:
            raise ConflictError(f"Submit {earlier.value.replace('_', ' ').title()} first.")


def unlocked_map(rows: dict) -> dict[OnboardingFormType, bool]:
    """Which of the 4 forms the candidate may currently open.

    A form stays unlocked while every predecessor is SUBMITTED. The moment
    one predecessor is missing or REOPENED, it and everything after it locks
    — this is the whole "reopening re-locks what follows" behaviour, derived
    rather than stored.
    """
    unlocked: dict[OnboardingFormType, bool] = {}
    blocked = False
    for form_type in FORM_ORDER:
        unlocked[form_type] = not blocked
        row = rows.get(form_type)
        if row is None or row.status != OnboardingFormStatus.SUBMITTED:
            blocked = True
    return unlocked


def hub_unlocked(rows: dict) -> bool:
    """The Documents Hub opens only once all 4 forms are SUBMITTED — a form
    sent back for correction closes it again until resubmitted."""
    return all(
        (row := rows.get(form_type)) is not None and row.status == OnboardingFormStatus.SUBMITTED
        for form_type in FORM_ORDER
    )


def rows_for_application(db: Session, application_id: uuid.UUID) -> dict:
    """All of one application's form rows, keyed by form_type.

    Public: onboarding_document_service also needs this, to know whether the
    Documents Hub is unlocked yet.
    """
    rows = db.scalars(
        select(OnboardingFormSubmission).where(
            OnboardingFormSubmission.application_id == application_id
        )
    )
    return {row.form_type: row for row in rows}


def _get(db: Session, submission_id: uuid.UUID) -> OnboardingFormSubmission:
    submission = db.get(OnboardingFormSubmission, submission_id)
    if submission is None:
        raise NotFoundError("Onboarding form submission not found.")
    return submission


def list_rows(db: Session, application: Application) -> list[OnboardingFormRow]:
    rows = rows_for_application(db, application.id)
    unlocked = unlocked_map(rows)
    return [
        OnboardingFormRow(
            form_type=form_type,
            submission=rows[form_type] if form_type in rows else None,
            unlocked=unlocked[form_type],
        )
        for form_type in FORM_ORDER
    ]


def progress(db: Session, application: Application) -> OnboardingProgress:
    rows = rows_for_application(db, application.id)
    submitted = sum(1 for row in rows.values() if row.status == OnboardingFormStatus.SUBMITTED)
    return OnboardingProgress(
        forms_submitted=submitted, forms_total=len(FORM_ORDER), hub_unlocked=hub_unlocked(rows)
    )


def submit(
    db: Session,
    *,
    application: Application,
    form_type: OnboardingFormType,
    submitted_data: dict,
    actor: Profile,
) -> OnboardingFormSubmission:
    assert_onboarding_unlocked(application)

    rows = rows_for_application(db, application.id)
    assert_in_order(form_type, rows)

    existing = rows.get(form_type)
    if existing is not None and existing.status == OnboardingFormStatus.SUBMITTED:
        raise ConflictError(
            "This form has already been submitted. "
            "Ask an administrator to reopen it if it needs a correction."
        )

    if form_type == OnboardingFormType.BANK_PAYMENT_DETAILS:
        dob = application_service.get_date_of_birth(db, application)
        validate_bank_payment_data(submitted_data, is_adult=is_adult(dob))

    if existing is None:
        existing = OnboardingFormSubmission(application_id=application.id, form_type=form_type)
        db.add(existing)

    existing.submitted_data = submitted_data
    existing.status = OnboardingFormStatus.SUBMITTED
    existing.submitted_at = datetime.now(UTC)
    existing.submitted_by = actor.id

    audit_service.record(
        db,
        actor=actor,
        action="onboarding_form.submit",
        entity_type="onboarding_form_submission",
        entity_id=existing.id,
        summary=f"{application.candidate_code}: submitted {form_type.value}",
        metadata={"form_type": form_type.value},
    )
    db.flush()
    return existing


def assert_can_review(db: Session, submission: OnboardingFormSubmission, actor: Profile) -> Application:
    application = application_service.get_detail(db, submission.application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)
    return application


def get_for_admin(
    db: Session, submission_id: uuid.UUID, actor: Profile
) -> tuple[OnboardingFormSubmission, Application]:
    submission = _get(db, submission_id)
    application = assert_can_review(db, submission, actor)
    return submission, application


def reopen(
    db: Session,
    submission: OnboardingFormSubmission,
    application: Application,
    *,
    note: str | None,
    actor: Profile,
) -> OnboardingFormSubmission:
    """Send a submitted form back for correction.

    Nothing about the submitted_data changes — the candidate edits from what
    is already there. Everything after this one in FORM_ORDER re-locks the
    moment `status` flips, via unlocked_map/hub_unlocked reading it fresh.
    """
    if submission.status == OnboardingFormStatus.REOPENED:
        raise ConflictError("This form is already reopened for correction.")

    submission.status = OnboardingFormStatus.REOPENED
    submission.reopened_at = datetime.now(UTC)
    submission.reopened_by = actor.id
    submission.reopen_note = note

    audit_service.record(
        db,
        actor=actor,
        action="onboarding_form.reopen",
        entity_type="onboarding_form_submission",
        entity_id=submission.id,
        summary=f"{application.candidate_code}: reopened {submission.form_type.value} for correction",
        metadata={"form_type": submission.form_type.value, "note": note},
    )
    db.flush()
    return submission
