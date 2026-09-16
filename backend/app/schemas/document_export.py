"""Bulk document export, as our own API shapes it."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class DocumentExportCandidate(BaseModel):
    """One candidate the export modal can offer."""

    application_id: uuid.UUID
    candidate_code: str
    full_name: str | None = None
    documents_approved: int = 0
    # Null means never exported — what the modal's "Not yet sent" tab filters
    # on. Overwritten per send; there is no history behind it.
    exported_at: datetime | None = None


class DocumentExportEligibleList(BaseModel):
    """Everyone whose paperwork is finished, sent or not.

    One list, not two: the modal's tabs are the same rows filtered on
    `exported_at`, so they cannot disagree about who exists.
    """

    candidates: list[DocumentExportCandidate] = []


class DocumentExportRequest(BaseModel):
    application_ids: list[uuid.UUID] = Field(min_length=1)
    # Validated as an address here so a typo is a 422 the admin sees while the
    # modal is still open, rather than a background send that quietly fails.
    recipient_email: EmailStr
    # Appears in the body of the email — "Sent by …", and the sign-off. Not the
    # From header: Gmail sends as the configured mailbox and that does not
    # change, so this is the only honest place to put a person's name.
    sender_name: str = Field(min_length=2, max_length=120)


class DocumentExportQueued(BaseModel):
    """The immediate answer, before any work has happened.

    Building the archive takes minutes at realistic sizes, so the route
    returns this and hands the rest to a background task.
    """

    queued: int
    recipient_email: str
    message: str
