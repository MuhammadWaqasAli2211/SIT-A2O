"""Step 0: prove our Agilytics request signature is accepted by the live API.

Run:  ./.venv/Scripts/python.exe scripts/verify_agilytics_signing.py

Why this exists: a wrong canonical string fails as a bare 403 with nothing
to debug from, so the scheme has to be confirmed against the real service
before anything is built on top of it. This calls through
`app.integrations.agilytics` itself rather than reimplementing the signing,
so what it proves is the code that will actually run in production.

The probe is the onboarding-status GET — read-only, creates nothing — aimed
at a workspace id that does not exist. That is deliberate: it separates the
two outcomes cleanly.

    403  the signature was refused                          (scheme is wrong)
    404  the signature passed, the workspace did not exist   (scheme is right)

So a 404 here is a pass. It is also why no real workspace id is needed to
settle the question.

Both the bare call and the `?email=` call are made. The second is the one
that carries weight: with an empty query string the payload we sign is the
empty string, which several plausible schemes coincide on. A non-empty
query string is what actually distinguishes "signs the sorted query
string" from the alternatives.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.exceptions import NotFoundError, UpstreamError  # noqa: E402
from app.integrations import agilytics  # noqa: E402

WORKSPACE = "sit-a2o-probe-nonexistent"


def probe(label: str, **kwargs) -> bool:
    """Returns True when the signature was accepted, whatever the outcome after."""
    try:
        payload = agilytics.onboarding_status(WORKSPACE, **kwargs)
    except NotFoundError:
        # Reached their handler; it simply has no such workspace. Signature good.
        print(f"  {label:<22} signature ACCEPTED  (404 workspace not found)")
        return True
    except UpstreamError as exc:
        print(f"  {label:<22} REFUSED             ({exc.details or exc})")
        return False
    print(f"  {label:<22} signature ACCEPTED  (200 {str(payload)[:80]})")
    return True


def main() -> int:
    if not settings.agilytics_configured:
        print("PORTAL_AGILYTICS_SECRET / AGILYTICS_API_BASE_URL not configured — stopping.")
        return 2

    print(f"base url : {settings.AGILYTICS_API_BASE_URL}")
    print(f"workspace: {WORKSPACE} (deliberately non-existent)")
    print(f"secret   : loaded, {len(settings.PORTAL_AGILYTICS_SECRET)} chars (not printed)\n")

    print("signed requests through app.integrations.agilytics:")
    bare = probe("no query params")
    with_email = probe("?email=", email="probe@example.com")

    print()
    if bare and with_email:
        print("PASS — our signature is accepted both with and without query parameters.")
        return 0
    print("FAIL — Agilytics refused at least one signed request.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
