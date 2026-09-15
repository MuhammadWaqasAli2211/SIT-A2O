"""Bootcamp intake models: the intake itself, its tracks, admins, and phases."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import BootcampStatus, PhaseType


class Program(Base, TimestampMixin):
    """A track (Web Development, Data Science, ...).

    Reference data only. Marketing copy — skills, outcomes, curriculum — and
    the icon stay in the frontend: icons are React components, and that content
    changes with the website rather than with recruitment data.
    """

    __tablename__ = "programs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    tagline: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    duration: Mapped[str | None] = mapped_column(String)
    mode: Mapped[str | None] = mapped_column(String)
    level: Mapped[str | None] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    # What Agilytics calls this track. Sent as `trackName` when onboarding a
    # student on this program; null sends no track and leaves them ungrouped
    # there. Not derived from `title` on purpose — their API ignores an
    # unmatched name silently, so a guessed mapping fails invisibly.
    agilytics_track_name: Mapped[str | None] = mapped_column(String)

    def __repr__(self) -> str:
        return f"<Program {self.slug}>"


class Bootcamp(Base, TimestampMixin):
    __tablename__ = "bootcamps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    bootcamp_number: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[BootcampStatus] = mapped_column(
        Enum(BootcampStatus, name="bootcamp_status", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'DRAFT'::bootcamp_status"),
    )
    starts_at: Mapped[date | None] = mapped_column(Date)

    # Managed exclusively by the mint_candidate_code() SQL function. Never
    # assign to this from Python: doing so outside that function's row lock
    # reintroduces the race it exists to prevent.
    next_candidate_seq: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("1")
    )

    # The Agilytics workspace this intake was provisioned into, or None if it
    # has not been. Opaque: minted by their system, stored only so we can
    # address their onboarding-status and bulk-invite endpoints afterwards.
    # Their provisioning call is not idempotent, so this doubles as the guard
    # against creating a second workspace for the same intake.
    agilytics_workspace_id: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )

    phases: Mapped[list["BootcampPhase"]] = relationship(
        back_populates="bootcamp", cascade="all, delete-orphan"
    )
    programs: Mapped[list["BootcampProgram"]] = relationship(
        back_populates="bootcamp", cascade="all, delete-orphan"
    )
    admins: Mapped[list["BootcampAdmin"]] = relationship(
        back_populates="bootcamp", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Bootcamp {self.bootcamp_number} {self.status}>"


class BootcampProgram(Base):
    """Which tracks a given intake offers.

    No capacity column yet — seat limits were deferred. Adding `seats` here
    later is additive; reconstructing which programs a past intake offered
    would not be.
    """

    __tablename__ = "bootcamp_programs"

    bootcamp_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bootcamps.id", ondelete="CASCADE"), primary_key=True
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="RESTRICT"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    bootcamp: Mapped[Bootcamp] = relationship(back_populates="programs")
    program: Mapped[Program] = relationship()


class BootcampAdmin(Base):
    """Admin assignment.

    A join table rather than an FK on `bootcamps`: an intake can have
    co-admins, and one admin can run several intakes.
    """

    __tablename__ = "bootcamp_admins"

    bootcamp_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bootcamps.id", ondelete="CASCADE"), primary_key=True
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True
    )
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    bootcamp: Mapped[Bootcamp] = relationship(back_populates="admins")


class BootcampPhase(Base, TimestampMixin):
    """One deadline-gated stage of an intake."""

    __tablename__ = "bootcamp_phases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    bootcamp_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bootcamps.id", ondelete="CASCADE"), nullable=False
    )
    phase: Mapped[PhaseType] = mapped_column(
        Enum(PhaseType, name="phase_type", native_enum=True, create_type=False), nullable=False
    )
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    closed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # When this phase's results were made visible to candidates; null means
    # hidden. Only the INTERVIEW phase uses it today — that is where the AI
    # interview lives, and where the deadline the announce action is gated
    # behind already sits.
    results_announced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    results_announced_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )

    @property
    def results_announced(self) -> bool:
        return self.results_announced_at is not None

    bootcamp: Mapped[Bootcamp] = relationship(back_populates="phases")

    def __repr__(self) -> str:
        return f"<BootcampPhase {self.phase} open={self.is_open}>"
