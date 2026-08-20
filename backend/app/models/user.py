"""Profile models.

Supabase's `auth.users` owns identity: email, password hash, providers, and
verification state. These tables hold only what the application adds on top.
"""

import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import UserRole


class Profile(Base, TimestampMixin):
    __tablename__ = "profiles"

    # Mirrors auth.users.id one-to-one; the FK is declared in SQL, not here,
    # because SQLAlchemy does not manage the `auth` schema.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(30))

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", native_enum=True, create_type=False),
        nullable=False,
        server_default=text("'CANDIDATE'::user_role"),
    )
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default=text("true"))

    candidate_profile: Mapped["CandidateProfile | None"] = relationship(
        back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Profile {self.email} role={self.role}>"


class CandidateProfile(Base, TimestampMixin):
    """Applicant-only fields, kept off `profiles` so admin rows stay narrow."""

    __tablename__ = "candidate_profiles"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    cnic: Mapped[str | None] = mapped_column(String(20), unique=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    city: Mapped[str | None] = mapped_column(String(80))
    education: Mapped[str | None] = mapped_column(String(120))

    profile: Mapped[Profile] = relationship(back_populates="candidate_profile")
