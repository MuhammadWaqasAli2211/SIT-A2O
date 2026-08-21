"""Candidate document uploads and admin review.

Ownership is checked on every path: a candidate may only touch documents
belonging to their own application, an admin only those inside a bootcamp they
manage. Neither is inferred from the request — both are resolved from the
document's application.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, aliased

from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError
from app.integrations import supabase_storage
from app.models.application import Application
from app.models.document import Document
from app.models.enums import DocumentStatus, DocumentType
from app.models.user import Profile
from app.schemas.document import DocumentReview, DocumentRow, RequiredDocument
from app.services import application_service, audit_service, bootcamp_service

# What onboarding asks for, and whether it blocks completion. Data rather than
# a table: the set is the same for every intake today, and turning it into
# reference data before anyone needs per-bootcamp variation would be guessing.
REQUIRED_DOCUMENTS: tuple[tuple[DocumentType, str, bool], ...] = (
    (DocumentType.CNIC_FRONT, "CNIC — front", True),
    (DocumentType.CNIC_BACK, "CNIC — back", True),
    (DocumentType.PHOTO, "Passport photograph", True),
    (DocumentType.QUALIFICATION, "Highest qualification certificate", True),
    (DocumentType.BANK_LETTER, "Bank letter or cheque copy", False),
)

# Scans and photos only. Kept narrow on purpose: an upload field that accepts
# anything is an upload field that eventually accepts an executable.
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}

_EXTENSION = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def _get(db: Session, document_id: uuid.UUID) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise NotFoundError("Document not found.")
    return document


def assert_owner(db: Session, document: Document, candidate: Profile) -> Application:
    """A candidate may only reach documents on their own application."""
    application = application_service.get_detail(db, document.application_id)
    if application.profile_id != candidate.id:
        # 404 not 403, matching get_own(): confirming it exists would leak
        # that somebody else holds this document id.
        raise NotFoundError("Document not found.")
    return application


def assert_can_review(db: Session, document: Document, actor: Profile) -> Application:
    application = application_service.get_detail(db, document.application_id)
    bootcamp_service.assert_can_manage(db, actor, application.bootcamp_id)
    return application


# ---------------------------------------------------------------- upload --


def upload(
    db: Session,
    *,
    application: Application,
    doc_type: DocumentType,
    file_name: str,
    content_type: str,
    content: bytes,
    actor: Profile,
) -> Document:
    """Store a file and index it, replacing any previous upload of that type.

    Validation happens before the object is written, so a rejected file never
    reaches storage and cannot be orphaned there.
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ConflictError(
            "Only PDF, JPG, PNG, and WebP files are accepted.", details=content_type
        )
    if not content:
        raise ConflictError("That file is empty.")
    if len(content) > settings.DOCUMENT_MAX_BYTES:
        limit_mb = settings.DOCUMENT_MAX_BYTES // (1024 * 1024)
        raise ConflictError(f"Files must be {limit_mb} MB or smaller.")

    existing = db.scalar(
        select(Document).where(
            Document.application_id == application.id, Document.doc_type == doc_type
        )
    )
    if existing is not None and existing.status == DocumentStatus.ACCEPTED:
        raise ConflictError(
            "That document has already been accepted and cannot be replaced. "
            "Ask an administrator if it needs to change."
        )

    # A fresh path per upload rather than reusing the old one: the previous
    # object is deleted only after the new row commits, so a failed upload
    # cannot destroy the file it was meant to replace.
    path = (
        f"applications/{application.id}/{doc_type.value.lower()}"
        f"-{uuid.uuid4().hex}.{_EXTENSION[content_type]}"
    )
    supabase_storage.upload(path, content, content_type)

    superseded = existing.storage_path if existing else None
    if existing is not None:
        db.delete(existing)
        db.flush()

    document = Document(
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
        action="document.upload",
        entity_type="document",
        entity_id=document.id,
        summary=f"{application.candidate_code} uploaded {doc_type.value}",
        metadata={"doc_type": doc_type.value, "size_bytes": len(content), "replaced": bool(existing)},
    )
    db.flush()

    if superseded:
        supabase_storage.delete(superseded)
    return document


