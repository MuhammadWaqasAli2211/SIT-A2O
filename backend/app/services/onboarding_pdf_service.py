"""Rendering a candidate's submitted onboarding forms to PDF, at export time.

Nothing here is stored. The forms live as JSON in
`onboarding_form_submissions` and stay that way — a PDF is built when a bulk
export asks for one and is written straight into the archive, so there is no
second copy of a candidate's answers to keep in step with the first.

## Why this draws rather than converts

The candidate-facing forms are React components printed with `window.print()`.
There is no server-side equivalent of that, and the options for getting one —
WeasyPrint, wkhtmltopdf — both need system libraries installed alongside
Python, which is a deployment problem on every host this might run on.

So these are drawn directly with reportlab instead. The consequence is worth
stating plainly: **the PDF is not a pixel copy of the on-screen form.** It is
a clean, readable rendering of the same answers, in the same order, with the
same labels. If an exact visual replica is ever required, that is a different
job and this is the wrong approach for it.

## What the data looks like

Each submission is a flat `{field: value}` dict — between 5 and 49 fields
depending on the form. Values are strings, numbers, booleans, nulls, and
occasionally a base64 `data:image/png` URL: the candidate's photo (~217 KB)
on two of the forms, and the two signatures (~3 KB each) on the Half Nama.
Those are placed as images; everything else is a label and a value.

Field *order* comes from the dict, which preserves insertion order from the
submission — the order the candidate filled them in, which is the order the
form itself defines. Labels are derived from the key, because the form
definitions live in the frontend and duplicating them here would be a second
copy to keep in step.
"""

import base64
import binascii
import io
import logging
import re
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.enums import OnboardingFormType

logger = logging.getLogger(__name__)

FORM_LABEL: dict[OnboardingFormType, str] = {
    OnboardingFormType.BACKGROUND_VERIFICATION: "Background Verification Form",
    OnboardingFormType.EMPLOYMENT_APPLICATION: "Employment Application Form",
    OnboardingFormType.HALF_NAMA: "Half Nama / Oath Form",
    OnboardingFormType.BANK_PAYMENT_DETAILS: "Bank & Payment Details",
}

# The order the forms are completed in, which is the order they appear in the
# candidate's folder and therefore the order they should appear in the export.
FORM_ORDER: tuple[OnboardingFormType, ...] = (
    OnboardingFormType.BACKGROUND_VERIFICATION,
    OnboardingFormType.EMPLOYMENT_APPLICATION,
    OnboardingFormType.HALF_NAMA,
    OnboardingFormType.BANK_PAYMENT_DETAILS,
)

_BRAND = colors.HexColor("#1800AD")
_MUTED = colors.HexColor("#6b7280")
_RULE = colors.HexColor("#e5e7eb")

# A photo is portrait and wants to stay that way; a signature is a wide, short
# strip. Both are capped so one oversized upload cannot push a page apart.
_PHOTO_MAX = (38 * mm, 48 * mm)
_SIGNATURE_MAX = (60 * mm, 22 * mm)

_DATA_URL = re.compile(r"^data:image/(png|jpe?g|webp);base64,(.+)$", re.IGNORECASE | re.DOTALL)
# Keys whose value is an image get placed rather than printed. Matched on the
# key as well as the value so a stray long string cannot be mistaken for one.
_IMAGE_KEY = re.compile(r"photo|signature|thumb", re.IGNORECASE)


def _label_for(key: str) -> str:
    """A readable label from a camelCase or snake_case field key.

    `page1FatherName` -> "Page 1 father name"; `account_title` -> "Account
    title". Derived rather than mapped because the authoritative labels are in
    the frontend's form definitions, and a copy here would drift the first
    time one of them was reworded.
    """
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", key.replace("_", " "))
    spaced = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", spaced)
    spaced = re.sub(r"\s+", " ", spaced).strip()
    return spaced[:1].upper() + spaced[1:] if spaced else key


def _format_value(value: Any) -> str:
    """One answer, as it should read on the page."""
    if value is None or value == "":
        return "—"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (list, tuple)):
        return ", ".join(_format_value(v) for v in value) if value else "—"
    if isinstance(value, dict):
        return ", ".join(f"{_label_for(k)}: {_format_value(v)}" for k, v in value.items())
    return str(value)


