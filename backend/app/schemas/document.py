"""Document upload and review schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DocumentStatus, DocumentType


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    doc_type: DocumentType
    file_name: str
    content_type: str
    size_bytes: int
    status: DocumentStatus
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime

    # Deliberately absent: storage_path. It is an internal location, and a
    # client that knew it would still need a signed URL to read anything.


class DocumentRow(DocumentOut):
    """Admin list row — adds who it belongs to."""

    candidate_code: str
    candidate_name: str | None = None


class DocumentReview(BaseModel):
    status: DocumentStatus
    review_note: str | None = Field(default=None, max_length=500)


class DocumentLink(BaseModel):
    """A short-lived read URL. Never cached client-side — it expires quickly."""

    url: str
    expires_in: int


class RequiredDocument(BaseModel):
    """One row of the candidate's checklist: what is asked for, and its state."""

    doc_type: DocumentType
    label: str
    required: bool
    document: DocumentOut | None = None
