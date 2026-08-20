"""The pipeline spine: one application per person per intake, plus its history."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.bootcamp import Bootcamp, Program
from app.models.enums import ApplicationStage, ApplicationStatus
from app.models.user import Profile


class Application(Base, TimestampMixin):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    bootcamp_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bootcamps.id", ondelete="CASCADE"), nullable=False
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="RESTRICT"), nullable=False
    )

    # Minted by mint_candidate_code() at insert and never changed afterwards:
    # it appears in emails, on ID cards, and in Agilytic.
    candidate_code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)

    stage: Mapped[ApplicationStage] = mapped_column(
        Enum(ApplicationStage, name="application_stage", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'APPLIED'::application_stage"),
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'ACTIVE'::application_status"),
    )
    # Outcome of the Interview stage, and the condition for reaching the
    # physical interview. Tri-state: None means undecided, which is distinct
    # from a recorded "no" — a plain boolean would make every candidate who has
    # not been interviewed yet look rejected.
    #
    # Not a stage. The candidate stepper has five nodes and selection is what
    # lets somebody leave the second one.
    is_selected: Mapped[bool | None] = mapped_column(Boolean)

    statement: Mapped[str | None] = mapped_column(Text)
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    bootcamp: Mapped[Bootcamp] = relationship()
    program: Mapped[Program] = relationship()
    profile: Mapped[Profile] = relationship()
    transitions: Mapped[list["StageTransition"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="StageTransition.created_at",
    )

    def __repr__(self) -> str:
        return f"<Application {self.candidate_code} {self.stage}>"


class StageTransition(Base):
    """Audit trail of stage changes.

    Written on every advance, including the initial APPLIED, so a candidate's
    journey can always be reconstructed. Stage history cannot be recovered
    after the fact, which is why this exists from day one rather than later.
    """

    __tablename__ = "stage_transitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    from_stage: Mapped[ApplicationStage | None] = mapped_column(
        Enum(ApplicationStage, name="application_stage", native_enum=True, create_type=False)
    )
    to_stage: Mapped[ApplicationStage] = mapped_column(
        Enum(ApplicationStage, name="application_stage", native_enum=True, create_type=False),
        nullable=False,
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    application: Mapped[Application] = relationship(back_populates="transitions")
