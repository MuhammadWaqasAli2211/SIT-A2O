"""The Documents Hub: age-gated file uploads, reviewed one file at a time.

Two things differ from a plain one-row-per-type upload table: which types are
required depends on the candidate's age, and EDUCATIONAL_CERT/
EXPERIENCE_LETTER accept several concurrent files rather than replacing on
re-upload.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.age import is_adult
from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError
from app.integrations import supabase_storage
from app.models.application import Application
from app.models.enums import ApplicationStage, DocumentStatus, OnboardingDocumentType, OnboardingFormStatus
from app.models.onboarding import OnboardingDocument
from app.models.user import Profile
from app.schemas.onboarding import OnboardingCandidateSummary, RequiredOnboardingDocument
from app.services import application_service, audit_service, bootcamp_service, onboarding_form_service

# Scans and photos only. Kept narrow on purpose: an upload field that accepts
# anything is an upload field that eventually accepts an executable.
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}

EXTENSION_BY_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# The two stages an application reaches once it has entered onboarding —
# what qualifies it to appear in the admin's bootcamp-level folder list.
_ONBOARDING_LIST_STAGES = (ApplicationStage.FORM, ApplicationStage.ONBOARDED)

# Hold several concurrent files rather than one — the "+ Add / - Remove"
# tabs. Every other type supersedes on re-upload, same as the documents table.
MULTI_FILE_TYPES = frozenset(
    {OnboardingDocumentType.EDUCATIONAL_CERT, OnboardingDocumentType.EXPERIENCE_LETTER}
)

_RequiredRow = tuple[OnboardingDocumentType, str, bool, bool]


def required_documents(*, is_adult_candidate: bool) -> tuple[_RequiredRow, ...]:
    """The 7 Documents Hub tabs for this candidate's age.

    (doc_type, label, required, multi). Personal ID and the bank/wallet proof
    swap which enum value is asked for based on age; every other row is the
    same for everyone.
    """
    personal_id = (
        (OnboardingDocumentType.PERSONAL_ID_CNIC, "CNIC", True, False)
        if is_adult_candidate
        else (OnboardingDocumentType.PERSONAL_ID_BFORM, "B-Form", True, False)
    )
    money_proof = (
        (OnboardingDocumentType.BANK_PROOF, "Bank proof (cheque or statement)", True, False)
        if is_adult_candidate
        else (OnboardingDocumentType.EASYPAISA_PROOF, "Easypaisa / JazzCash proof", True, False)
    )
    return (
        personal_id,
        (OnboardingDocumentType.FATHER_CNIC, "Father's CNIC", True, False),
        (OnboardingDocumentType.MOTHER_CNIC, "Mother's CNIC", True, False),
        (OnboardingDocumentType.CV, "Updated CV", True, False),
        (OnboardingDocumentType.EDUCATIONAL_CERT, "Educational documents", True, True),
        (OnboardingDocumentType.EXPERIENCE_LETTER, "Experience letters / certificates", False, True),
        money_proof,
    )


def assert_hub_unlocked(db: Session, application: Application) -> None:
    """The Documents Hub gate: all 4 onboarding forms must be SUBMITTED."""
    rows = onboarding_form_service.rows_for_application(db, application.id)
    if not onboarding_form_service.hub_unlocked(rows):
        raise ConflictError("Complete all 4 onboarding forms before uploading documents.")


def _get(db: Session, document_id: uuid.UUID) -> OnboardingDocument:
    document = db.get(OnboardingDocument, document_id)
    if document is None:
        raise NotFoundError("Document not found.")
    return document


def assert_owner(db: Session, document: OnboardingDocument, candidate: Profile) -> Application:
    application = application_service.get_detail(db, document.application_id)
    if application.profile_id != candidate.id:
        raise NotFoundError("Document not found.")
    return application


def assert_can_review(db: Session, document: OnboardingDocument, actor: Profile) -> Application:
    application = application_service.get_detail(db, document.application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)
    return application


def get_for_candidate(db: Session, document_id: uuid.UUID, candidate: Profile) -> OnboardingDocument:
    document = _get(db, document_id)
    assert_owner(db, document, candidate)
    return document


def get_for_admin(db: Session, document_id: uuid.UUID, actor: Profile) -> tuple[OnboardingDocument, str]:
    document = _get(db, document_id)
    application = assert_can_review(db, document, actor)
    return document, application.candidate_code


def checklist(db: Session, application: Application) -> list[RequiredOnboardingDocument]:
    dob = application_service.get_date_of_birth(db, application)
    required = required_documents(is_adult_candidate=is_adult(dob))

    uploaded: dict[OnboardingDocumentType, list[OnboardingDocument]] = {}
    for doc in db.scalars(
        select(OnboardingDocument).where(OnboardingDocument.application_id == application.id)
    ):
        uploaded.setdefault(doc.doc_type, []).append(doc)

    return [
        RequiredOnboardingDocument(
            doc_type=doc_type,
            label=label,
            required=required_flag,
            multi=multi,
            documents=uploaded.get(doc_type, []),
        )
        for doc_type, label, required_flag, multi in required
    ]


def upload(
    db: Session,
    *,
    application: Application,
    doc_type: OnboardingDocumentType,
    file_name: str,
    content_type: str,
    content: bytes,
    actor: Profile,
) -> OnboardingDocument:
    assert_hub_unlocked(db, application)

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ConflictError(
            "Only PDF, JPG, PNG, and WebP files are accepted.", details=content_type
        )
    if not content:
        raise ConflictError("That file is empty.")
    if len(content) > settings.DOCUMENT_MAX_BYTES:
        limit_mb = settings.DOCUMENT_MAX_BYTES // (1024 * 1024)
        raise ConflictError(f"Files must be {limit_mb} MB or smaller.")

    superseded: str | None = None
    if doc_type not in MULTI_FILE_TYPES:
        existing = db.scalar(
            select(OnboardingDocument).where(
                OnboardingDocument.application_id == application.id,
                OnboardingDocument.doc_type == doc_type,
            )
        )
        if existing is not None and existing.status == DocumentStatus.ACCEPTED:
            raise ConflictError(
                "That document has already been accepted and cannot be replaced. "
                "Ask an administrator if it needs to change."
            )
        if existing is not None:
            superseded = existing.storage_path
            db.delete(existing)
            db.flush()

    # Distinct prefix from the existing documents table's applications/...
    # paths, in the same bucket — see supabase_storage.DOCUMENTS_BUCKET.
    path = (
        f"onboarding/{application.id}/{doc_type.value.lower()}"
        f"-{uuid.uuid4().hex}.{EXTENSION_BY_CONTENT_TYPE[content_type]}"
    )
    supabase_storage.upload(path, content, content_type)

    document = OnboardingDocument(
        application_id=application.id,
        doc_type=doc_type,
        storage_path=path,
        file_name=file_name[:255],
        content_type=content_type,
        size_bytes=len(content),
        status=DocumentStatus.PENDING,
        uploaded_by=actor.id,
    )
    db.add(document)

    audit_service.record(
        db,
        actor=actor,
        action="onboarding_document.upload",
        entity_type="onboarding_document",
        entity_id=document.id,
        summary=f"{application.candidate_code} uploaded {doc_type.value}",
        metadata={"doc_type": doc_type.value, "size_bytes": len(content), "replaced": bool(superseded)},
    )
    db.flush()

    if superseded:
        supabase_storage.delete(superseded)
    return document


def delete(db: Session, document: OnboardingDocument, actor: Profile, candidate_code: str) -> None:
    if document.status == DocumentStatus.ACCEPTED:
        raise ConflictError("An accepted document cannot be removed.")

    path = document.storage_path
    audit_service.record(
        db,
        actor=actor,
        action="onboarding_document.delete",
        entity_type="onboarding_document",
        entity_id=document.id,
        summary=f"Removed {document.doc_type.value} for {candidate_code}",
        metadata={"doc_type": document.doc_type.value, "file_name": document.file_name},
    )
    db.delete(document)
    db.flush()
    supabase_storage.delete(path)


def review(
    db: Session,
    document: OnboardingDocument,
    *,
    status: DocumentStatus,
    review_note: str | None,
    actor: Profile,
    candidate_code: str,
) -> OnboardingDocument:
    if status == DocumentStatus.REJECTED and not review_note:
        raise ConflictError("A rejection must say what is wrong with the document.")
    if document.status == status:
        raise ConflictError(f"That document is already {status.value.lower()}.")

    previous = document.status
    document.status = status
    document.review_note = review_note if status == DocumentStatus.REJECTED else None
    document.reviewed_by = actor.id
    document.reviewed_at = None if status == DocumentStatus.PENDING else datetime.now(UTC)

    audit_service.record(
        db,
        actor=actor,
        action=f"onboarding_document.{status.value.lower()}",
        entity_type="onboarding_document",
        entity_id=document.id,
        summary=f"{candidate_code}: {document.doc_type.value} {status.value.lower()}",
        metadata={"from": previous.value, "to": status.value, "note": review_note},
    )
    db.flush()
    return document


def link(document: OnboardingDocument) -> tuple[str, int]:
    ttl = settings.DOCUMENT_SIGNED_URL_TTL
    return supabase_storage.signed_url(document.storage_path, expires_in=ttl), ttl


# --------------------------------------------------------- admin overview --


def _summary_for(db: Session, application: Application, profile: Profile) -> OnboardingCandidateSummary:
    form_rows = onboarding_form_service.rows_for_application(db, application.id)
    forms_submitted = sum(
        1 for row in form_rows.values() if row.status == OnboardingFormStatus.SUBMITTED
    )
    unlocked = onboarding_form_service.hub_unlocked(form_rows)

    # A checklist assumes an age on file, and the hub is not reachable before
    # it is — asking for one here would just be extra query cost on a row the
    # admin cannot act on yet anyway.
    required_count = uploaded = approved = rejected = pending = 0
    if unlocked:
        dob = application_service.get_date_of_birth(db, application)
        required = required_documents(is_adult_candidate=is_adult(dob))
        required_count = sum(1 for _doc_type, _label, is_required, _multi in required if is_required)

        docs = list(
            db.scalars(
                select(OnboardingDocument).where(OnboardingDocument.application_id == application.id)
            )
        )
        uploaded = len(docs)
        approved = sum(1 for d in docs if d.status == DocumentStatus.ACCEPTED)
        rejected = sum(1 for d in docs if d.status == DocumentStatus.REJECTED)
        pending = sum(1 for d in docs if d.status == DocumentStatus.PENDING)

    return OnboardingCandidateSummary(
        application_id=application.id,
        candidate_code=application.candidate_code,
        full_name=profile.full_name,
        forms_submitted=forms_submitted,
        forms_total=len(onboarding_form_service.FORM_ORDER),
        documents_required=required_count,
        documents_uploaded=uploaded,
        documents_approved=approved,
        documents_rejected=rejected,
        documents_pending=pending,
        hub_unlocked=unlocked,
    )


def list_for_bootcamp(
    db: Session,
    bootcamp_id: uuid.UUID,
    *,
    search: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> tuple[list[OnboardingCandidateSummary], int]:
    """The candidate-folder list: everyone in this bootcamp who has reached
    onboarding, with a progress summary per row so an admin can scan without
    opening every folder."""
    filters = [Application.bootcamp_id == bootcamp_id, Application.stage.in_(_ONBOARDING_LIST_STAGES)]
    if search:
        needle = f"%{search.strip().lower()}%"
        filters.append(
            func.lower(Application.candidate_code).like(needle)
            | func.lower(Profile.full_name).like(needle)
        )

    base = (
        select(Application, Profile)
        .join(Profile, Profile.id == Application.profile_id)
        .where(*filters)
    )
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.execute(base.order_by(Application.candidate_code).limit(limit).offset(offset)).all()

    return [_summary_for(db, application, profile) for application, profile in rows], total
