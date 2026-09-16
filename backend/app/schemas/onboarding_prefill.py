"""What we already know about a candidate, for pre-filling the onboarding forms.

One flat object rather than a shape per form: the same value feeds several
forms (a name appears on all four), and a per-form endpoint would answer the
same question four ways and eventually disagree with itself.

Everything here is a *default*. The candidate can edit any of it, because a
form may legitimately need something different for its own context — a
different postal address, say. `email` is the exception, already read-only
across this project because it comes from the account.
"""

from datetime import date

from pydantic import BaseModel


class OnboardingPrefill(BaseModel):
    full_name: str | None = None
    father_name: str | None = None
    father_cnic: str | None = None
    cnic: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    phone: str | None = None
    father_phone: str | None = None
    address: str | None = None
    email: str | None = None

    # From the application rather than the person: their code and the track
    # they were admitted to.
    candidate_code: str | None = None
    program_title: str | None = None

    # A short-lived URL, not the bytes: the forms render it in an <img>, and
    # the photo is already stored once in the pictures bucket.
    picture_url: str | None = None
