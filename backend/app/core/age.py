"""The one age-threshold calculation the platform makes.

Whether someone counts as an adult decides which identity document they hold
(CNIC vs B-Form) and, later, which onboarding paperwork applies to them (bank
details vs a mobile wallet). Every caller derives it from `date_of_birth`
rather than trusting a client-supplied flag, so it lives here once instead of
being re-derived slightly differently in each service that needs it.
"""

from datetime import date


def is_adult(born: date, *, today: date | None = None) -> bool:
    """Whether `born` is 18 or older as of `today` (defaults to the real date)."""
    today = today or date.today()
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return age >= 18
