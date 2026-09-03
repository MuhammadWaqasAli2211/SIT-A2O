"""Physical Interview: bulk invites with venue/date/time, and per-candidate
results recorded after an in-person round.

Two tables for the same reason as interview_invite_batches/interview_invites:
the send covers many candidates in one action, so the batch carries the
venue/date/time/deadline and the invite is the per-candidate record an admin
actually reads and decides. Deliberately not the `interviews` table — see the
migration for why.
"""

import uuid
from datetime import UTC, date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Text, Time, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.application import Application
from app.models.enums import PhysicalInterviewResult


class PhysicalInterviewBatch(Base):
    __tablename__ = "physical_interview_batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    bootcamp_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bootcamps.id", ondelete="CASCADE"), nullable=False
    )

    venue: Mapped[str] = mapped_column(Text, nullable=False)
    interview_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)

    # Deadline for recording a result. Snapshotted at send time, the same way
    # interview_invite_batches.deadline_at is — there is no governing phase
    # for this stage to read a live deadline from.
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    subject: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    @property
    def is_expired(self) -> bool:
        """Past the result-recording deadline. Mirrors
        InterviewInviteBatch.is_expired exactly."""
        return datetime.now(UTC) > self.deadline_at

    invites: Mapped[list["PhysicalInterviewInvite"]] = relationship(
        back_populates="batch", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PhysicalInterviewBatch {self.venue} {self.interview_date}>"


class PhysicalInterviewInvite(Base):
    __tablename__ = "physical_interview_invites"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("physical_interview_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )

    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    send_failed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    # Null until an admin records an in-person outcome. "Missed" is derived,
    # not stored — see batch.is_expired and physical_interview_service.
    result: Mapped[PhysicalInterviewResult | None] = mapped_column(
        Enum(
            PhysicalInterviewResult,
            name="physical_interview_result",
            native_enum=True,
            create_type=False,
        )
    )
    # Admin's own record only, never shown to the candidate.
    rejection_note: Mapped[str | None] = mapped_column(Text)

    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    batch: Mapped[PhysicalInterviewBatch] = relationship(back_populates="invites")
    # Read-only on this side: an Application does not need to enumerate its
    # own Physical Interview invites anywhere in this codebase yet, so no
    # back_populates.
    application: Mapped[Application] = relationship(viewonly=True)

    def __repr__(self) -> str:
        return f"<PhysicalInterviewInvite {self.application_id} {self.result}>"
