"""Outbound email for the recruitment workflow itself.

Interview invitations, batch results, and onboarding links all go through
here. Supabase's own SMTP config is separate and only handles Supabase Auth's
built-in emails (signup confirmation, password reset) — it is never called
from this module.

Every attempt is written to `email_log`, successful or not, so an admin can
answer "did this candidate actually get it?" without mailbox access.
"""

import html
import logging
import re
import uuid
from string import Template

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, aliased

from app.core.exceptions import AppError, ConflictError
from app.integrations import gmail_api
from app.models.application import Application
from app.models.enums import ApplicationStage, EmailStatus
from app.models.ops import EmailLog
from app.models.user import Profile
from app.schemas.ops import EmailLogRow, EmailSendResult
from app.services import audit_service, bootcamp_service

# Placeholders an admin may use in a subject or body. Rendered with
# string.Template, not f-strings or format(), so an unmatched brace in
# admin-authored copy cannot raise.
_MERGE_FIELDS = ("candidate_name", "candidate_code", "program", "bootcamp", "email")

logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, html_body: str, text_body: str | None = None) -> str:
    """Send one email. Returns the provider's message id.

    Kept as the single choke point through which all provider traffic passes,
    so swapping Gmail for Resend later touches this function and nothing else.
    """
    return gmail_api.send_email(
        to=to, subject=subject, html_body=html_body, text_body=text_body
    )


def render(template: str, context: dict[str, str]) -> str:
    """Substitute $candidate_name style placeholders, leaving unknown ones as-is.

    `safe_substitute` rather than `substitute`: an admin who mistypes a
    placeholder should see it in the sent mail and fix it, not have the whole
    batch fail at send time.
    """
    return Template(template).safe_substitute(
        {key: context.get(key, "") for key in _MERGE_FIELDS}
    )


def render_partial(template: str, context: dict[str, str]) -> str:
    """Substitute only the keys given, leaving every other placeholder intact.

    The same `string.Template` mechanism as `render()`, not a second one — the
    difference is that `render()` blanks any known merge field the context is
    missing, which is right for the final pass and wrong for an earlier one.
    This exists for values that are the same for a whole batch (an interview
    deadline, say): substituted once up front, with the per-candidate fields
    left for `render()` to fill in per recipient.
    """
    return Template(template).safe_substitute(context)


def _plain_text(html_body: str) -> str:
    """A readable text/plain fallback, since we only ever author HTML."""
    text = re.sub(r"<br\s*/?>|</p>|</div>|</h[1-6]>", "\n", html_body, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()


def _context_for(application: Application, profile: Profile) -> dict[str, str]:
    return {
        "candidate_name": profile.full_name or "there",
        "candidate_code": application.candidate_code,
        "program": application.program.title,
        "bootcamp": application.bootcamp.name,
        "email": profile.email,
    }


def _send_and_log(
    db: Session,
    *,
    application: Application,
    profile: Profile,
    subject: str,
    body_html: str,
    template: str | None,
    actor: Profile,
) -> bool:
    """Send one message and record the outcome. Never raises for a send failure.

    A failed recipient must not abort the rest of a 200-person batch, so the
    provider error is captured into the log row and reported in the summary
    instead of propagating.
    """
    context = _context_for(application, profile)
    rendered_subject = render(subject, context)
    rendered_body = render(body_html, context)

    log = EmailLog(
        bootcamp_id=application.bootcamp_id,
        application_id=application.id,
        recipient_email=profile.email,
        subject=rendered_subject,
        template=template,
        body_html=rendered_body,
        sent_by=actor.id,
    )

    try:
        message_id = send_email(
            to=profile.email,
            subject=rendered_subject,
            html_body=rendered_body,
            text_body=_plain_text(rendered_body),
        )
    except AppError as exc:
        log.status = EmailStatus.FAILED
        log.error = f"{exc.code}: {exc.message}"[:500]
        db.add(log)
        return False

    log.status = EmailStatus.SENT
    log.provider_message_id = message_id
    db.add(log)
    return True


def _recipients(db: Session, application_ids: list[uuid.UUID]) -> list[tuple[Application, Profile]]:
    rows = db.execute(
        select(Application, Profile)
        .join(Profile, Profile.id == Application.profile_id)
        .where(Application.id.in_(application_ids))
    ).all()
    return [(app, profile) for app, profile in rows]


def send_to_applications(
    db: Session,
    bootcamp_id: uuid.UUID,
    *,
    application_ids: list[uuid.UUID],
    subject: str,
    body_html: str,
    template: str | None,
    actor: Profile,
) -> EmailSendResult:
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)

    pairs = _recipients(db, application_ids)
    # Addressing by application id is what keeps an admin inside their scope;
    # verify every one of them really belongs to this intake before sending.
    outside = [str(a.id) for a, _ in pairs if a.bootcamp_id != bootcamp_id]
    if outside:
        raise ConflictError(
            "Some applications do not belong to this bootcamp.", details=outside
        )
    if not pairs:
        raise ConflictError("None of those applications exist.")

    return _dispatch(
        db,
        pairs=pairs,
        bootcamp_id=bootcamp_id,
        subject=subject,
        body_html=body_html,
        template=template,
        actor=actor,
        scope="selection",
    )


