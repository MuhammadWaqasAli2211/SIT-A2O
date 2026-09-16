"""Student's Folder: the Onboarding Form sub-section and the Documents Hub.

Candidate routes are scoped to their own application via
application_service.get_own, the same guard every other candidate-facing
route in this file group uses. Admin routes resolve scope from the
application/submission/document itself — never from a bootcamp_id the
caller could otherwise choose freely.
"""

import uuid

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.api.deps import AdminUser, CandidateUser, DbSession
from app.models.enums import OnboardingDocumentType, OnboardingFormType
from app.schemas.onboarding_prefill import OnboardingPrefill
from app.schemas.onboarding import (
    OnboardingCandidateSummary,
    OnboardingDocumentLink,
    OnboardingDocumentOut,
    OnboardingDocumentReview,
    OnboardingFormReopen,
    OnboardingFormRow,
    OnboardingFormSubmissionOut,
    OnboardingFormSubmit,
    OnboardingProgress,
    RequiredOnboardingDocument,
)
from app.schemas.ops import Page
from app.services import (
    id_card_service,
    application_service,
    bootcamp_service,
    onboarding_document_service,
    onboarding_form_service,
)

router = APIRouter(tags=["onboarding"])


# ------------------------------------------------------------- candidate --


@router.get(
    "/applications/{application_id}/onboarding/forms",
    response_model=list[OnboardingFormRow],
    tags=["candidate"],
)
def my_onboarding_forms(
    application_id: uuid.UUID, user: CandidateUser, db: DbSession
) -> list[OnboardingFormRow]:
    application = application_service.get_own(db, user, application_id)
    return onboarding_form_service.list_rows(db, application)


@router.get(
    "/applications/{application_id}/onboarding/progress",
    response_model=OnboardingProgress,
    tags=["candidate"],
)
def my_onboarding_progress(
    application_id: uuid.UUID, user: CandidateUser, db: DbSession
) -> OnboardingProgress:
    application = application_service.get_own(db, user, application_id)
    progress = onboarding_form_service.progress(db, application)
    # Resolved here rather than inside the form service: whether a card is
    # offered has nothing to do with form progress, and the admin-facing
    # caller of `progress` has no candidate to answer the question for.
    return progress.model_copy(
        update={"id_card_available": id_card_service.availability(db, application)}
    )


@router.get(
    "/applications/{application_id}/onboarding/prefill",
    response_model=OnboardingPrefill,
    tags=["candidate"],
)
def my_onboarding_prefill(
    application_id: uuid.UUID, user: CandidateUser, db: DbSession
) -> OnboardingPrefill:
    """Values already on file, so the forms do not ask for them again.

    Defaults only — the candidate can change any of them. Fetched separately
    from the form itself so a form still opens if this call fails.
    """
    application = application_service.get_own(db, user, application_id)
    return onboarding_form_service.prefill(db, application)


@router.post(
    "/applications/{application_id}/onboarding/forms/{form_type}",
    response_model=OnboardingFormSubmissionOut,
    status_code=status.HTTP_201_CREATED,
    tags=["candidate"],
)
def submit_onboarding_form(
    application_id: uuid.UUID,
    form_type: OnboardingFormType,
    payload: OnboardingFormSubmit,
    user: CandidateUser,
    db: DbSession,
) -> OnboardingFormSubmissionOut:
    application = application_service.get_own(db, user, application_id)
    submission = onboarding_form_service.submit(
        db,
        application=application,
        form_type=form_type,
        submitted_data=payload.submitted_data,
        actor=user,
    )
    return OnboardingFormSubmissionOut.model_validate(submission)


@router.get(
    "/applications/{application_id}/onboarding/documents",
    response_model=list[RequiredOnboardingDocument],
    tags=["candidate"],
)
def my_onboarding_documents(
    application_id: uuid.UUID, user: CandidateUser, db: DbSession
) -> list[RequiredOnboardingDocument]:
    application = application_service.get_own(db, user, application_id)
    onboarding_document_service.assert_hub_unlocked(db, application)
    return onboarding_document_service.checklist(db, application)


