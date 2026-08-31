"""Onboarding Form submissions and the Documents Hub uploads.

Both are scoped to an application and gated behind clearing the Physical
Interview stage. Kept in one file, and in tables separate from `documents`,
because they serve a distinct pipeline stage with different rules — most
importantly that some document types here hold several files at once, which
`documents`' one-row-per-type replace semantics does not support.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.application import Application
from app.models.enums import (
    DocumentStatus,
    OnboardingDocumentType,
    OnboardingFormStatus,
    OnboardingFormType,
)


class OnboardingFormSubmission(Base, TimestampMixin):
    __tablename__ = "onboarding_form_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    form_type: Mapped[OnboardingFormType] = mapped_column(
        Enum(OnboardingFormType, name="onboarding_form_type", native_enum=True, create_type=False),
        nullable=False,
    )

    # The answers as filled. Shape differs per form_type; validated against a
    # per-type Pydantic schema before this is ever written.
    submitted_data: Mapped[dict] = mapped_column(JSONB, nullable=False)

    status: Mapped[OnboardingFormStatus] = mapped_column(
        Enum(OnboardingFormStatus, name="onboarding_form_status", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'SUBMITTED'::onboarding_form_status"),
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )

    # Set when an admin sends this form back for correction. Not cleared on
    # resubmission — it stays as a record of the last time this happened,
    # while `status` alone says whether it is *currently* reopened.
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reopened_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    reopen_note: Mapped[str | None] = mapped_column(Text)

    application: Mapped[Application] = relationship()

    def __repr__(self) -> str:
        return f"<OnboardingFormSubmission {self.form_type} {self.status}>"


class OnboardingDocument(Base, TimestampMixin):
    __tablename__ = "onboarding_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    doc_type: Mapped[OnboardingDocumentType] = mapped_column(
        Enum(
            OnboardingDocumentType,
            name="onboarding_document_type",
            native_enum=True,
            create_type=False,
        ),
        nullable=False,
    )

    storage_path: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    file_name: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'PENDING'::document_status"),
    )
    review_note: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )

    application: Mapped[Application] = relationship()

    def __repr__(self) -> str:
        return f"<OnboardingDocument {self.doc_type} {self.status}>"