def delete(db: Session, document: Document, actor: Profile, candidate_code: str) -> None:
    """Remove an upload. Accepted documents are kept — see the guard below."""
    if document.status == DocumentStatus.ACCEPTED:
        raise ConflictError("An accepted document cannot be removed.")

    path = document.storage_path
    audit_service.record(
        db,
        actor=actor,
        action="document.delete",
        entity_type="document",
        entity_id=document.id,
        summary=f"Removed {document.doc_type.value} for {candidate_code}",
        metadata={"doc_type": document.doc_type.value, "file_name": document.file_name},
    )
    db.delete(document)
    db.flush()
    supabase_storage.delete(path)


def review(
    db: Session, document: Document, payload: DocumentReview, actor: Profile, candidate_code: str
) -> Document:
    """Accept or reject an upload."""
    if payload.status == DocumentStatus.REJECTED and not payload.review_note:
        # Mirrors the DB CHECK, but answers with something the admin can act on.
        raise ConflictError("A rejection must say what is wrong with the document.")
    if document.status == payload.status:
        raise ConflictError(f"That document is already {payload.status.value.lower()}.")

    previous = document.status
    document.status = payload.status
    document.review_note = payload.review_note if payload.status == DocumentStatus.REJECTED else None
    document.reviewed_by = actor.id
    document.reviewed_at = (
        None if payload.status == DocumentStatus.PENDING else datetime.now(UTC)
    )

    audit_service.record(
        db,
        actor=actor,
        action=f"document.{payload.status.value.lower()}",
        entity_type="document",
        entity_id=document.id,
        summary=f"{candidate_code}: {document.doc_type.value} {payload.status.value.lower()}",
        metadata={
            "from": previous.value,
            "to": payload.status.value,
            "note": payload.review_note,
        },
    )
    db.flush()
    return document


def link(document: Document) -> tuple[str, int]:
    """A short-lived signed URL for one document."""
    ttl = settings.DOCUMENT_SIGNED_URL_TTL
    return supabase_storage.signed_url(document.storage_path, expires_in=ttl), ttl


# ----------------------------------------------------------------- reads --


def checklist(db: Session, application_id: uuid.UUID) -> list[RequiredDocument]:
    """What is asked for, paired with whatever has been uploaded against it."""
    uploaded = {
        doc.doc_type: doc
        for doc in db.scalars(
            select(Document).where(Document.application_id == application_id)
        )
    }

    rows = [
        RequiredDocument(
            doc_type=doc_type,
            label=label,
            required=required,
            document=uploaded.pop(doc_type, None),
        )
        for doc_type, label, required in REQUIRED_DOCUMENTS
    ]
    # Anything uploaded outside the standard set (OTHER, or a type later
    # removed from the list) still has to be visible.
    rows.extend(
        RequiredDocument(
            doc_type=doc.doc_type, label=doc.doc_type.value.title(), required=False, document=doc
        )
        for doc in uploaded.values()
    )
    return rows


def _row_query() -> Select:
    profile = aliased(Profile)
    return (
        select(Document, Application.candidate_code, profile.full_name)
        .join(Application, Application.id == Document.application_id)
        .join(profile, profile.id == Application.profile_id)
    )


def list_for_bootcamp(
    db: Session,
    bootcamp_id: uuid.UUID,
    *,
    status: DocumentStatus | None = None,
    limit: int = 25,
    offset: int = 0,
) -> tuple[list[DocumentRow], int]:
    stmt = _row_query().where(Application.bootcamp_id == bootcamp_id)
    if status is not None:
        stmt = stmt.where(Document.status == status)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(
        stmt.order_by(Document.created_at.desc()).limit(limit).offset(offset)
    ).all()

    return [
        DocumentRow(
            **{
                field: getattr(doc, field)
                for field in (
                    "id", "application_id", "doc_type", "file_name", "content_type",
                    "size_bytes", "status", "review_note", "reviewed_at", "created_at",
                )
            },
            candidate_code=code,
            candidate_name=name,
        )
        for doc, code, name in rows
    ], total


def get_for_candidate(db: Session, document_id: uuid.UUID, candidate: Profile) -> Document:
    document = _get(db, document_id)
    assert_owner(db, document, candidate)
    return document


def get_for_admin(db: Session, document_id: uuid.UUID, actor: Profile) -> tuple[Document, str]:
    document = _get(db, document_id)
    application = assert_can_review(db, document, actor)
    return document, application.candidate_code
