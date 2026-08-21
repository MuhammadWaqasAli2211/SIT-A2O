"""Outbound email for the recruitment workflow itself.

Interview invitations, batch results, and onboarding links all go through
here. Supabase's own SMTP config is separate and only handles Supabase Auth's
built-in emails (signup confirmation, password reset) — it is never called
from this module.

Every attempt is written to `email_log`, successful or not, so an admin can
answer "did this candidate actually get it?" without mailbox access.
"""

import html
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