def broadcast(
    db: Session,
    bootcamp_id: uuid.UUID,
    *,
    stage: ApplicationStage | None,
    subject: str,
    body_html: str,
    template: str | None,
    actor: Profile,
) -> EmailSendResult:
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)

    stmt = (
        select(Application, Profile)
        .join(Profile, Profile.id == Application.profile_id)
        .where(Application.bootcamp_id == bootcamp_id)
    )
    if stage is not None:
        stmt = stmt.where(Application.stage == stage)

    pairs = [(app, profile) for app, profile in db.execute(stmt).all()]
    if not pairs:
        raise ConflictError("No candidates match that filter.")

    return _dispatch(
        db,
        pairs=pairs,
        bootcamp_id=bootcamp_id,
        subject=subject,
        body_html=body_html,
        template=template,
        actor=actor,
        scope=f"stage={stage.value}" if stage else "everyone",
    )


def _dispatch(
    db: Session,
    *,
    pairs: list[tuple[Application, Profile]],
    bootcamp_id: uuid.UUID,
    subject: str,
    body_html: str,
    template: str | None,
    actor: Profile,
    scope: str,
) -> EmailSendResult:
    failures: list[str] = []
    sent = 0

    for application, profile in pairs:
        ok = _send_and_log(
            db,
            application=application,
            profile=profile,
            subject=subject,
            body_html=body_html,
            template=template,
            actor=actor,
        )
        if ok:
            sent += 1
        else:
            failures.append(profile.email)

    audit_service.record(
        db,
        actor=actor,
        action="email.send",
        entity_type="bootcamp",
        entity_id=bootcamp_id,
        summary=f"Emailed {sent} of {len(pairs)} candidates — {subject}",
        metadata={"scope": scope, "sent": sent, "failed": len(failures), "template": template},
    )
    db.flush()

    return EmailSendResult(
        sent=sent, failed=len(failures), total=len(pairs), failures=failures
    )


# ------------------------------------------------------------------ reads --


def _log_query() -> Select:
    sender = aliased(Profile)
    return (
        select(EmailLog, sender.full_name, Application.candidate_code)
        .outerjoin(sender, sender.id == EmailLog.sent_by)
        .outerjoin(Application, Application.id == EmailLog.application_id)
        .order_by(EmailLog.created_at.desc())
    )


