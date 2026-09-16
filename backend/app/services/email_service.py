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

from app.core.config import settings
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


# ------------------------------------ physical interview outcome emails --
# Both are sent from `physical_interview_service.record_result`, after the
# stage move is already committed. They follow send_registration_confirmation's
# contract exactly: never raise, log the candidate code on failure so a
# missing message can be traced and resent by hand. A decision that has been
# recorded must not be reported back to the admin as a failure because Gmail
# was unreachable.


def _shell(body_html: str) -> str:
    """The wrapper every transactional email shares.

    Extracted when the outcome emails below were added rather than pasting a
    third copy of the same container and footer.
    """
    return f"""\
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;
            color:#1f2937;max-width:600px">
{body_html}
  <p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;
            color:#9ca3af;font-size:13px">
    Saylani Mass IT Training
  </p>
</div>"""


def _deliver(*, to: str, subject: str, html_body: str, text_body: str, what: str, code: str) -> bool:
    """Send, swallow, and say whether it worked.

    Returns rather than raises so a caller sending to a whole cohort can
    count failures and report them, while a caller sending one message can
    ignore the result exactly as before.
    """
    try:
        message_id = send_email(to=to, subject=subject, html_body=html_body, text_body=text_body)
        logger.info("%s sent", what, extra={"code": code, "id": message_id})
        return True
    except Exception:
        logger.exception(
            "%s FAILED to send for %s (%s). The decision was still recorded; "
            "resend by hand.",
            what,
            code,
            to,
        )
        return False


def send_physical_interview_selected(
    *, to: str, full_name: str | None, candidate_code: str, bootcamp_name: str
) -> None:
    """Tell a candidate they cleared the Physical Interview, and what to do next.

    The single action is the onboarding form in Student's Folder, so the email
    says that once, plainly, with one link. Everything the candidate has to do
    is inside that tab — listing the four forms here would only go stale
    against the sequence the folder itself enforces.
    """
    name = (full_name or "").strip() or "there"
    folder_url = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/documents"

    subject = f"You have been selected — {candidate_code}"

    text_body = (
        f"Hi {name},\n\n"
        f"Congratulations. You have cleared the Physical Interview for "
        f"{bootcamp_name} and have been selected to continue.\n\n"
        "WHAT TO DO NEXT\n"
        "Sign in to your bootcamp portal and open Student's Folder, then "
        "complete the onboarding form. You will be asked to upload your "
        "documents once the form is done.\n\n"
        f"{folder_url}\n\n"
        f"Quote your candidate code, {candidate_code}, in any email you send "
        "us.\n\n"
        "Please complete this promptly — your place is confirmed only once "
        "your paperwork has been submitted and approved.\n\n"
        "Saylani Mass IT Training"
    )

    html_body = _shell(f"""\
  <p style="font-size:16px">Hi {name},</p>

  <p>
    Congratulations. You have cleared the Physical Interview for
    <strong>{bootcamp_name}</strong> and have been selected to continue.
  </p>

  <div style="margin:24px 0;padding:18px 20px;background:#f0fdf4;
              border-left:4px solid #16a34a;border-radius:6px">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1px;
              text-transform:uppercase;color:#15803d">What to do next</p>
    <p style="margin:0;color:#166534">
      Sign in to your bootcamp portal, open <strong>Student's Folder</strong>,
      and complete the onboarding form. You will be asked to upload your
      documents once the form is done.
    </p>
  </div>

  <p style="margin:24px 0">
    <a href="{folder_url}"
       style="display:inline-block;padding:12px 22px;background:#1800AD;color:#ffffff;
              text-decoration:none;border-radius:6px;font-weight:600">
      Open Student's Folder
    </a>
  </p>

  <p style="color:#6b7280">
    Quote your candidate code,
    <strong style="font-family:ui-monospace,'SF Mono',Consolas,monospace;
                   color:#1f2937">{candidate_code}</strong>,
    in any email you send us.
  </p>

  <p style="margin:18px 0 0;padding:12px 16px;background:#f9fafb;
            border-radius:6px;font-size:14px;color:#374151">
    Please complete this promptly — your place is confirmed only once your
    paperwork has been submitted and approved.
  </p>""")

    _deliver(
        to=to,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        what="Physical Interview selection email",
        code=candidate_code,
    )


