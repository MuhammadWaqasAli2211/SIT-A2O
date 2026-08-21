"""Operational records: what was emailed, and who changed what.

Neither can be reconstructed after the fact, which is why both are written
synchronously rather than derived later from application state.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import EmailStatus


class EmailLog(Base):
    """One row per send attempt, successful or not.

    Exists so an admin can answer "did this candidate actually get the invite?"
    without needing access to the sending mailbox.
    """

    __tablename__ = "email_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    # Both nullable, both SET NULL: a broadcast belongs to an intake but not one
    # application, and deleting an intake must never erase proof that mail went out.
    bootcamp_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bootcamps.id", ondelete="SET NULL")
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="SET NULL")
    )

    recipient_email: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    template: Mapped[str | None] = mapped_column(Text)
    body_html: Mapped[str | None] = mapped_column(Text)

    status: Mapped[EmailStatus] = mapped_column(
        Enum(EmailStatus, name="email_status", native_enum=True, create_type=False),
        nullable=False,
    )
    provider_message_id: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)

    sent_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    def __repr__(self) -> str:
        return f"<EmailLog {self.recipient_email} {self.status}>"


class AuditLog(Base):
    """Append-only record of privileged writes.

    Generic on purpose (entity_type + entity_id): a new admin action needs a
    service call, not a schema change.
    """

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )

    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # Rendered at write time so the activity feed never has to re-fetch an
    # entity that may since have been deleted.
    summary: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.entity_type}>"