@router.post(
    "/applications/{application_id}/onboarding/documents",
    response_model=OnboardingDocumentOut,
    status_code=status.HTTP_201_CREATED,
    tags=["candidate"],
)
async def upload_onboarding_document(
    application_id: uuid.UUID,
    user: CandidateUser,
    db: DbSession,
    doc_type: OnboardingDocumentType = Form(...),
    file: UploadFile = File(...),
) -> OnboardingDocumentOut:
    application = application_service.get_own(db, user, application_id)
    content = await file.read()

    document = onboarding_document_service.upload(
        db,
        application=application,
        doc_type=doc_type,
        file_name=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        content=content,
        actor=user,
    )
    return OnboardingDocumentOut.model_validate(document)


@router.delete(
    "/onboarding/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["candidate"],
)
def delete_onboarding_document(document_id: uuid.UUID, user: CandidateUser, db: DbSession) -> None:
    document = onboarding_document_service.get_for_candidate(db, document_id, user)
    application = application_service.get_detail(db, document.application_id)
    onboarding_document_service.delete(db, document, user, application.candidate_code)


@router.get("/onboarding/documents/{document_id}/link", response_model=OnboardingDocumentLink)
def onboarding_document_link(
    document_id: uuid.UUID, user: CandidateUser, db: DbSession
) -> OnboardingDocumentLink:
    document = onboarding_document_service.get_for_candidate(db, document_id, user)
    url, ttl = onboarding_document_service.link(document)
    return OnboardingDocumentLink(url=url, expires_in=ttl)


# ----------------------------------------------------------------- admin --


@router.get(
    "/bootcamps/{bootcamp_id}/onboarding/candidates",
    response_model=Page[OnboardingCandidateSummary],
)
def list_onboarding_candidates(
    bootcamp_id: uuid.UUID,
    user: AdminUser,
    db: DbSession,
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[OnboardingCandidateSummary]:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    items, total = onboarding_document_service.list_for_bootcamp(
        db, bootcamp_id, search=search, limit=limit, offset=offset
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/admin/applications/{application_id}/onboarding/forms",
    response_model=list[OnboardingFormRow],
)
def admin_onboarding_forms(
    application_id: uuid.UUID, user: AdminUser, db: DbSession
) -> list[OnboardingFormRow]:
    application = application_service.get_detail(db, application_id)
    bootcamp_service.assert_can_manage(db, user, application.bootcamp_id)
    return onboarding_form_service.list_rows(db, application)


@router.post(
    "/onboarding/forms/{submission_id}/reopen",
    response_model=OnboardingFormSubmissionOut,
)
def reopen_onboarding_form(
    submission_id: uuid.UUID, payload: OnboardingFormReopen, user: AdminUser, db: DbSession
) -> OnboardingFormSubmissionOut:
    """Send a submitted form back for correction. Everything after it in the
    fixed sequence re-locks until it is resubmitted."""
    submission, application = onboarding_form_service.get_for_admin(db, submission_id, user)
    return OnboardingFormSubmissionOut.model_validate(
        onboarding_form_service.reopen(db, submission, application, note=payload.note, actor=user)
    )


@router.get(
    "/admin/applications/{application_id}/onboarding/documents",
    response_model=list[RequiredOnboardingDocument],
)
def admin_onboarding_documents(
    application_id: uuid.UUID, user: AdminUser, db: DbSession
) -> list[RequiredOnboardingDocument]:
    application = application_service.get_detail(db, application_id)
    bootcamp_service.assert_can_manage(db, user, application.bootcamp_id)
    return onboarding_document_service.checklist(db, application)


@router.get("/admin/onboarding/documents/{document_id}/link", response_model=OnboardingDocumentLink)
def admin_onboarding_document_link(
    document_id: uuid.UUID, user: AdminUser, db: DbSession
) -> OnboardingDocumentLink:
    document, _candidate_code = onboarding_document_service.get_for_admin(db, document_id, user)
    url, ttl = onboarding_document_service.link(document)
    return OnboardingDocumentLink(url=url, expires_in=ttl)


@router.post("/onboarding/documents/{document_id}/review", response_model=OnboardingDocumentOut)
def review_onboarding_document(
    document_id: uuid.UUID, payload: OnboardingDocumentReview, user: AdminUser, db: DbSession
) -> OnboardingDocumentOut:
    document, candidate_code = onboarding_document_service.get_for_admin(db, document_id, user)
    return OnboardingDocumentOut.model_validate(
        onboarding_document_service.review(
            db,
            document,
            status=payload.status,
            review_note=payload.review_note,
            actor=user,
            candidate_code=candidate_code,
        )
    )
