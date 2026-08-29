import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import AiScope


class ScopeOut(BaseModel):
    """One grantable scope, described for the assignment screen."""

    scope: AiScope
    label: str
    external: str


class GrantIn(BaseModel):
    scope: AiScope


class GrantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scope: AiScope
    granted_at: datetime


class AdminGrants(BaseModel):
    """Every scope one administrator holds, for the assignment table."""

    profile_id: uuid.UUID
    full_name: str | None = None
    email: str
    scopes: list[AiScope]
