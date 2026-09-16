"""Bulk export of candidates' onboarding records, handed to an HOD as a ZIP.

One archive per send, containing a folder per candidate — their approved
uploaded documents in whatever format they arrived, plus their four onboarding
forms rendered to PDF at this moment (see `onboarding_pdf_service`; nothing is
stored). The HOD gets an email with a link, not an attachment.

## Why it streams

A 50-candidate archive is a few hundred MB in practice and can reach ~3.85 GB
at the sizes the upload validator permits: 7 document slots at 5 MB, two of
them accepting many files each. Nothing here may hold an archive, and nothing
may hold a whole document either. So:

    storage --(64 KB chunks)--> zip generator --(chunks)--> storage

`zipstream-ng` yields the archive as it is built and httpx sends any byte
iterable chunked, so the two ends join up and memory stays flat at roughly one
chunk plus one rendered PDF, whatever the total size.

## Why it runs in the background

The work is minutes, not milliseconds, and the admin should not hold a browser
tab open through it. The route validates, answers immediately, and hands the
real work to `run_export` on FastAPI's background tasks — the same pattern the
registration confirmation email already uses. That task owns its own database
session, because the request's session is closed by the time it runs.

## What "eligible" means here

Every required document approved, nothing pending, nothing rejected, and all
four forms in — `documents_settled` below. Deliberately stricter than the
Agilytics population, which is a stage check only (FORM/ONBOARDED) and would
include candidates whose paperwork an admin has not finished reviewing.
"""

import logging
import re
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session
from zipstream import ZipStream

from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError
from app.db.session import get_session_factory
from app.integrations import supabase_storage
from app.models.application import Application
from app.models.bootcamp import Bootcamp
from app.models.enums import DocumentStatus
from app.models.onboarding import OnboardingDocument, OnboardingFormSubmission
from app.models.user import Profile
from app.schemas.document_export import (
    DocumentExportCandidate,
    DocumentExportEligibleList,
    DocumentExportQueued,
)
from app.services import (
    audit_service,
    bootcamp_service,
    email_service,
    onboarding_document_service,
    onboarding_form_service,
    onboarding_pdf_service,
)

logger = logging.getLogger(__name__)

# Trimmed from anything that reaches a ZIP entry name. Windows refuses these
# outright and an archive an HOD cannot extract is worse than a clumsy name.
_UNSAFE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _safe(name: str) -> str:
    return _UNSAFE.sub("_", name).strip(" .") or "file"


def documents_settled(summary) -> bool:
    """Whether this candidate's paperwork is genuinely finished.

    Every required slot covered by an approved file, nothing still waiting on
    a reviewer, nothing sent back. The `documents_approved >= documents_required`
    half matters: without it a candidate who has uploaded nothing at all counts
    as settled, since zero pending and zero rejected is trivially true.
    """
    return (
        summary.hub_unlocked
        and summary.documents_pending == 0
        and summary.documents_rejected == 0
        and summary.documents_approved >= summary.documents_required
        and summary.documents_required > 0
    )


