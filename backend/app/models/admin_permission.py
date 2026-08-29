"""Per-admin write permissions on the AI Interviewer API.

A row means "this admin may perform this write". Absence means they may not.
Reads are not represented — every admin has them by default. See
app/services/permission_service.py for the gate itself.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import AiScope


class AdminPermission(Base):
    __tablename__ = "admin_permissions"
    __table_args__ = (UniqueConstraint("profile_id", "scope"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    scope: Mapped[AiScope] = mapped_column(
        Enum(AiScope, name="ai_scope", native_enum=True, create_type=False), nullable=False
    )

    granted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    profile: Mapped["Profile"] = relationship(foreign_keys=[profile_id])  # noqa: F821
    granter: Mapped["Profile | None"] = relationship(foreign_keys=[granted_by])  # noqa: F821

    def __repr__(self) -> str:
        return f"<AdminPermission {self.profile_id} {self.scope}>"
