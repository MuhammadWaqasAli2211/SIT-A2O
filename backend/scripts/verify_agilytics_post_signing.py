"""Prove POST body-signing against the live Agilytics API.

Run:  ./.venv/Scripts/python.exe scripts/verify_agilytics_post_signing.py

The GET path is proven by verify_agilytics_signing.py, but POST signs the
*raw body* rather than a query string, which is a different code path and
fails the same opaque way when wrong — a bare 403 at the moment somebody
provisions a real intake.

This creates ONE throwaway workspace, named so it is obviously a test, with
`example.com` addresses only (IANA-reserved for documentation — no real
mailbox is touched, and their invite mail has nowhere to go). It is
authorised and deliberate, but note it cannot be cleaned up: their API
exposes no delete. Do not run it repeatedly.

It then reads the new workspace back with an already-proven GET, which is
what actually confirms the POST did what it claimed rather than trusting a
201 alone.
"""

import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.exceptions import AppError  # noqa: E402
from app.integrations import agilytics  # noqa: E402

STAMP = datetime.now(UTC).strftime("%Y%m%d-%H%M")
NAME = f"SIT-A2O signing probe {STAMP}"


def main() -> int:
    if not settings.agilytics_configured:
        print("Agilytics is not configured — stopping.")
        return 2

    print(f"base url : {settings.AGILYTICS_API_BASE_URL}")
    print(f"workspace: {NAME!r}  (throwaway, cannot be deleted afterwards)")
    print("addresses: example.com only — no real mailbox is contacted\n")

    try:
        created = agilytics.provision_workspace(
            name=NAME,
            description="Automated check that POST body-signing is accepted. Not a real intake.",
            tracks=["Signing Probe"],
            students=[
                {
                    "email": "probe-student@example.com",
                    "fullName": "Probe Student",
                    "trackName": "Signing Probe",
                }
            ],
        )
    except AppError as exc:
        print(f"POST REFUSED: {exc}")
        print(f"  details: {getattr(exc, 'details', None)}")
        return 1

    workspace_id = created.get("workspaceId")
    print("POST ACCEPTED — body signature verified by their server")
    print(f"  workspaceId    : {workspace_id}")
    print(f"  tracksCreated  : {created.get('tracksCreated')}")
    print(f"  summary        : {created.get('summary')}")

    if not workspace_id:
        print("\nNo workspaceId came back — cannot read it back to confirm.")
        return 1

    # A 201 alone proves the signature was accepted, not that the workspace
    # holds what we asked for. The read-back is what settles that.
    print("\nreading it back over the already-proven GET path:")
    state = agilytics.onboarding_status(str(workspace_id))
    print(f"  workspaceName  : {state.get('workspaceName')}")
    print(f"  totalMembers   : {state.get('totalMembers')}")
    print(f"  statusBreakdown: {state.get('statusBreakdown')}")
    print(f"  trackBreakdown : {state.get('trackBreakdown')}")

    print("\nbulk-invite on the same workspace (empty body — signs the empty string):")
    invites = agilytics.bulk_invite(str(workspace_id))
    print(f"  invitesIssued  : {invites.get('invitesIssued')}")
    print(f"  expiresAt      : {invites.get('expiresAt')}")

    print("\nPASS — POST body-signing, empty-body POST signing, and GET all accepted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