def list_log(
    db: Session,
    bootcamp_id: uuid.UUID,
    *,
    status: EmailStatus | None = None,
    search: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> tuple[list[EmailLogRow], int]:
    stmt = _log_query().where(EmailLog.bootcamp_id == bootcamp_id)
    if status is not None:
        stmt = stmt.where(EmailLog.status == status)
    if search:
        needle = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            func.lower(EmailLog.recipient_email).like(needle)
            | func.lower(EmailLog.subject).like(needle)
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(stmt.limit(limit).offset(offset)).all()

    return [
        EmailLogRow(
            id=log.id,
            recipient_email=log.recipient_email,
            subject=log.subject,
            template=log.template,
            status=log.status,
            provider_message_id=log.provider_message_id,
            error=log.error,
            sent_by_name=sender_name,
            candidate_code=candidate_code,
            created_at=log.created_at,
        )
        for log, sender_name, candidate_code in rows
    ], total


def send_registration_confirmation(
    *, to: str, full_name: str, candidate_code: str, bootcamp_name: str, program_title: str
) -> None:
    """Confirm a submitted registration and hand over the candidate code.

    Never raises. Registration has already been committed by the time this
    runs, so a mail failure must not surface as a failed application: the
    candidate is registered whether or not Gmail was reachable. Failures are
    logged with the code so a missing email can be traced and resent by hand.

    The documents section is informational. Nothing is collected at this stage,
    and the email says so, because a list of required paperwork with no context
    reads like a demand and generates support mail.
    """
    name = (full_name or "").strip() or "there"

    subject = f"Your bootcamp application: {candidate_code}"

    text_body = (
        f"Hi {name},\n\n"
        f"Your application to {bootcamp_name} has been received.\n\n"
        f"YOUR CANDIDATE CODE: {candidate_code}\n\n"
        "Keep this code. It identifies you at every stage from here on: the "
        "interview, the physical interview at the campus, the enrolment form, "
        "and onboarding. Quote it in any email you send us, and bring it with "
        "you when you come to campus.\n\n"
        f"Program: {program_title}\n\n"
        "IMPORTANT\n"
        "Stay updated. Keep checking your email on a regular basis. If the "
        "interview is missed, nothing can be done. You must attempt the "
        "interview for further proceedings.\n\n"
        "DOCUMENTS YOU WILL NEED LATER\n"
        "You do not need to send anything now. Just make sure these are ready "
        "when the next stage requires them.\n\n"
        "1. Personal CNIC\n"
        "2. Father's CNIC\n"
        "3. Mother's CNIC\n"
        "4. Updated CV\n"
        "5. All educational documents (certificates and transcripts)\n"
        "6. All experience letters or certificates, if any\n"
        "7. Personal bank account details or cheque\n\n"
        "A personal bank account and personal CNIC are mandatory for "
        "candidates aged 18 and above.\n\n"
        "READ THIS IF YOU ARE UNDER 18\n"
        "In place of a personal CNIC, you will need your B-Form instead.\n"
        "If you do not have a personal bank account, you must have an "
        "Easypaisa or JazzCash account instead.\n\n"
        "Saylani Mass IT Training"
    )

    documents = [
        ("Personal CNIC", "Your own national identity card"),
        ("Father's CNIC", "A clear copy is enough"),
        ("Mother's CNIC", "A clear copy is enough"),
        ("Updated CV", "One page is fine"),
        ("Educational documents", "Certificates and transcripts"),
        ("Experience letters", "Only if you have any"),
        ("Bank account details", "Account details or a cheque"),
    ]
    document_rows = "".join(
        f"""
      <tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top;width:28px">
          <span style="display:inline-block;width:24px;height:24px;line-height:24px;
                       border-radius:12px;background:#dcfce7;color:#15803d;
                       font-size:13px;font-weight:700;text-align:center">{index}</span>
        </td>
        <td style="padding:8px 0;vertical-align:top">
          <strong style="color:#111827">{title}</strong><br>
          <span style="color:#6b7280;font-size:14px">{hint}</span>
        </td>
      </tr>"""
        for index, (title, hint) in enumerate(documents, start=1)
    )

    html_body = f"""\
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;
            color:#1f2937;max-width:600px">
  <p style="font-size:16px">Hi {name},</p>

  <p>Your application to <strong>{bootcamp_name}</strong> has been received.</p>

  <div style="margin:24px 0;padding:18px 20px;background:#f0fdf4;
              border-left:4px solid #16a34a;border-radius:6px">
    <span style="font-size:12px;font-weight:700;letter-spacing:1px;
                 text-transform:uppercase;color:#15803d">Your candidate code</span><br>
    <strong style="font-size:28px;letter-spacing:1px;
                   font-family:ui-monospace,'SF Mono',Consolas,monospace;
                   color:#111827">{candidate_code}</strong>
  </div>

  <p>
    <strong>Keep this code.</strong> It identifies you at every stage from here
    on: the interview, the physical interview at the campus, the enrolment
    form, and onboarding. Quote it in any email you send us, and bring it with
    you when you come to campus.
  </p>

  <p style="color:#6b7280">Program: <strong style="color:#1f2937">{program_title}</strong></p>

  <div style="margin:28px 0;padding:18px 20px;background:#fef2f2;
              border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:6px">
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.5px;
              text-transform:uppercase;color:#b91c1c">Important</p>
    <p style="margin:0;font-weight:600;color:#7f1d1d">
      Stay updated. Keep checking your email on a regular basis. If the
      interview is missed, nothing can be done. You must attempt the interview
      for further proceedings.
    </p>
  </div>

  <h2 style="margin:32px 0 4px;font-size:18px;color:#111827">
    Documents you will need later
  </h2>
  <p style="margin:0 0 16px;color:#6b7280;font-size:14px">
    You do not need to send anything now. Just make sure these are ready when
    the next stage requires them.
  </p>

  <table role="presentation" cellpadding="0" cellspacing="0"
         style="width:100%;border-collapse:collapse">
    <tbody>{document_rows}
    </tbody>
  </table>

  <p style="margin:18px 0 0;padding:12px 16px;background:#f9fafb;
            border-radius:6px;font-size:14px;color:#374151">
    A personal bank account and personal CNIC are mandatory for candidates aged
    18 and above.
  </p>

  <div style="margin:28px 0;padding:18px 20px;background:#fffbeb;
              border:1px solid #fde68a;border-radius:8px">
    <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#92400e">
      Read this if you are under 18
    </p>
    <ul style="margin:0;padding-left:20px;color:#78350f">
      <li style="margin-bottom:6px">
        In place of a personal CNIC, you will need your <strong>B-Form</strong>
        instead.
      </li>
      <li>
        If you do not have a personal bank account, you must have an
        <strong>Easypaisa</strong> or <strong>JazzCash</strong> account instead.
      </li>
    </ul>
  </div>

  <p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;
            color:#9ca3af;font-size:13px">
    Saylani Mass IT Training
  </p>
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
            "Registration confirmation FAILED to send for %s (%s). "
            "Application was still created; resend by hand.",
            candidate_code,
            to,
        )
