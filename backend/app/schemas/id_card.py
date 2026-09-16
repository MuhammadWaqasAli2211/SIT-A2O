"""Admin-facing shape of the per-intake ID card switch."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, model_validator


class IdCardIssueState(BaseModel):
    """Whether cards are issued for one intake, and who it would reach."""

    issued: bool
    issued_at: datetime | None = None
    issued_by: uuid.UUID | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    # Candidates selected at the physical interview. The switch reaches
    # exactly these, so an admin can see the blast radius before flipping it.
    eligible_count: int


class IdCardIssueRequest(BaseModel):
    """Issuing requires a validity period; withdrawing requires nothing.

    The dates are checked here as well as by the modal, so the rule holds for
    anything that reaches the route — a card must never print a blank
    validity line.
    """

    issued: bool
    valid_from: date | None = None
    valid_to: date | None = None

    @model_validator(mode="after")
    def _dates_present_and_ordered(self) -> "IdCardIssueRequest":
        if not self.issued:
            # Withdrawing clears them; anything sent alongside is ignored
            # rather than rejected.
            self.valid_from = None
            self.valid_to = None
            return self

        if self.valid_from is None or self.valid_to is None:
            raise ValueError("Set both a valid-from and a valid-to date before issuing")
        if self.valid_to < self.valid_from:
            raise ValueError("The valid-to date cannot be before the valid-from date")
        return self
