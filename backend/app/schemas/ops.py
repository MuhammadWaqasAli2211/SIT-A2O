"""Schemas for the operational records: email history and the audit trail."""

import uuid
from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ApplicationStage, EmailStatus

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Shared pagination envelope, so every list endpoint answers the same shape."""

    items: list[T]
    total: int
    limit: int
    offset: int


# ------------------------------------------------------------------ audit --


class AuditEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    entity_type: str
    entity_id: uuid.UUID | None = None
    summary: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    actor_name: str | None = None
    actor_email: EmailStr | None = None
    created_at: datetime


# ------------------------------------------------------------------ email --


class EmailLogRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recipient_email: EmailStr
    subject: str
    template: str | None = None
    status: EmailStatus
    provider_message_id: str | None = None
    error: str | None = None
    sent_by_name: str | None = None
    candidate_code: str | None = None
    created_at: datetime


class EmailSendRequest(BaseModel):
    """Send to an explicit list of applications within one bootcamp.

    Addressed by application rather than raw email so every send can be logged
    against a candidate, and so an admin cannot mail outside their scope.
    """

    application_ids: list[uuid.UUID] = Field(min_length=1, max_length=500)
    subject: str = Field(min_length=1, max_length=200)
    body_html: str = Field(min_length=1, max_length=20000)
    template: str | None = Field(default=None, max_length=60)


class EmailBroadcastRequest(BaseModel):
    """Send to everyone in a bootcamp matching a stage filter."""

    stage: ApplicationStage | None = None
    subject: str = Field(min_length=1, max_length=200)
    body_html: str = Field(min_length=1, max_length=20000)
    template: str | None = Field(default=None, max_length=60)


class EmailSendResult(BaseModel):
    sent: int
    failed: int
    total: int
    failures: list[str] = Field(
        default_factory=list, description="Recipient addresses that could not be sent to."
    )
