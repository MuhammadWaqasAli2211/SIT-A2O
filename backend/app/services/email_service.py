"""Outbound email for the recruitment workflow itself.

Interview invitations, batch results, and onboarding links all go through
here. Supabase's own SMTP config is separate and only handles Supabase Auth's
built-in emails (signup confirmation, password reset) — it is never called
from this module.
"""

from app.integrations import gmail_api


def send_email(*, to: str, subject: str, html_body: str, text_body: str | None = None) -> str:
    """Send one email. Returns the provider's message id.

    Thin today — Phase 2 will add templates (interview invite, batch result,
    onboarding link) and an email_logs record per send. Kept as a single choke
    point now so that logging and templating have one place to attach later.
    """
    return gmail_api.send_email(
        to=to, subject=subject, html_body=html_body, text_body=text_body
    )
