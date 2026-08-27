"""Deploy the Supabase Auth email templates from this repository.

WHY THIS EXISTS
---------------
GoTrue sends the signup confirmation email, not our backend, so the markup
lives in the Supabase project rather than in application code. The dashboard
is the usual way to change it, which leaves the live wording unreviewable and
unversioned. This script pushes `supabase/templates/*.html` instead, so the
repository stays the source of truth.

WHY NOT `supabase config push`
------------------------------
That command sends the whole parsed `config.toml`, and the CLI fills in its own
defaults for anything the file leaves out. Several of those defaults contradict
this project: `enable_confirmations` defaults to false (this project requires
confirmation), `site_url` defaults to 127.0.0.1, and the SMTP block is absent
by default. Pushing them would disable email confirmation and break the
confirmation link as a side effect of editing an email template.

The Management API takes a partial body: every field is optional, so a PATCH
naming only the template fields changes only those fields. That is the whole
reason this goes through the API and not the CLI.

USAGE
-----
    export SUPABASE_ACCESS_TOKEN=sbp_...      # account/tokens in the dashboard
    python supabase/scripts/push_email_templates.py            # show the diff
    python supabase/scripts/push_email_templates.py --apply    # write it
"""

import argparse
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_REF = "cfffgnynzqmdzcgljuhx"
API = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth"

REPO = Path(__file__).resolve().parents[2]

# template file -> (content field, subject field, subject line)
TEMPLATES = {
    "confirmation.html": (
        "mailer_templates_confirmation_content",
        "mailer_subjects_confirmation",
        "Confirm your email - Saylani Mass IT Training",
    ),
}


def _request(method: str, token: str, body: bytes | None = None) -> dict:
    request = urllib.request.Request(API, method=method, data=body)
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            import json

            return json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:400]
        sys.exit(f"Management API {method} failed: HTTP {exc.code}\n{detail}")
    except urllib.error.URLError as exc:
        sys.exit(f"Could not reach the Management API: {exc.reason}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="write the changes; without it the script only reports the diff",
    )
    args = parser.parse_args()

    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not token:
        sys.exit("SUPABASE_ACCESS_TOKEN is not set. See the docstring above.")

    live = _request("GET", token)

    changes: dict[str, str] = {}
    for filename, (content_field, subject_field, subject) in TEMPLATES.items():
        local = (REPO / "supabase" / "templates" / filename).read_text(encoding="utf-8")
        remote = live.get(content_field) or ""

        status = "unchanged" if remote.strip() == local.strip() else "DIFFERS"
        print(f"{filename}: {status}")
        print(f"  live:  {len(remote):>5} chars  subject={live.get(subject_field)!r}")
        print(f"  local: {len(local):>5} chars  subject={subject!r}")

        if status == "DIFFERS" or live.get(subject_field) != subject:
            changes[content_field] = local
            changes[subject_field] = subject

    # Reported because it decides whether a confirmation email is required at
    # all, and reading it here is the cheapest way to catch it being flipped.
    print(f"\nmailer_autoconfirm (live): {live.get('mailer_autoconfirm')}")
    print(f"site_url (live):           {live.get('site_url')!r}")

    if not changes:
        print("\nNothing to do; the live templates already match this repository.")
        return

    if not args.apply:
        print(f"\n{len(changes)} field(s) would change. Re-run with --apply to write them.")
        return

    import json

    _request("PATCH", token, json.dumps(changes).encode("utf-8"))

    after = _request("GET", token)
    for field, expected in changes.items():
        got = after.get(field) or ""
        mark = "ok" if got.strip() == expected.strip() else "MISMATCH"
        print(f"  {mark}: {field}")
    print("\nApplied.")


if __name__ == "__main__":
    main()
