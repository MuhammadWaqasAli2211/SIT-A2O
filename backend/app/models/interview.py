"""Interview scheduling.

Many rows per application on purpose: a reschedule or a re-interview adds a
row rather than overwriting one, so the history of attempts survives.
`Application.stage` stays the single source of truth for pipeline position.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.application import Application
from app.models.enums import InterviewMode, InterviewStatus
from app.models.user import Profile


class Interview(Base, TimestampMixin):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("30")
    )
    mode: Mapped[InterviewMode] = mapped_column(
        Enum(InterviewMode, name="interview_mode", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'ONSITE'::interview_mode"),
    )
    # Room number when ONSITE, meeting URL when ONLINE — never both at once.
    location: Mapped[str | None] = mapped_column(Text)

    interviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    status: Mapped[InterviewStatus] = mapped_column(
        Enum(InterviewStatus, name="interview_status", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'SCHEDULED'::interview_status"),
    )

    # Null until conducted. A CHECK constraint keeps a score from existing on a
    # non-COMPLETED row, so this cannot drift.
    score: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    batch_label: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )

    application: Mapped[Application] = relationship()
    interviewer: Mapped[Profile | None] = relationship(foreign_keys=[interviewer_id])

    def __repr__(self) -> str:
        return f"<Interview {self.scheduled_at:%Y-%m-%d %H:%M} {self.status}>"