def _bootcamp(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> Bootcamp:
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
    bootcamp = db.get(Bootcamp, bootcamp_id)
    if bootcamp is None:
        raise NotFoundError("Bootcamp not found.")
    return bootcamp


def eligible(db: Session, actor: Profile, bootcamp_id: uuid.UUID) -> DocumentExportEligibleList:
    """Who can be exported, and which of them have been sent before.

    Read-only. The modal's two tabs are both served from this one response —
    "not yet sent" is the same list filtered on `exported_at is None`, not a
    second query that could disagree with the first.
    """
    _bootcamp(db, actor, bootcamp_id)

    rows = db.execute(
        select(Application, Profile)
        .join(Profile, Profile.id == Application.profile_id)
        .where(
            Application.bootcamp_id == bootcamp_id,
            Application.stage.in_(onboarding_document_service.ONBOARDING_LIST_STAGES),
        )
        .order_by(Application.candidate_code)
    ).all()

    candidates = []
    for application, profile in rows:
        summary = onboarding_document_service.summary_for(db, application, profile)
        if not documents_settled(summary):
            continue
        candidates.append(
            DocumentExportCandidate(
                application_id=application.id,
                candidate_code=application.candidate_code,
                full_name=profile.full_name,
                documents_approved=summary.documents_approved,
                exported_at=application.documents_exported_at,
            )
        )

    return DocumentExportEligibleList(candidates=candidates)


def queue_export(
    db: Session,
    actor: Profile,
    bootcamp_id: uuid.UUID,
    *,
    application_ids: list[uuid.UUID],
    recipient_email: str,
    sender_name: str,
) -> DocumentExportQueued:
    """Validate the request so the admin hears about a mistake immediately.

    Everything expensive happens afterwards in `run_export`. What is checked
    here is only what the admin can still fix while looking at the modal: that
    the intake is theirs, that the selection is real, and that each candidate
    named is genuinely finished. A candidate whose paperwork is incomplete is
    refused by name rather than quietly dropped from the archive.
    """
    bootcamp = _bootcamp(db, actor, bootcamp_id)
    if not application_ids:
        raise ConflictError("Select at least one candidate to export.")

    allowed = {c.application_id: c for c in eligible(db, actor, bootcamp_id).candidates}
    missing = [str(a) for a in application_ids if a not in allowed]
    if missing:
        raise ConflictError(
            "Some of those candidates are not ready to export — their documents "
            "are not all approved.",
            details=missing,
        )

    audit_service.record(
        db,
        actor=actor,
        action="document_export.queued",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=(
            f"Queued a document export of {len(application_ids)} candidate(s) "
            f"to {recipient_email}"
        ),
        metadata={
            "recipient": recipient_email,
            "sender_name": sender_name,
            "candidates": [allowed[a].candidate_code for a in application_ids],
        },
    )
    db.commit()

    return DocumentExportQueued(
        queued=len(application_ids),
        recipient_email=recipient_email,
        message=(
            f"Preparing {len(application_ids)} candidate record(s). "
            f"{recipient_email} will receive the download link shortly."
        ),
    )


# ------------------------------------------------------------- the archive --


def _entries(db: Session, bootcamp: Bootcamp, application_ids: list[uuid.UUID]) -> list[tuple]:
    """Everything going into the archive, in the order it should appear.

    Resolved up front, while the session is open, so the generator that
    actually streams does not have to hold a database connection across a
    multi-minute upload. Documents are named but not read here — only their
    storage paths travel forward.

    Two orderings, both deliberate:

      * candidate folders by candidate code, so B08-009 cannot land before
        B08-007 in the archive an HOD opens; and
      * files within one candidate's multi-file type by `created_at`, which is
        upload order. `checklist` used to impose no order at all, so the same
        candidate's certificates could come out differently on two runs.
    """
    rows = db.execute(
        select(Application, Profile)
        .join(Profile, Profile.id == Application.profile_id)
        .where(Application.id.in_(application_ids))
        .order_by(Application.candidate_code)
    ).all()

    entries: list[tuple] = []
    for application, profile in rows:
        folder = _safe(application.candidate_code)

        documents = db.scalars(
            select(OnboardingDocument)
            .where(
                OnboardingDocument.application_id == application.id,
                OnboardingDocument.status == DocumentStatus.ACCEPTED,
            )
            .order_by(OnboardingDocument.doc_type, OnboardingDocument.created_at)
        ).all()

        # Numbered per type so a folder listing keeps upload order even in a
        # viewer that sorts alphabetically, and so two files that arrived with
        # the same name do not collide.
        seen: dict[str, int] = {}
        for document in documents:
            key = document.doc_type.value.lower()
            seen[key] = seen.get(key, 0) + 1
            suffix = f"-{seen[key]}" if seen[key] > 1 else ""
            name = f"{key}{suffix}-{_safe(document.file_name)}"
            entries.append(("document", f"{folder}/{name}", document.storage_path))

        submissions = {
            s.form_type: s
            for s in db.scalars(
                select(OnboardingFormSubmission).where(
                    OnboardingFormSubmission.application_id == application.id
                )
            )
        }
        for index, form_type in enumerate(onboarding_pdf_service.FORM_ORDER, start=1):
            submission = submissions.get(form_type)
            if submission is None or submission.submitted_data is None:
                continue
            label = _safe(onboarding_pdf_service.FORM_LABEL[form_type])
            entries.append(
                (
                    "form",
                    f"{folder}/{index}-{label}.pdf",
                    (
                        form_type,
                        submission.submitted_data,
                        application.candidate_code,
                        profile.full_name,
                        bootcamp.name,
                        submission.submitted_at,
                    ),
                )
            )

    return entries


def _archive(entries: list[tuple]) -> ZipStream:
    """The archive, as a generator that has not read anything yet.

    Stored rather than deflated: these are JPEGs, PNGs and PDFs, all already
    compressed. Deflate would spend CPU on every byte of a multi-GB export to
    save almost nothing.
    """
    stream = ZipStream(sized=False)

    for kind, arcname, payload in entries:
        if kind == "document":
            # A closure per entry so nothing is fetched until the generator
            # reaches it — `path=payload` binds the value, not the loop var.
            def fetch(path: str = payload) -> Iterator[bytes]:
                yield from supabase_storage.stream_document(path)

            stream.add(fetch(), arcname=arcname)
        else:
            form_type, data, code, name, bootcamp_name, submitted_at = payload

            def render(
                form_type=form_type,
                data=data,
                code=code,
                name=name,
                bootcamp_name=bootcamp_name,
                submitted_at=submitted_at,
            ) -> Iterator[bytes]:
                yield onboarding_pdf_service.render_form(
                    form_type=form_type,
                    data=data,
                    candidate_code=code,
                    candidate_name=name,
                    bootcamp_name=bootcamp_name,
                    submitted_at=submitted_at,
                )

            stream.add(render(), arcname=arcname)

    return stream


def _zip_name(bootcamp: Bootcamp) -> str:
    return f"Bootcamp-{bootcamp.bootcamp_number:02d}-Docs.zip"


def run_export(
    *,
    bootcamp_id: uuid.UUID,
    application_ids: list[uuid.UUID],
    recipient_email: str,
    sender_name: str,
    actor_id: uuid.UUID,
) -> None:
    """Build the archive, upload it, email the link, stamp the candidates.

    Runs as a background task with its own session: the request's is long
    closed. Never raises — a failure here cannot reach the admin's browser,
    so it is logged and the candidates are left unstamped, which is what keeps
    them offered on the next attempt.
    """
    factory = get_session_factory()
    with factory() as db:
        try:
            bootcamp = db.get(Bootcamp, bootcamp_id)
            actor = db.get(Profile, actor_id)
            if bootcamp is None or actor is None:
                logger.error("Export aborted: bootcamp or actor no longer exists.")
                return

            entries = _entries(db, bootcamp, application_ids)
            if not entries:
                logger.error("Export aborted: nothing to archive for %s.", bootcamp_id)
                return

            supabase_storage.ensure_exports_bucket()

            zip_name = _zip_name(bootcamp)
            path = f"{bootcamp_id}/{uuid.uuid4().hex}/{zip_name}"

            # The whole point: the archive is generated and uploaded as one
            # continuous pass, never assembled first.
            supabase_storage.upload_export(path, _archive(entries))
            url = supabase_storage.export_signed_url(path)

            codes = sorted(
                {arcname.split("/")[0] for _kind, arcname, _payload in entries}
            )
            sent = email_service.send_document_export(
                to=recipient_email,
                sender_name=sender_name,
                bootcamp_name=bootcamp.name,
                candidate_count=len(codes),
                download_url=url,
                zip_name=zip_name,
            )

            if not sent:
                # The archive exists and the link is valid, but nobody has been
                # told — so nothing is stamped, and the admin can send again.
                logger.error(
                    "Export for %s uploaded but the email to %s failed; not stamping.",
                    bootcamp_id,
                    recipient_email,
                )
                return

            stamped_at = datetime.now(UTC)
            for application in db.scalars(
                select(Application).where(Application.id.in_(application_ids))
            ):
                application.documents_exported_at = stamped_at

            audit_service.record(
                db,
                actor=actor,
                action="document_export.sent",
                entity_type="bootcamp",
                entity_id=bootcamp.id,
                summary=f"Sent {len(codes)} candidate record(s) to {recipient_email}",
                metadata={
                    "recipient": recipient_email,
                    "sender_name": sender_name,
                    "candidates": codes,
                    "zip_name": zip_name,
                    "storage_path": path,
                },
            )
            db.commit()
            logger.info(
                "Export sent: %s candidate(s) to %s (%s).", len(codes), recipient_email, zip_name
            )
        except Exception:
            db.rollback()
            logger.exception("Document export failed for bootcamp %s.", bootcamp_id)
