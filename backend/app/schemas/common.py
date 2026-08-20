"""Response envelopes shared across routes."""

from typing import Any

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Any = None


class MessageResponse(BaseModel):
    message: str