def send_physical_interview_rejected(
    *, to: str, full_name: str | None, candidate_code: str, bootcamp_name: str
) -> None:
    """Tell a candidate their application ended at the Physical Interview.

    Deliberately short, and deliberately carries no reason: the note an admin
    records against the invite is an internal one, and `record_result` never
    passes it here. Saying "we cannot enter into individual correspondence"
    would be the honest reading of a decision that is final, so the email says
    the round is closed and points at the next intake instead.
    """
    name = (full_name or "").strip() or "there"

    subject = f"Your application to {bootcamp_name} — {candidate_code}"

    text_body = (
        f"Hi {name},\n\n"
        f"Thank you for attending the Physical Interview for {bootcamp_name}.\n\n"
        "After careful consideration, your application has not been taken "
        "forward on this occasion. We know this is disappointing, and we do "
        "not say it lightly — places in each intake are limited, and many "
        "capable candidates are not able to be accommodated.\n\n"
        "You are welcome to apply again when the next intake opens. Nothing "
        "about this decision counts against a future application.\n\n"
        f"Your candidate code for this application was {candidate_code}.\n\n"
        "We wish you the very best.\n\n"
        "Saylani Mass IT Training"
    )

    html_body = _shell(f"""\
  <p style="font-size:16px">Hi {name},</p>

  <p>
    Thank you for attending the Physical Interview for
    <strong>{bootcamp_name}</strong>.
  </p>

  <p>
    After careful consideration, your application has not been taken forward on
    this occasion. We know this is disappointing, and we do not say it lightly
    — places in each intake are limited, and many capable candidates are not
    able to be accommodated.
  </p>

  <div style="margin:24px 0;padding:18px 20px;background:#f9fafb;
              border-left:4px solid #9ca3af;border-radius:6px">
    <p style="margin:0;color:#374151">
      You are welcome to apply again when the next intake opens. Nothing about
      this decision counts against a future application.
    </p>
  </div>

  <p style="color:#6b7280">
    Your candidate code for this application was
    <strong style="font-family:ui-monospace,'SF Mono',Consolas,monospace;
                   color:#1f2937">{candidate_code}</strong>.
  </p>

  <p>We wish you the very best.</p>""")

    _deliver(
        to=to,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        what="Physical Interview rejection email",
        code=candidate_code,
    )


# ------------------------------------------- Agilytics onboarding email --
# Sent from `agilytics_service.onboard`, once per candidate their API
# confirmed as a member. Same never-raise contract as the outcome emails
# above, and for a stronger reason: the membership already exists on their
# side by the time this runs, so a mail failure must not make a completed
# handover look like a failed one.
#
# Two of the values in this message are assumptions rather than documented
# fact, and both live in configuration so confirming them is a settings
# change and not an edit here:
#
#   settings.agilytics_login_url           where a student signs in
#   settings.agilytics_password_reset_url  where they set their password
#
# Agilytics' spec documents neither. It says student accounts are created
# "auto-verified, no confirmation email" and stops, so how somebody actually
# gets in for the first time is inferred: an account exists against their
# address, but nobody has ever given them a password, therefore the first
# step has to be setting one. `/reset-password` is a convention, not a
# promise. If their real flow turns out to be a magic link or an invitation
# they send themselves, the wording below needs revisiting and not just the
# URLs — which is why the steps are written as prose in one place rather
# than scattered.


def send_agilytics_onboarded(
    *, to: str, full_name: str | None, candidate_code: str, bootcamp_name: str
) -> bool:
    """Tell a candidate they are in the Agilytics workspace, and how to log in.

    The whole job of this email is the first login. They have been added to a
    system they have never heard of, with an account they never created and
    no password — so the instructions are numbered, the address they must use
    is stated explicitly (it is the one thing they can get wrong), and the
    password step comes first because nothing else works before it.
    """
    name = (full_name or "").strip() or "there"
    login_url = settings.agilytics_login_url
    reset_url = settings.agilytics_password_reset_url

    subject = f"Your Agilytics access — {bootcamp_name}"

    text_body = (
        f"Hi {name},\n\n"
        f"You have been onboarded to Agilytics, the platform where the rest of "
        f"your {bootcamp_name} journey takes place — your track, your progress "
        "and your coursework all live there from here on.\n\n"
        "An account has already been created for you using this email address:\n"
        f"    {to}\n\n"
        "HOW TO GET IN (first time)\n"
        "1. Set your password. You do not have one yet, so start here:\n"
        f"   {reset_url}\n"
        "   Enter the email address above and follow the link they send you.\n"
        "2. Sign in with that email address and your new password:\n"
        f"   {login_url}\n\n"
        "Use the same email address at both steps — your account is tied to "
        "it, and a different address will not find it.\n\n"
        f"Your candidate code is {candidate_code}. Quote it in any email you "
        "send us.\n\n"
        "If the password step does not recognise your address, reply to this "
        "email and we will sort it out.\n\n"
        "Saylani Mass IT Training"
    )

    html_body = _shell(f"""\
  <p style="font-size:16px">Hi {name},</p>

  <p>
    You have been onboarded to <strong>Agilytics</strong>, the platform where
    the rest of your {bootcamp_name} journey takes place — your track, your
    progress and your coursework all live there from here on.
  </p>

  <p style="margin:0 0 6px">An account has already been created for you using this email address:</p>
  <p style="margin:0 0 24px;padding:10px 14px;background:#f9fafb;border-radius:6px;
            font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:14px">
    {to}
  </p>

  <div style="margin:24px 0;padding:18px 20px;background:#f5f3ff;
              border-left:4px solid #1800AD;border-radius:6px">
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1px;
              text-transform:uppercase;color:#1800AD">How to get in — first time</p>

    <p style="margin:0 0 10px;color:#312e81">
      <strong>1. Set your password.</strong> You do not have one yet, so start
      here and enter the email address above:
    </p>
    <p style="margin:0 0 16px">
      <a href="{reset_url}" style="color:#1800AD;font-weight:600">{reset_url}</a>
    </p>

    <p style="margin:0 0 10px;color:#312e81">
      <strong>2. Sign in</strong> with that same email address and your new
      password:
    </p>
    <p style="margin:0">
      <a href="{login_url}" style="color:#1800AD;font-weight:600">{login_url}</a>
    </p>
  </div>

  <p style="margin:24px 0">
    <a href="{reset_url}"
       style="display:inline-block;padding:12px 22px;background:#1800AD;color:#ffffff;
              text-decoration:none;border-radius:6px;font-weight:600">
      Set your password
    </a>
  </p>

  <p style="color:#6b7280">
    Use the same email address at both steps — your account is tied to it, and
    a different address will not find it.
  </p>

  <p style="color:#6b7280">
    Your candidate code is
    <strong style="font-family:ui-monospace,'SF Mono',Consolas,monospace;
                   color:#1f2937">{candidate_code}</strong>.
    Quote it in any email you send us.
  </p>

  <p style="margin:18px 0 0;padding:12px 16px;background:#f9fafb;
            border-radius:6px;font-size:14px;color:#374151">
    If the password step does not recognise your address, reply to this email
    and we will sort it out.
  </p>""")

    return _deliver(
        to=to,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        what="Agilytics onboarding email",
        code=candidate_code,
    )