def _as_image(value: Any) -> bytes | None:
    """The decoded bytes of a base64 data URL, or None if this is not one.

    Returns None rather than raising on a malformed payload: a corrupt
    signature should cost that one field, not the candidate's whole export.
    Decoded eagerly so an unreadable image is caught here, where it can be
    skipped, rather than at build time where it would fail the document.
    """
    if not isinstance(value, str):
        return None
    match = _DATA_URL.match(value.strip())
    if match is None:
        return None
    try:
        raw = base64.b64decode(match.group(2), validate=True)
        ImageReader(io.BytesIO(raw)).getSize()  # proves it decodes as an image
        return raw
    except (binascii.Error, ValueError, OSError):
        logger.warning("Unreadable embedded image in a form submission; skipped.")
        return None


def _scaled(raw: bytes, box: tuple[float, float]) -> Image:
    """Fit an image inside `box` without distorting it.

    Two separate readers over the same bytes on purpose: reportlab's Image
    flowable consumes the stream it is given while building, so measuring and
    drawing cannot share one.
    """
    width, height = ImageReader(io.BytesIO(raw)).getSize()
    max_w, max_h = box
    ratio = min(max_w / width, max_h / height)
    return Image(io.BytesIO(raw), width=width * ratio, height=height * ratio)


def render_form(
    *,
    form_type: OnboardingFormType,
    data: dict[str, Any],
    candidate_code: str,
    candidate_name: str | None,
    bootcamp_name: str,
    submitted_at: datetime | None,
) -> bytes:
    """One submitted form as a PDF, in memory.

    Returned as bytes rather than streamed: a rendered form is a few hundred
    KB at most (the candidate photo dominates it), which is small enough to
    hold while it is written into the archive — unlike the uploaded documents
    beside it, which stream.
    """
    buffer = io.BytesIO()
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ExportTitle", parent=styles["Heading1"], fontSize=15, leading=19, textColor=_BRAND
    )
    meta_style = ParagraphStyle(
        "ExportMeta", parent=styles["Normal"], fontSize=8.5, leading=12, textColor=_MUTED
    )
    label_style = ParagraphStyle(
        "FieldLabel", parent=styles["Normal"], fontSize=8, leading=11, textColor=_MUTED
    )
    value_style = ParagraphStyle("FieldValue", parent=styles["Normal"], fontSize=9.5, leading=13)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"{candidate_code} — {FORM_LABEL[form_type]}",
        author="Saylani Mass IT Training",
    )

    story: list[Any] = [
        Paragraph(FORM_LABEL[form_type], title_style),
        Spacer(1, 2 * mm),
        Paragraph(
            f"{candidate_code}"
            + (f" — {candidate_name}" if candidate_name else "")
            + f"<br/>{bootcamp_name}"
            + (
                f"<br/>Submitted {submitted_at:%d %b %Y, %H:%M} UTC"
                if submitted_at
                else "<br/>Submission date not recorded"
            ),
            meta_style,
        ),
        Spacer(1, 6 * mm),
    ]

    # Text fields first as a two-column table, images afterwards — mixing an
    # image into a field table makes the row heights fight the page break.
    rows: list[list[Any]] = []
    images: list[tuple[str, bytes]] = []

    for key, value in data.items():
        raw = _as_image(value) if _IMAGE_KEY.search(key) else None
        if raw is not None:
            images.append((_label_for(key), raw))
            continue
        # A data URL under an unexpected key would otherwise print as a wall
        # of base64; it is still an image, just not one we can label well.
        if isinstance(value, str) and _DATA_URL.match(value.strip()):
            unexpected = _as_image(value)
            if unexpected is not None:
                images.append((_label_for(key), unexpected))
                continue
        rows.append(
            [
                Paragraph(_label_for(key), label_style),
                Paragraph(_format_value(value).replace("&", "&amp;").replace("<", "&lt;"), value_style),
            ]
        )

    if rows:
        table = Table(rows, colWidths=[55 * mm, None], hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LINEBELOW", (0, 0), (-1, -2), 0.4, _RULE),
                    ("LEFTPADDING", (0, 0), (0, -1), 0),
                ]
            )
        )
        story.append(table)

    for label, raw in images:
        box = _PHOTO_MAX if "photo" in label.lower() else _SIGNATURE_MAX
        story.append(Spacer(1, 6 * mm))
        story.append(
            KeepTogether([Paragraph(label, label_style), Spacer(1, 2 * mm), _scaled(raw, box)])
        )

    if not rows and not images:
        story.append(Paragraph("This form was submitted with no answers recorded.", value_style))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()


def _footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(_MUTED)
    canvas.drawString(18 * mm, 10 * mm, "Saylani Mass IT Training")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()
