"""Outbound email for the recruitment workflow itself.

Interview invitations, batch results, and onboarding links all go through
here. Supabase's own SMTP config is separate and only handles Supabase Auth's
built-in emails (signup confirmation, password reset) — it is never called
from this module.
"""

import logging

from app.integrations import gmail_api

logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, html_body: str, text_body: str | None = None) -> str:
    """Send one email. Returns the provider's message id.

    Thin today — Phase 2 will add templates (interview invite, batch result,
    onboarding link) and an email_logs record per send. Kept as a single choke
    point now so that logging and templating have one place to attach later.
    """
    return gmail_api.send_email(
        to=to, subject=subject, html_body=html_body, text_body=text_body
    )


def send_registration_confirmation(
    *, to: str, full_name: str, candidate_code: str, bootcamp_name: str, program_title: str
) -> None:
    """Confirm a submitted registration and hand over the candidate code.

    Never raises. Registration has already been committed by the time this
    runs, so a mail failure must not surface as a failed application — the
    candidate is registered whether or not Gmail was reachable. Failures are
    logged with the code so a missing email can be traced and resent by hand.
    """
    first_name = (full_name or "").split(" ")[0] or "there"

    subject = f"Your bootcamp application — {candidate_code}"

    text_body = (
        f"Hi {first_name},\n\n"
        f"Your application to {bootcamp_name} has been received.\n\n"
        f"Your candidate code is {candidate_code}.\n\n"
        "Keep this code. It identifies you at every stage from here on — the "
        "interview, the physical interview at the campus, the enrolment form, "
        "and onboarding. Quote it in any email you send us, and bring it with "
        "you when you come to campus.\n\n"
        f"Program: {program_title}\n\n"
        "We will email you again when interview scheduling opens. Nothing is "
        "required from you until then.\n\n"
        "Saylani Mass IT Training"
    )

    html_body = f"""\
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#1a1a1a">
  <p>Hi {first_name},</p>
  <p>Your application to <strong>{bootcamp_name}</strong> has been received.</p>
  <p style="margin:24px 0;padding:16px 20px;background:#f4f6f4;border-left:4px solid #16a34a;border-radius:6px">
    Your candidate code is<br>
    <strong style="font-size:26px;letter-spacing:1px;font-family:ui-monospace,monospace">{candidate_code}</strong>
  </p>
  <p>
    <strong>Keep this code.</strong> It identifies you at every stage from here
    on — the interview, the physical interview at the campus, the enrolment
    form, and onboarding. Quote it in any email you send us, and bring it with
    you when you come to campus.
  </p>
  <p>Program: {program_title}</p>
  <p>
    We will email you again when interview scheduling opens. Nothing is
    required from you until then.
  </p>
  <p style="color:#666;font-size:14px">Saylani Mass IT Training</p>
</div>"""

    try:
        message_id = send_email(
            to=to, subject=subject, html_body=html_body, text_body=text_body
        )
        logger.info(
            "Registration confirmation sent", extra={"code": candidate_code, "id": message_id}
        )
    except Exception:
        # Deliberately broad: any failure here is non-fatal by design, and the
        # one thing that must not happen is it reaching the candidate as an
        # error on a registration that actually succeeded.
        logger.exception(
            "Registration confirmation FAILED to send for %s (%s) — "
            "application was still created; resend by hand",
            candidate_code,
            to,
        )