# ------------------------------------------- bulk document export to an HOD --
# Sent from `document_export_service.run_export`, once the archive is uploaded
# and its link signed. Same never-raise contract as the outcome emails above,
# and the caller treats a False return as "do not stamp anybody as exported",
# so a failure here leaves the whole batch re-sendable rather than lost.
#
# `sender_name` is the admin who pressed the button. It appears in the body
# only — the From header stays the configured Gmail mailbox, which is not
# something this can or should change.


def send_document_export(
    *,
    to: str,
    sender_name: str,
    bootcamp_name: str,
    candidate_count: int,
    download_url: str,
    zip_name: str,
) -> bool:
    """Hand an HOD the link to a candidate-records archive.

    The link is the whole message, so it appears twice — as the button and as
    text beneath it — because a button that does not survive an email client's
    rendering leaves the reader with nothing to click.

    The expiry is stated plainly rather than left to be discovered: the link
    lasts 24 hours, and an HOD who opens the mail on day three needs to know
    to ask rather than assume the export failed.
    """
    people = f"{candidate_count} candidate{'' if candidate_count == 1 else 's'}"
    subject = f"{bootcamp_name} — onboarding records for {people}"

    text_body = (
        "Hello,\n\n"
        f"{sender_name} has sent you the onboarding records for {people} "
        f"from {bootcamp_name}.\n\n"
        "The archive contains one folder per candidate, named by their "
        "candidate code, holding their approved documents and their completed "
        "onboarding forms.\n\n"
        f"Download ({zip_name}):\n"
        f"{download_url}\n\n"
        "This link is valid for 24 hours. If it has expired by the time you "
        "open this, reply and we will send a fresh one.\n\n"
        f"Regards,\n{sender_name}\n"
        "Saylani Mass IT Training"
    )

    html_body = _shell(f"""\
  <p style="font-size:16px">Hello,</p>

  <p>
    <strong>{sender_name}</strong> has sent you the onboarding records for
    <strong>{people}</strong> from <strong>{bootcamp_name}</strong>.
  </p>

  <p style="color:#374151">
    The archive contains one folder per candidate, named by their candidate
    code, holding their approved documents and their completed onboarding
    forms.
  </p>

  <p style="margin:28px 0">
    <a href="{download_url}"
       style="display:inline-block;padding:13px 24px;background:#1800AD;color:#ffffff;
              text-decoration:none;border-radius:6px;font-weight:600">
      Download Documents as .zip
    </a>
  </p>

  <p style="margin:0 0 6px;font-size:13px;color:#6b7280">
    If the button does not work, copy this link:
  </p>
  <p style="margin:0 0 24px;padding:10px 14px;background:#f9fafb;border-radius:6px;
            font-size:12px;word-break:break-all">
    <a href="{download_url}" style="color:#1800AD">{download_url}</a>
  </p>

  <p style="margin:18px 0 0;padding:12px 16px;background:#f9fafb;
            border-radius:6px;font-size:14px;color:#374151">
    This link is valid for <strong>24 hours</strong>. If it has expired by the
    time you open this, reply and we will send a fresh one.
  </p>

  <p style="margin-top:24px">
    Regards,<br />
    <strong>{sender_name}</strong>
  </p>""")

    return _deliver(
        to=to,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        what="Document export email",
        code=zip_name,
    )
