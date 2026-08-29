"""AI interview invites, sent through the InterviewerAI service.

Two tables because the send is one API call covering many candidates: the
batch is what InterviewerAI tracks and what a status poll refreshes, the
invite is the per-candidate record an admin actually reads. See
app/integrations/interviewer_ai.py for why this is not an `interviews` row.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import InviteBatchStatus, InviteStatus


class InterviewInviteBatch(Base):
    __tablename__ = "interview_invite_batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    bootcamp_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bootcamps.id", ondelete="CASCADE"), nullable=False
    )

    # InterviewerAI's own id for this batch, used to poll send-progress.
    external_batch_id: Mapped[int | None] = mapped_column(BigInteger)

    subject: Mapped[str] = mapped_column(Text, nullable=False)
    batch_name: Mapped[str | None] = mapped_column(Text)
    status: Mapped[InviteBatchStatus] = mapped_column(
        Enum(InviteBatchStatus, name="invite_batch_status", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'PENDING'::invite_batch_status"),
    )

    total_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    last_polled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # The intake's INTERVIEW phase deadline as it stood when this batch was
    # sent. After it passes the invite is no longer honoured — InterviewerAI
    # has no invite-expiry of its own, so this is what enforces it. Snapshot,
    # not a live read: see the migration for why.
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def is_expired(self) -> bool:
        """Past its deadline. A batch sent before deadlines were recorded has
        none, and is treated as still valid rather than retroactively expired."""
        if self.deadline_at is None:
            return False
        return datetime.now(UTC) > self.deadline_at

    invites: Mapped[list["InterviewInvite"]] = relationship(
        back_populates="batch", cascade="all, delete-orphan", order_by="InterviewInvite.row_index"
    )

    def __repr__(self) -> str:
        return f"<InterviewInviteBatch {self.subject} {self.status}>"


class InterviewInvite(Base):
    __tablename__ = "interview_invites"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interview_invite_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Null for a row added by CSV/manual entry with no application behind it.
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="SET NULL")
    )

    # InterviewerAI's own candidate id, resolved after the send so their
    # interviews and reports can be matched back to this row without relying
    # on the email address staying identical on both sides. Null when the
    # lookup found nothing, or for rows sent before this was captured.
    external_candidate_id: Mapped[int | None] = mapped_column(BigInteger)

    # Position in the array sent to InterviewerAI — how a status poll matches
    # their by-index `failures` back to a row.
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)

    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    cnic: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    course_status: Mapped[str | None] = mapped_column(Text)

    status: Mapped[InviteStatus] = mapped_column(
        Enum(InviteStatus, name="invite_status", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'PENDING'::invite_status"),
    )
    error: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    batch: Mapped[InterviewInviteBatch] = relationship(back_populates="invites")

    def __repr__(self) -> str:
        return f"<InterviewInvite {self.email} {self.status}>"
