"""Candidate document uploads and admin review.

Files never pass through this API on the way out: reads are served by a
short-lived signed URL straight from Supabase Storage, so a 5 MB scan does not
occupy a worker. Uploads do pass through, because that is the only place the
size and content-type limits can actually be enforced.
"""

import uuid

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.api.deps import AdminUser, CandidateUser, DbSession
from app.models.enums import DocumentStatus, DocumentType
from app.schemas.document import (
    DocumentLink,
    DocumentOut,
    DocumentReview,
    DocumentRow,
    RequiredDocument,
)
from app.schemas.ops import Page
from app.services import application_service, bootcamp_service, document_service

router = APIRouter(tags=["documents"])


# ------------------------------------------------------------- candidate --


@router.get(
    "/applications/{application_id}/documents",
    response_model=list[RequiredDocument],
    tags=["candidate"],
)
def my_checklist(
    application_id: uuid.UUID, user: CandidateUser, db: DbSession
) -> list[RequiredDocument]:
    """What this application still needs, and what has been uploaded so far."""
    application_service.get_own(db, user, application_id)
    return document_service.checklist(db, application_id)


@router.post(
    "/applications/{application_id}/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    tags=["candidate"],
)
async def upload_document(
    application_id: uuid.UUID,
    user: CandidateUser,
    db: DbSession,
    doc_type: DocumentType = Form(...),
    file: UploadFile = File(...),
) -> DocumentOut:
    """Upload or replace one document. Re-uploading supersedes the previous file."""
    application = application_service.get_own(db, user, application_id)
    content = await file.read()

    document = document_service.upload(
        db,
        application=application,
        doc_type=doc_type,
        file_name=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        content=content,
        actor=user,
    )
    return DocumentOut.model_validate(document)


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["candidate"],
)
def delete_document(document_id: uuid.UUID, user: CandidateUser, db: DbSession) -> None:
    """Remove one of your own uploads, unless it has already been accepted."""
    document = document_service.get_for_candidate(db, document_id, user)
    application = application_service.get_detail(db, document.application_id)
    document_service.delete(db, document, user, application.candidate_code)


@router.get("/documents/{document_id}/link", response_model=DocumentLink)
def document_link(document_id: uuid.UUID, user: CandidateUser, db: DbSession) -> DocumentLink:
    """A short-lived URL to view your own upload."""
    document = document_service.get_for_candidate(db, document_id, user)
    url, ttl = document_service.link(document)
    return DocumentLink(url=url, expires_in=ttl)


# ----------------------------------------------------------------- admin --


@router.get("/bootcamps/{bootcamp_id}/documents", response_model=Page[DocumentRow])
def list_documents(
    bootcamp_id: uuid.UUID,
    user: AdminUser,
    db: DbSession,
    status_filter: DocumentStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[DocumentRow]:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    items, total = document_service.list_for_bootcamp(
        db, bootcamp_id, status=status_filter, limit=limit, offset=offset
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/admin/documents/{document_id}/link", response_model=DocumentLink)
def admin_document_link(
    document_id: uuid.UUID, user: AdminUser, db: DbSession
) -> DocumentLink:
    document, _ = document_service.get_for_admin(db, document_id, user)
    url, ttl = document_service.link(document)
    return DocumentLink(url=url, expires_in=ttl)


@router.post("/documents/{document_id}/review", response_model=DocumentOut)
def review_document(
    document_id: uuid.UUID, payload: DocumentReview, user: AdminUser, db: DbSession
) -> DocumentOut:
    """Accept or reject an upload. A rejection must carry a reason."""
    document, candidate_code = document_service.get_for_admin(db, document_id, user)
    return DocumentOut.model_validate(
        document_service.review(db, document, payload, user, candidate_code)
    )
