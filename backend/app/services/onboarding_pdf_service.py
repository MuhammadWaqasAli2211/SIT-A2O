"""Rendering a candidate's submitted onboarding forms to PDF, at export time.

Nothing here is stored. The forms live as JSON in
`onboarding_form_submissions` and stay that way — a PDF is built when a bulk
export asks for one and is written straight into the archive, so there is no
second copy of a candidate's answers to keep in step with the first.

## Why this draws rather than converts, still

The candidate-facing forms are React components printed with `window.print()`.
Getting a byte-identical copy of that would mean a headless browser
navigating a real, running deployment of the frontend from inside an export
job — a new runtime dependency (a browser binary, install step included on
every host this runs on), a new network dependency (this backend reaching a
separately-deployed frontend), and a new attack surface (an unauthenticated
route serving one candidate's answers to whatever loads it). That trade was
considered and declined; see the project's own history for the reasoning.

What follows instead is a **structural** replica: the same sections, in the
same order, with the same tables and the same bilingual labels the on-screen
form uses — reconstructed directly from the React components' JSX rather
than derived from the submitted JSON's own key names, which is what made the
previous version of this file a flat, unsectioned list of "Page1 Father
Name: ..." rows with no relationship to what the candidate actually saw.

That reconstruction is a second copy of the form's structure, and it can
drift from the real one the same way `_label_for` below already accepted
that risk for plain field labels — there is no way to render a specific,
faithful layout without describing that layout somewhere, and the frontend's
own JSX is not something this backend can import.

## Urdu needs its own explanation — see `app.services.urdu_text`

Three of these four forms are bilingual, and the Half Nama is not
"a form with Urdu labels" so much as an Urdu legal document with English
almost absent. Reproducing that needed real Arabic-script shaping, which
reportlab does not have — the module doing that work, and the font
substitution it had to make to get anything to render at all, is documented
there rather than repeated here.

## What the data looks like

Each submission is a flat `{field: value}` dict — between 5 and 49 fields
depending on the form, plus a handful of nested arrays/objects for the
addable tables (education rows, employment history, family details,
references). Values are strings, numbers, booleans, nulls, and occasionally
a base64 `data:image/png` URL: the candidate's photo on two of the forms,
and up to four signatures across the set.
"""

import base64
import binascii
import io
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.enums import OnboardingFormType
from app.services import urdu_text as ur

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------ fonts --

_ASSETS = Path(__file__).resolve().parent.parent / "assets"
NASKH = "NotoNaskhArabic"
NASKH_BOLD = "NotoNaskhArabic-Bold"
registerFont(TTFont(NASKH, str(_ASSETS / "NotoNaskhArabic-Regular.ttf")))
registerFont(TTFont(NASKH_BOLD, str(_ASSETS / "NotoNaskhArabic-Bold.ttf")))

# The on-screen forms use a serif face (`font-serif`) for the two bilingual
# grid forms; Times is reportlab's built-in equivalent, so no font asset is
# needed for the Latin side at all.
SERIF = "Times-Roman"
SERIF_BOLD = "Times-Bold"
SANS = "Helvetica"
SANS_BOLD = "Helvetica-Bold"

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

# The established page counts, from the on-screen print CSS's own "Page X of
# Y" markers and its calibration comments. A form that stops matching this
# after a change here is a regression, not a stylistic drift.
PAGE_COUNT: dict[OnboardingFormType, int] = {
    OnboardingFormType.BACKGROUND_VERIFICATION: 1,
    OnboardingFormType.EMPLOYMENT_APPLICATION: 2,
    OnboardingFormType.HALF_NAMA: 2,
    OnboardingFormType.BANK_PAYMENT_DETAILS: 1,
}

_INK = colors.black
_MUTED = colors.HexColor("#6b7280")
_RULE = colors.HexColor("#e5e7eb")
_HEAD_BG = colors.HexColor("#f5f5f5")

_PHOTO_MAX = (30 * mm, 38 * mm)
_SIGNATURE_MAX = (42 * mm, 16 * mm)

_MARGIN = 12 * mm

_DATA_URL = re.compile(r"^data:image/(png|jpe?g|webp);base64,(.+)$", re.IGNORECASE | re.DOTALL)


# -------------------------------------------------------------- utilities --


def _s(value: Any) -> str:
    """A submitted value, as plain display text. Never None, never "None"."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return str(value).strip()


def _v(value: Any, default: str = "—") -> str:
    text = _s(value)
    return text if text else default


def _digits(value: Any) -> str:
    return re.sub(r"\D", "", _s(value))


def _cnic(value: Any) -> str:
    """13 raw digits -> "12345-1234567-1". Anything else is shown as typed
    rather than mangled by a format it does not fit."""
    d = _digits(value)
    if len(d) == 13:
        return f"{d[0:5]}-{d[5:12]}-{d[12]}"
    return _v(value)


def _ddmmyyyy(value: Any) -> str:
    d = _digits(value)
    if len(d) == 8:
        return f"{d[0:2]}-{d[2:4]}-{d[4:8]}"
    return _v(value)


def _mobile(value: Any) -> str:
    d = _digits(value)
    if len(d) == 11:
        return f"{d[0:4]}-{d[4:11]}"
    return _v(value)


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _as_image(value: Any) -> bytes | None:
    """The decoded bytes of a base64 data URL, or None if this is not one.

    Returns None rather than raising on a malformed payload: a corrupt
    signature should cost that one field, not the candidate's whole export.
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

    Two separate readers over the same bytes: reportlab's Image flowable
    consumes the stream it is given while building, so measuring and drawing
    cannot share one.
    """
    width, height = ImageReader(io.BytesIO(raw)).getSize()
    max_w, max_h = box
    ratio = min(max_w / width, max_h / height)
    return Image(io.BytesIO(raw), width=width * ratio, height=height * ratio)


# ---------------------------------------------------------------- styles --

_TITLE = ParagraphStyle("Title", fontName=SERIF_BOLD, fontSize=14, leading=17, alignment=TA_CENTER)
_TITLE_UR = ParagraphStyle(
    "TitleUr", fontName=NASKH_BOLD, fontSize=13, leading=20, alignment=TA_CENTER
)
_META = ParagraphStyle("Meta", fontName=SANS, fontSize=7.5, leading=10, textColor=_MUTED)
_LABEL = ParagraphStyle("Label", fontName=SERIF, fontSize=6.6, leading=8.5, textColor=colors.black)
_VALUE = ParagraphStyle(
    "Value", fontName=SERIF_BOLD, fontSize=7.6, leading=9.5, spaceBefore=1
)
_SECTION_EN = ParagraphStyle(
    "SectionEn",
    fontName=SANS_BOLD,
    fontSize=8,
    leading=11,
    textColor=colors.white,
    alignment=TA_CENTER,
)
_SECTION_UR = ParagraphStyle(
    "SectionUr", fontName=NASKH_BOLD, fontSize=9.5, leading=14, textColor=colors.white, alignment=TA_CENTER
)
_DECLARATION = ParagraphStyle(
    "Declaration", fontName=SERIF, fontSize=7.6, leading=10.5, alignment=TA_CENTER
)
_DECLARATION_UR = ParagraphStyle(
    "DeclarationUr", fontName=NASKH, fontSize=9, leading=15, alignment=TA_CENTER
)
_TH = ParagraphStyle("TH", fontName=SANS_BOLD, fontSize=6.3, leading=8)
_TD = ParagraphStyle("TD", fontName=SANS, fontSize=6.8, leading=8.8)
_URDU_BODY = ParagraphStyle(
    "UrduBody", fontName=NASKH, fontSize=9.5, leading=17, alignment=TA_JUSTIFY, wordWrap="RTL"
)
_URDU_RIGHT = ParagraphStyle("UrduRight", fontName=NASKH, fontSize=8.5, leading=13, alignment=TA_RIGHT)
_URDU_HEAD = ParagraphStyle(
    "UrduHead", fontName=NASKH_BOLD, fontSize=12, leading=18, alignment=TA_CENTER
)


def _label(en: str, ur_text: str) -> str:
    return ur.bilingual(en, ur_text, urdu_font=NASKH)


def _field_box(en: str, ur_text: str, value: str) -> Paragraph:
    """One bordered field, label and value together — the source form's
    `FieldRow`: a label immediately followed by its filled blank, not a
    label above a separate value."""
    markup = f"{_label(en, ur_text)}<br/><b>{_escape(_v(value))}</b>"
    return Paragraph(markup, ParagraphStyle("Field", parent=_LABEL))


def _grid(rows: list[list[tuple[str, str, str]]], weights: list[list[float]] | None = None) -> list[Table]:
    """A sequence of bordered field rows, each with its own column split —
    the source form's field grid is not one uniform table but a stack of
    rows that each choose their own 1/2/3-way split.
    """
    tables = []
    for i, row in enumerate(rows):
        cells = [_field_box(en, u_, val) for en, u_, val in row]
        row_weights = weights[i] if weights else [1] * len(cells)
        total = sum(row_weights)
        col_widths = [(_CONTENT_W * w / total) for w in row_weights]
        table = Table([cells], colWidths=col_widths)
        table.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.6, _INK),
                    ("INNERGRID", (0, 0), (-1, -1), 0.6, _INK),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        tables.append(table)
    return tables


def _section(en: str, ur_text: str) -> Table:
    """The heavy black bar the source form opens each major section with."""
    cell = Paragraph(f"{en.upper()}", _SECTION_EN)
    urdu_cell = Paragraph(ur.shape(ur_text), _SECTION_UR)
    table = Table([[cell, urdu_cell]], colWidths=[_CONTENT_W * 0.62, _CONTENT_W * 0.38])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def _declaration(en: str, ur_text: str) -> KeepTogether:
    box = Table(
        [[Paragraph(en, _DECLARATION)], [Paragraph(ur.shape(ur_text), _DECLARATION_UR)]],
        colWidths=[_CONTENT_W],
    )
    box.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, _INK),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return KeepTogether([box])


def _table(headers: list[str], rows: list[list[str]], col_weights: list[float] | None = None) -> Table:
    """A bordered table. A cell may be a plain string (escaped and wrapped
    in the default cell style) or already-built Paragraph-XML markup
    (passed through unescaped) — the Degree column mixes English and Urdu
    in one cell via `<font face="...">`, which `_escape` would otherwise
    mangle into literal `&lt;font...&gt;` text.
    """
    head = [Paragraph(h, _TH) for h in headers]
    body = [
        [cell if isinstance(cell, Paragraph) else Paragraph(_escape(cell), _TD) for cell in row]
        for row in rows
    ]
    weights = col_weights or [1] * len(headers)
    total = sum(weights)
    col_widths = [_CONTENT_W * w / total for w in weights]
    table = Table([head, *body], colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, _INK),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, _INK),
                ("BACKGROUND", (0, 0), (-1, 0), _HEAD_BG),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def _photo_flowable(data: dict[str, Any], key: str = "photo") -> Any:
    raw = _as_image(data.get(key))
    if raw is None:
        return Spacer(1, 0)
    return _scaled(raw, _PHOTO_MAX)


def _signature_row(en: str, ur_text: str, data: dict[str, Any], key: str) -> list[Any]:
    raw = _as_image(data.get(key))
    cell: Any = _scaled(raw, _SIGNATURE_MAX) if raw else Paragraph("—", _VALUE)
    label = Paragraph(_label(en, ur_text), _LABEL)
    return [label, cell]


# ------------------------------------------------------- doc-level driver --

_CONTENT_W = A4[0] - 2 * _MARGIN


def _footer_for(total_pages: int):
    def _footer(canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont(SANS, 6.8)
        canvas.setFillColor(_MUTED)
        canvas.drawString(_MARGIN, 8 * mm, "Saylani Mass IT Training")
        canvas.drawCentredString(A4[0] / 2, 8 * mm, f"Page {doc.page} of {total_pages}")
        canvas.restoreState()

    return _footer


def _build(story: list[Any], total_pages: int, title: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=_MARGIN,
        rightMargin=_MARGIN,
        topMargin=10 * mm,
        bottomMargin=12 * mm,
        title=title,
        author="Saylani Mass IT Training",
    )
    footer = _footer_for(total_pages)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def _logo_flowable(max_h: float = 9 * mm) -> Any:
    """The Saylani mark every masthead on screen carries. Absent rather than
    fatal if the asset is ever missing — a form without the logo is still
    worth having."""
    reader = _asset("saylani-logo.png")
    if reader is None:
        return Spacer(1, 0)
    width, height = reader.getSize()
    ratio = max_h / height
    return Image(io.BytesIO((_ASSETS / "saylani-logo.png").read_bytes()), width=width * ratio, height=height * ratio)


def _asset(name: str) -> ImageReader | None:
    path = _ASSETS / name
    if not path.exists():
        return None
    return ImageReader(str(path))


def _ref_bar(ref: str, rev: str) -> Table:
    """The small ref/revision strip the real paper forms are printed with —
    static per form, not derived from any submitted data."""
    table = Table(
        [[Paragraph(f"Ref: {ref}", _META), Paragraph(rev, _META)]],
        colWidths=[_CONTENT_W / 2, _CONTENT_W / 2],
    )
    table.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.6, _INK),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def _masthead(en_title: str, ur_title: str, meta_lines: list[str], data: dict[str, Any], *, ref: str, rev: str) -> list[Any]:
    logo_row = Table([[_logo_flowable()]], colWidths=[_CONTENT_W])
    logo_row.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))

    text_cell = [
        logo_row,
        Paragraph(en_title, _TITLE),
        Paragraph(ur.shape(ur_title), _TITLE_UR),
        Spacer(1, 4),
        Paragraph(
            f"<b>Personal information should be in Capital Letters.</b> / "
            f"<font face=\"{NASKH}\">{ur.shape('ذاتی معلومات بڑے الفاظ میں تحریر فرمائیں۔')}</font>",
            ParagraphStyle("Instruction", fontName=SANS, fontSize=6.6, leading=9),
        ),
        Spacer(1, 2),
        Paragraph("<br/>".join(meta_lines), _META),
    ]
    photo = _photo_flowable(data)
    table = Table([[text_cell, photo]], colWidths=[_CONTENT_W - _PHOTO_MAX[0] - 4, _PHOTO_MAX[0] + 4])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    return [_ref_bar(ref, rev), Spacer(1, 3), table]


def _meta_lines(candidate_code: str, candidate_name: str | None, bootcamp_name: str, submitted_at: datetime | None) -> list[str]:
    lines = [f"{candidate_code}" + (f" — {candidate_name}" if candidate_name else ""), bootcamp_name]
    lines.append(
        f"Submitted {submitted_at:%d %b %Y, %H:%M} UTC" if submitted_at else "Submission date not recorded"
    )
    return lines


# ---------------------------------------------- Background Verification --


def _render_background_verification(data: dict[str, Any], meta: list[str], code: str, name: str | None, bootcamp: str, submitted_at: datetime | None) -> bytes:
    story: list[Any] = [
        *_masthead(
            "BACKGROUND VERIFICATION FORM", "تصدیق نامہ", meta, data,
            ref="SWIT-IHR-FAF-11", rev="Rev.0, 09-06-2021",
        ),
        Spacer(1, 5),
        _section("Personal Information", "ذاتی معلومات"),
    ]

    story += _grid(
        [
            [("Name", "نام", _v(data.get("fullName")))],
            [
                ("CNIC #", "شناختی کارڈ نمبر", _cnic(data.get("cnic"))),
                ("Expiry", "تاریخ تنسیخ", _ddmmyyyy(data.get("cnicExpiry"))),
            ],
            [("Father's Name", "والد کا نام", _v(data.get("fatherName")))],
            [
                ("CNIC #", "شناختی کارڈ نمبر", _cnic(data.get("fatherCnic"))),
                ("Alive", "حیات", _s(data.get("fatherAlive")) or "—" if data.get("fatherAlive") is None else _v(data.get("fatherAlive"))),
            ],
            [("Mother's Name", "والدہ کا نام", _v(data.get("motherName")))],
            [
                ("CNIC #", "شناختی کارڈ نمبر", _cnic(data.get("motherCnic"))),
                ("Alive", "حیات", _v(data.get("motherAlive"))),
            ],
            [
                ("Date of Birth", "تاریخ پیدائش", _ddmmyyyy(data.get("dateOfBirth"))),
                ("Sect", "مسلک", _v(data.get("sect"))),
            ],
            [
                ("Blood Group", "خون کا گروہ", _v(data.get("bloodGroup"))),
                ("Mother Tongue", "مادری زبان", _v(data.get("motherTongue"))),
            ],
            [("Present Address", "موجودہ پتہ", _v(data.get("presentAddress")))],
            [("Postal Address", "ڈاک کا پتہ", _v(data.get("postalAddress")))],
            [
                ("Mobile #", "موبائل نمبر", _mobile(data.get("mobileNumber"))),
                ("Emergency #", "ہنگامی نمبر", _mobile(data.get("emergencyNumber"))),
            ],
            [
                ("Chronic disease", "دائمی مرض", _v(data.get("chronicDisease"))),
                ("Police Case", "پولیس کیس", _v(data.get("policeCase"))),
                ("Any Addiction", "کوئی نشہ وغیرہ", _v(data.get("anyAddiction"))),
            ],
        ],
        weights=[
            [1], [2, 1], [1], [2, 1], [1], [2, 1], [2, 1], [1, 1], [1], [1], [1, 1], [1, 1, 1],
        ],
    )

    story.append(Spacer(1, 5))
    story.append(_section("Organizational Information", "تنظیمی معلومات"))
    story += _grid(
        [
            [
                ("Organizational Province", "تنظیمی صوبہ", _v(data.get("orgProvince"))),
                ("Zone", "زون", _v(data.get("zone"))),
                ("Kabina", "کابینہ", _v(data.get("kabina"))),
            ],
            [
                ("Division", "ڈویژن", _v(data.get("division"))),
                ("Halqa", "حلقہ", _v(data.get("halqa"))),
                ("Nearest Masjid", "قریبی مسجد", _v(data.get("nearestMasjid"))),
            ],
        ]
    )

    story.append(Spacer(1, 5))
    story.append(_section("Acknowledgment", "اعتراف نامہ"))
    story.append(
        _declaration(
            "By signing below, I hereby admit that the information I have provided above, is accurate.",
            "میں اس بات کا اقرار کرتا ہوں کہ اوپر دی گئی معلومات درست ہیں۔",
        )
    )
    ack_row = Table(
        [
            [
                Paragraph(_label("Signature", "دستخط"), _LABEL),
                _photo_or_dash(data, "ackSignature"),
                _field_box("Date", "تاریخ", _ddmmyyyy(data.get("ackDate"))),
            ]
        ],
        colWidths=[_CONTENT_W * 0.18, _CONTENT_W * 0.52, _CONTENT_W * 0.30],
    )
    ack_row.setStyle(_boxed_row_style())
    story.append(ack_row)

    story.append(Spacer(1, 5))
    story.append(_section("References", "معرفت"))
    story.append(
        _reference_pair(
            data,
            left_title=("Imam Masjid", "امام مسجد"),
            left_fields=[
                ("Name", "نام", _v(data.get("imamName"))),
                ("CNIC #", "شناختی کارڈ نمبر", _cnic(data.get("imamCnic"))),
                ("Masjid Name", "مسجد کا نام", _v(data.get("imamMasjidName"))),
                ("Mobile No.", "موبائل نمبر", _mobile(data.get("imamMobile"))),
            ],
            left_sig_key="imamSignature",
            right_title=("Other than relatives", "علاوہ عزیز و اقارب"),
            right_fields=[
                ("Name", "نام", _v(data.get("otherName"))),
                ("CNIC #", "شناختی کارڈ نمبر", _cnic(data.get("otherCnic"))),
                ("Address", "ایڈریس", _v(data.get("otherAddress"))),
                ("Mobile No.", "موبائل نمبر", _mobile(data.get("otherMobile"))),
            ],
            right_sig_key="otherSignature",
        )
    )

    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            ur.shape("نوٹ: حوالہ جات میں دونوں افراد کے شناختی کارڈ کی کاپی لازمی منسلک کریں۔"),
            ParagraphStyle("Note", parent=_URDU_RIGHT, alignment=TA_CENTER, fontSize=7.5),
        )
    )

    return _build(story, PAGE_COUNT[OnboardingFormType.BACKGROUND_VERIFICATION], f"{code} — Background Verification Form")


def _photo_or_dash(data: dict[str, Any], key: str) -> Any:
    raw = _as_image(data.get(key))
    return _scaled(raw, _SIGNATURE_MAX) if raw else Paragraph("—", _VALUE)


def _boxed_row_style() -> TableStyle:
    return TableStyle(
        [
            ("BOX", (0, 0), (-1, -1), 0.6, _INK),
            ("INNERGRID", (0, 0), (-1, -1), 0.6, _INK),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]
    )


def _reference_pair(
    data: dict[str, Any],
    *,
    left_title: tuple[str, str],
    left_fields: list[tuple[str, str, str]],
    left_sig_key: str,
    right_title: tuple[str, str],
    right_fields: list[tuple[str, str, str]],
    right_sig_key: str,
) -> Table:
    def column(title: tuple[str, str], fields: list[tuple[str, str, str]], sig_key: str) -> list[Any]:
        rows: list[Any] = [
            Paragraph(f"{title[0]} / <font face=\"{NASKH}\">{ur.shape(title[1])}</font>", ParagraphStyle("RefTitle", fontName=SANS_BOLD, fontSize=7.2, leading=10, alignment=TA_CENTER))
        ]
        for en, u_, val in fields:
            rows.append(_field_box(en, u_, val))
        rows.append(
            Table(
                [[Paragraph(_label("Signature", "دستخط"), _LABEL), _photo_or_dash(data, sig_key)]],
                colWidths=None,
            )
        )
        return rows

    left = column(*[left_title, left_fields, left_sig_key])
    right = column(*[right_title, right_fields, right_sig_key])
    table = Table([[left, right]], colWidths=[_CONTENT_W / 2, _CONTENT_W / 2])
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, _INK),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, _INK),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


# ------------------------------------------------ Employment Application --

_ACADEMIC_LABELS = [("Matric", "میٹرک"), ("Intermediate", "انٹرمیڈیٹ"), ("Graduation", "گریجویشن"), ("Masters", "ماسٹرز"), ("M.Phil", "ایم فل")]
_ISLAMIC_LABELS = [("Nazra Quran", "ناظرہ قرآن"), ("Hifz Quran", "حفظ قرآن"), ("Dars Nizami", "درس نظامی"), ("Mufti Course", "مفتی کورس / تخصص")]


def _education_table(labels: list[tuple[str, str]], rows: list[dict[str, Any]] | None) -> Table:
    rows = rows or []
    headers = [
        "Degree",
        "Major Subject",
        "Institution / Board",
        "Grade / %age",
        "Passing Year",
    ]
    body = []
    for i, (en, u_) in enumerate(labels):
        row = rows[i] if i < len(rows) else {}
        degree = Paragraph(_label(en, u_), _TD)
        body.append([degree, _v(row.get("majorSubject"), ""), _v(row.get("institution"), ""), _v(row.get("grade"), ""), _v(row.get("passingYear"), "")])
    return _table(headers, body, col_weights=[1.4, 1.1, 1.3, 0.9, 0.9])


def _rows_table(headers: list[str], keys: list[str], rows: list[dict[str, Any]] | None, weights: list[float], number: bool = True, blank_ok: bool = False) -> Table | None:
    rows = rows or []
    body = []
    for i, row in enumerate(rows):
        values = [_v(row.get(k), "") for k in keys]
        if not blank_ok and not any(values):
            continue
        cells = [str(i + 1) + "."] + values if number else values
        body.append(cells)
    if not body:
        return None
    full_headers = (["S. No."] + headers) if number else headers
    full_weights = ([0.3] + weights) if number else weights
    return _table(full_headers, body, col_weights=full_weights)


def _render_employment_application(data: dict[str, Any], meta: list[str], code: str, name: str | None, bootcamp: str, submitted_at: datetime | None) -> bytes:
    story: list[Any] = [
        *_masthead(
            "EMPLOYMENT APPLICATION FORM", "درخواستِ ملازمت", meta, data,
            ref="SWIT-IHR-FAF-03", rev="Rev.1, 16-10-2021",
        ),
        Spacer(1, 4),
    ]
    story += _grid([[("Position Applied For", "منصب کے لیے درخواست", _v(data.get("positionAppliedFor")))]])

    story.append(Spacer(1, 5))
    story.append(_section("Personal Information", "ذاتی معلومات"))
    story += _grid(
        [
            [("Name", "نام", _v(data.get("fullName")))],
            [
                ("CNIC #", "شناختی کارڈ نمبر", _cnic(data.get("cnic"))),
                ("Expiry", "تاریخ تنسیخ", _ddmmyyyy(data.get("cnicExpiry"))),
            ],
            [
                ("Father's Name", "والدیت", _v(data.get("fatherName"))),
                ("Mother's Name", "والدہ کا نام", _v(data.get("motherName"))),
            ],
            [
                ("Nationality", "شہریت", _v(data.get("nationality"))),
                ("Religion", "مذہب", _v(data.get("religion"))),
            ],
            [
                ("Date of Birth", "تاریخ پیدائش", _ddmmyyyy(data.get("dateOfBirth"))),
                ("Marital Status", "ازدواجی حیثیت", _v(data.get("maritalStatus"))),
                ("Gender", "جنس", _v(data.get("gender"))),
            ],
            [
                ("Mother Tongue", "مادری زبان", _v(data.get("motherTongue"))),
                ("Cast", "حسب نسب", _v(data.get("cast")) + (f" ({_v(data.get('castOther'))})" if _s(data.get("cast")).lower() == "other" and _s(data.get("castOther")) else "")),
            ],
            [
                ("Blood Group", "خون کا گروپ", _v(data.get("bloodGroup"))),
                ("Chronic Disease", "دائمی مرض", _v(data.get("chronicDisease"))),
            ],
            [("Present Address", "موجودہ پتہ", _v(data.get("presentAddress")))],
            [("Postal Address", "ڈاک کا پتہ", _v(data.get("postalAddress")))],
            [
                ("Mobile #", "موبائل نمبر", _mobile(data.get("mobileNumber"))),
                ("Passport #", "پاسپورٹ نمبر", _v(data.get("passportNumber"))),
            ],
            [
                ("Emergency #", "ایمرجنسی نمبر", _mobile(data.get("emergencyNumber"))),
                ("Email", "ای میل", _v(data.get("email"))),
            ],
        ],
        weights=[[1], [2, 1], [1, 1], [1, 1], [1, 1, 1], [1, 1], [1, 1], [1], [1], [1, 1], [1, 1]],
    )

    story.append(Spacer(1, 5))
    story.append(_section("Academic Background", "تعلیمی پس منظر"))
    story.append(_subhead("Academic Education", "دنیاوی تعلیم"))
    story.append(_education_table(_ACADEMIC_LABELS, data.get("academicEducation")))
    story.append(_subhead("Islamic Education", "اسلامی تعلیم"))
    story.append(_education_table(_ISLAMIC_LABELS, data.get("islamicEducation")))

    story.append(Spacer(1, 5))
    story.append(_section("Professional Course / Certifications / Trainings etc.", "دیگر پیشہ ورانہ کورسز اور تربیت"))
    courses = _rows_table(
        ["Course / Diploma / Certificate", "Major Subject", "Duration", "Issuing Authority / Institute", "Passing Year"],
        ["course", "majorSubject", "duration", "issuingAuthority", "passingYear"],
        data.get("professionalCourses"),
        weights=[1.6, 1.0, 0.7, 1.4, 0.8],
    )
    story.append(courses or Paragraph("None recorded.", _TD))

    story.append(PageBreak())

    # ------------------------------------------------------------- page 2 --
    story.append(_section("Employment History", "ملازمت کی تفصیل"))
    story += _grid([[("Total Working Experience", "مجموعی مدتِ ملازمت", (_v(data.get("totalExperienceYears"), "")) + " years" if _s(data.get("totalExperienceYears")) else "—")]])
    history_rows = []
    for row in data.get("employmentHistory") or []:
        values = [_v(row.get(k), "") for k in ("company", "designation", "periodFrom", "periodTo", "grossSalary")]
        if any(values):
            history_rows.append(values)
    if history_rows:
        body = [[str(i + 1) + "."] + r for i, r in enumerate(history_rows)]
        story.append(
            _table(
                ["S. No.", "Company / Organization", "Designation / Job Title", "From", "To", "Gross Salary"],
                body,
                col_weights=[0.3, 1.5, 1.3, 0.6, 0.6, 0.8],
            )
        )
    else:
        story.append(Paragraph("None recorded.", _TD))

    story.append(Spacer(1, 5))
    story.append(_subhead("Present Salary and Benefits", "موجودہ تنخواہ و مراعات", second=("Expected Salary", "متوقع تنخواہ")))
    story += _grid(
        [
            [
                ("Gross Salary", "مجموعی تنخواہ", _v(data.get("presentGrossSalary"))),
                ("Other Benefits", "دیگر مراعات", _v(data.get("otherBenefits"))),
                ("Gross Salary", "مجموعی تنخواہ", _v(data.get("expectedGrossSalary"))),
                ("Notice Period", "نوٹس مدت", _v(data.get("noticePeriod"))),
            ]
        ]
    )

    story.append(Spacer(1, 5))
    story.append(_section("Family Details", "خاندان کی تفصیلات"))
    family = _rows_table(
        ["Name", "Relation", "Age", "Education", "Occupation"],
        ["name", "relation", "age", "education", "occupation"],
        data.get("familyDetails"),
        weights=[1.2, 0.9, 0.5, 1.0, 1.0],
    )
    story.append(family or Paragraph("None recorded.", _TD))

    story.append(Spacer(1, 5))
    story.append(_section("References (Other than relatives)", "معروفین (علاوہ عزیز و اقارب)"))
    ref1 = data.get("reference1") or {}
    ref2 = data.get("reference2") or {}
    story.append(
        _reference_pair(
            data,
            left_title=("Reference — 1", "معروفیت"),
            left_fields=[
                ("Name", "نام", _v(ref1.get("name"))),
                ("Designation", "منصب", _v(ref1.get("designation"))),
                ("Organization", "ادارہ", _v(ref1.get("organization"))),
                ("Mobile No.", "موبائل نمبر", _mobile(ref1.get("mobile"))),
                ("E-mail", "ای میل", _v(ref1.get("email"))),
            ],
            left_sig_key="__none__",
            right_title=("Reference — 2", "معروفیت"),
            right_fields=[
                ("Name", "نام", _v(ref2.get("name"))),
                ("Designation", "منصب", _v(ref2.get("designation"))),
                ("Organization", "ادارہ", _v(ref2.get("organization"))),
                ("Mobile No.", "موبائل نمبر", _mobile(ref2.get("mobile"))),
                ("E-mail", "ای میل", _v(ref2.get("email"))),
            ],
            right_sig_key="__none__",
        )
    )

    story.append(Spacer(1, 5))
    story.append(_section("Employee Relative in the Saylani Welfare", "کوئی رشتہ دار جو سیلانی ویلفیئر میں ملازمت کرتا ہو"))
    story += _grid(
        [
            [
                ("Name", "نام", _v(data.get("relativeName"))),
                ("Relation", "رشتہ", _v(data.get("relativeRelation"))),
            ],
            [
                ("Designation", "منصب", _v(data.get("relativeDesignation"))),
                ("Department", "شعبہ", _v(data.get("relativeDepartment"))),
            ],
            [
                ("Mobile No.", "موبائل نمبر", _mobile(data.get("relativeMobile"))),
                ("Job Duration", "مدتِ ملازمت", _v(data.get("relativeJobDuration"))),
            ],
        ]
    )

    story.append(Spacer(1, 5))
    story.append(_section("Saylani Welfare International Trust", "سیلانی ویلفیئر انٹرنیشنل ٹرسٹ"))
    story.append(
        _qa_row(
            "1. Are you Mureed? If yes, name please.",
            "کیا آپ مرید ہیں؟ اگر مرید ہیں تو پیر صاحب کا نام کیا ہے؟",
            data.get("isMureed"),
            _v(data.get("mureedName"), ""),
        )
    )
    story.append(
        _qa_row(
            "2. Association with any other religious / political / social organization?",
            "کسی مذہبی / سیاسی / سماجی تنظیم سے بالواسطہ یا بلاواسطہ کوئی تعلق؟",
            data.get("hasOrgAssociation"),
            _v(data.get("orgAssociationDetails"), ""),
        )
    )
    story.append(_qa_row("3. What do you know about 'Saylani'?", "آپ ”سیلانی“ کے بارے میں کیا جانتے ہیں؟", data.get("knowsAboutSaylani"), ""))
    story.append(
        _qa_row(
            "4. Briefly explain why do you want to pursue your career in 'Saylani'?",
            "مختصراً بتائیں کہ آپ ”سیلانی“ میں ملازمت کیوں کرنا چاہتے ہیں؟",
            None,
            _v(data.get("whySaylani"), ""),
            yes_no=False,
        )
    )

    story.append(Spacer(1, 5))
    story.append(_section("Acknowledgment", "اعتراف"))
    story.append(
        _declaration(
            "By signing below, I hereby admit that the information I have provided above, is accurate to the best of my knowledge.",
            "میں اعتراف کرتا/کرتی ہوں کہ میری جانب سے فراہم کی گئی درج بالا تمام معلومات میرے علم کے مطابق درست ہیں۔",
        )
    )
    ack_row = Table(
        [
            [
                Paragraph(_label("Signature", "دستخط"), _LABEL),
                _photo_or_dash(data, "ackSignature"),
                _field_box("Date", "تاریخ", _ddmmyyyy(data.get("ackDate"))),
            ]
        ],
        colWidths=[_CONTENT_W * 0.18, _CONTENT_W * 0.52, _CONTENT_W * 0.30],
    )
    ack_row.setStyle(_boxed_row_style())
    story.append(ack_row)

    return _build(story, PAGE_COUNT[OnboardingFormType.EMPLOYMENT_APPLICATION], f"{code} — Employment Application Form")


def _subhead(en: str, ur_text: str, second: tuple[str, str] | None = None) -> Table:
    if second is None:
        left = Paragraph(f"{en} / <font face=\"{NASKH}\">{ur.shape(ur_text)}</font>", ParagraphStyle("Sub", fontName=SANS_BOLD, fontSize=7.4, leading=10, alignment=TA_CENTER))
        table = Table([[left]], colWidths=[_CONTENT_W])
        table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), _HEAD_BG), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
        return table
    # A Paragraph resolves its style's textColor into fixed text fragments at
    # construction time — a TableStyle TEXTCOLOR command reaches only a plain
    # string a Table wraps itself, and mutating `.style` after the fact is
    # also too late, since the fragments it already built do not re-read it.
    # Both Paragraphs here must be built with white already set.
    on_black = ParagraphStyle("Sub2", fontName=SANS_BOLD, fontSize=7.4, leading=10, alignment=TA_CENTER, textColor=colors.white)
    left = Paragraph(f"{en} / <font face=\"{NASKH}\">{ur.shape(ur_text)}</font>", on_black)
    right = Paragraph(f"{second[0]} / <font face=\"{NASKH}\">{ur.shape(second[1])}</font>", on_black)
    table = Table([[left, right]], colWidths=[_CONTENT_W / 2, _CONTENT_W / 2])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.black),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def _qa_row(en_q: str, ur_q: str, answer: Any, detail: str, yes_no: bool = True) -> Table:
    question = Paragraph(
        f"<b>{_escape(en_q)}</b><br/><font face=\"{NASKH}\">{ur.shape(ur_q)}</font>",
        ParagraphStyle("QA", fontName=SANS, fontSize=7, leading=10),
    )
    cells = [question]
    if yes_no:
        cells.append(Paragraph(_v(answer), _VALUE))
    if detail:
        cells.append(Paragraph(_escape(detail), _VALUE))
    weights = [3.0] + ([0.6] if yes_no else []) + ([1.4] if detail else [])
    total = sum(weights)
    table = Table([cells], colWidths=[_CONTENT_W * w / total for w in weights])
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.5, _RULE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


# ------------------------------------------------------------- Half Nama --

_POLICY_ROWS = [
    "اصول وضوابط کی پالیسی",
    "ضابطہ اخلاق کی پالیسی",
    'کارڈ "نظم وضبط" کی پالیسی',
    "ادارے کے اندر کسی قسم کی لڑائی جھگڑے اور گالی گلوچ سے پرہیز کریں۔",
    "ڈیوٹی پر آنے کے لئے دیئے گئے شیڈول کے مطابق 15 منٹ پہلے پہنچنا اور جب صبح کی ڈیوٹی ہو تو دعا میں لازمی شرکت کرنا۔",
    "اپنے ٹارگٹ، ڈیوٹی شیڈول اور دیگر معلومات کے لئے اپنے سپروائزر/ہیڈ سے رابطہ کرنا۔",
    "اگر کسی بھی وجہ یا وجوہات کی بنا پر ملازمت چھوڑنی ہو تو ہیومین ریسورس ڈیپارٹمنٹ میں تحریری اطلاع دینا ضروری ہوگا، بصورت دیگر واجبات ادا نہیں کیے جائیں گے۔",
    "اگر کسی ایمرجنسی صورتحال میں چھٹی مطلوب ہو تو ہیومین ریسورس ڈیپارٹمنٹ کو ٹیلی فون کر کے بتائیں۔",
    "ادارے میں ہر قسم کی صفائی ستھرائی کا مکمل خیال رکھنا۔",
    "اپنے سینئرز کے تمام احکامات پر پوری طرح عمل کروں گا۔",
]


def _urdu_para(text: str, style: ParagraphStyle, width: float) -> Paragraph:
    """A right-aligned Urdu paragraph, pre-wrapped by `urdu_text.wrap` and
    rejoined with `<br/>` — reportlab's own line-breaking has no idea a
    bidi-reordered string cannot be split at an arbitrary point, so the
    breaking has to happen before the string reaches it, not after."""
    lines = ur.wrap(text, font=NASKH, size=style.fontSize, max_width=width)
    return Paragraph("<br/>".join(lines), style)


def _oath_blank(value: Any) -> str:
    text = _s(value)
    return f"<b>{_escape(text)}</b>" if text else "____________"


def _render_half_nama(data: dict[str, Any], meta: list[str], code: str, name: str | None, bootcamp: str, submitted_at: datetime | None) -> bytes:
    inner_w = _CONTENT_W - 6 * mm

    # ------------------------------------------------------------- page 1 --
    story: list[Any] = [
        Paragraph(ur.shape("سیلانی ویلفیئر انٹرنیشنل ٹرسٹ"), _URDU_HEAD),
        Paragraph(ur.shape("☆ سیلانی ویلفیئر کے ساتھ وفاداری کا عہد نامہ ☆"), ParagraphStyle("Sub", fontName=NASKH, fontSize=10, leading=16, alignment=TA_CENTER)),
        Spacer(1, 3),
    ]
    hadith = Table(
        [
            [Paragraph(ur.shape("﴾ اس کا کوئی دین نہیں ، جس کا کوئی عہد نہیں ﴿"), ParagraphStyle("Hadith", fontName=NASKH, fontSize=9, leading=15, alignment=TA_CENTER))],
            [Paragraph("- [ الحدیث ]", ParagraphStyle("HadithSrc", fontName=NASKH, fontSize=7.5, leading=11, alignment=TA_CENTER, textColor=_MUTED))],
        ],
        colWidths=[_CONTENT_W * 0.7],
        hAlign="CENTER",
    )
    hadith.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.5, _INK), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    story.append(hadith)
    story.append(Spacer(1, 8))

    # Assembled in logical (reading) order, English blanks embedded, then
    # wrapped as one unit — the candidate's name is just more Urdu-adjacent
    # text as far as bidi is concerned, since digits/Latin letters are their
    # own, separately-handled run.
    page1_text = (
        f"میں {_s(data.get('page1Name')) or '____________'} بن "
        f"{_s(data.get('page1FatherName')) or '____________'} یہ عہد کرتا ہوں کہ میں سیلانی ویلفیئر "
        "انٹرنیشنل ٹرسٹ کا ہمیشہ وفادار رہوں گا۔ اور اس ادارے میں خدمات کو صرف نوکری نہیں بلکہ آقا کریم "
        "ﷺ کی دکھیاری امت کی خدمت سمجھوں گا۔ اس ادارے کی ترویج و ترقی کے لئے اپنی صلاحیتوں کو حتی الامکان "
        "بروئے کار لاؤں گا، ادارے کی ضرورت اور آقا کریم ﷺ کی دکھیاری امت کی ہر پریشانی و مصیبت کے وقت "
        "مقررشدہ اوقات کے علاوہ بھی ہمہ وقت ہر قسم کی خدمات دینے کے لئے \"فی سبیل اللہ\" تیار رہوں گا۔ اپنے "
        "آپ کو ادارے کا صرف ملازم نہیں بلکہ دست و بازو سمجھوں گا۔ اس ادارے کے نقصان کو اپنا نقصان سمجھوں "
        "گا، اگر پانی یا روٹی یا سالن ضائع ہو رہا ہے یا بجلی کا ضیاع ہو رہا ہے یا کوئی اور سامان عدم توجہی "
        "کی وجہ سے ضائع ہو رہا ہے تو حدیثِ پاک کے اس فرمان کہ \"برائی کو ہاتھ سے روکو\" پر عمل کرتے ہوئے "
        "اپنی طاقت بھر اس نقصان کو روکنے کی پوری کوشش کروں گا۔ اور اگر خود نہ روک پایا تو اپنے سے اوپر "
        "ذمہ داروں کو اس کی اطلاع دوں گا، اور کسی کی ادارے کو نقصان پہنچانے والی حرکت کی پردہ پوشی نہیں "
        "کروں گا۔ اللہ عزوجل اپنے حبیب کریم علیہ الصلوٰۃ والتسلیم کے وسیلہ سے مجھے اس عہد پر پورا اترنے کی "
        "توفیق عطا فرمائے (آمین)۔"
    )
    story.append(_urdu_para(page1_text, _URDU_BODY, inner_w))
    story.append(Spacer(1, 10))

    footer_row = Table(
        [
            [
                Paragraph(f"<font face=\"{NASKH_BOLD}\">{ur.shape('دستخط:')}</font>", ParagraphStyle("Sig", fontName=SANS, fontSize=9, leading=13)),
                _photo_or_dash(data, "page1Signature"),
                Paragraph(f"<font face=\"{NASKH_BOLD}\">{ur.shape('تاریخ:')}</font> {_escape(_ddmmyyyy(data.get('page1Date')))}", ParagraphStyle("Date", fontName=SANS, fontSize=9, leading=13)),
            ]
        ],
        colWidths=[_CONTENT_W * 0.15, _CONTENT_W * 0.45, _CONTENT_W * 0.40],
    )
    footer_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (2, 0), (2, 0), "RIGHT")]))
    story.append(footer_row)
    story.append(PageBreak())

    # ------------------------------------------------------------- page 2 --
    story.append(Paragraph(ur.shape("سیلانی ویلفیئر انٹرنیشنل ٹرسٹ"), _URDU_HEAD))
    story.append(Paragraph(ur.shape("﴾ اقرار نامہ ﴿"), ParagraphStyle("Sub2", fontName=NASKH, fontSize=10, leading=16, alignment=TA_CENTER)))
    story.append(Spacer(1, 8))

    page2_text = (
        f"میں {_s(data.get('page2Name')) or '____________'} ولدیت "
        f"{_s(data.get('page2FatherName')) or '____________'} ادارے کا کوڈ نمبر "
        f"{_s(data.get('page2CodeNumber')) or '____________'} اور "
        f"{_s(data.get('page2Department')) or '____________'} ڈیپارٹمنٹ میں بحیثیت "
        f"{_s(data.get('page2Designation')) or '____________'} کے کام کرتا ہوں کہ مجھے تمام ہدایات اچھی "
        "طرح سے سمجھا گیا ہے اور ان میں بتائی گئی تمام شرائط، جرمانہ وغیرہ کی سختی سے پابندی کروں گا۔ "
        "بتائی گئی تمام پالیسیاں مندرجہ ذیل ہیں۔"
    )
    story.append(_urdu_para(page2_text, _URDU_BODY, inner_w))
    story.append(Spacer(1, 6))

    policy_body = [[str(i + 1), Paragraph(ur.shape(text), ParagraphStyle("Policy", fontName=NASKH, fontSize=8.5, leading=13, alignment=TA_RIGHT))] for i, text in enumerate(_POLICY_ROWS)]
    policy_table = Table(policy_body, colWidths=[8 * mm, _CONTENT_W - 8 * mm])
    policy_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, _INK),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, _INK),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (1, 0), (1, -1), 6),
            ]
        )
    )
    story.append(policy_table)
    story.append(Spacer(1, 6))

    closing_text = (
        "مزید براں یہ کہ میں کسی قسم کی غیر قانونی حرکات وغیرہ میں بھی شامل نہیں رہوں گا۔ میں اوپر بتائی "
        "گئی تمام ہدایات پر سختی سے عمل کروں گا/گی اور اگر کسی قسم کی شکایات انتظامیہ تک پہنچیں تو "
        "انتظامیہ سخت ایکشن کا حق محفوظ رکھتی ہے۔"
    )
    story.append(_urdu_para(closing_text, _URDU_BODY, inner_w))
    story.append(Spacer(1, 8))

    sig2 = Table(
        [
            [
                Paragraph(f"<font face=\"{NASKH_BOLD}\">{ur.shape('دستخط:')}</font>", ParagraphStyle("Sig2", fontName=SANS, fontSize=9, leading=13)),
                _photo_or_dash(data, "page2Signature"),
            ]
        ],
        colWidths=[_CONTENT_W * 0.2, _CONTENT_W * 0.5],
    )
    sig2.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(sig2)

    return _build(story, PAGE_COUNT[OnboardingFormType.HALF_NAMA], f"{code} — Half Nama")


# ------------------------------------------------------- Bank & Payment --


def _render_bank_payment(data: dict[str, Any], meta: list[str], code: str, name: str | None, bootcamp: str, submitted_at: datetime | None) -> bytes:
    """No on-screen print design exists for this one — see the module
    docstring on `bank-payment-form.tsx`: "not a replica of a paper form...
    no print styling, no PDF." This is a new, simple layout, built for
    visual consistency with the other three exports rather than to match
    anything the candidate has seen."""
    is_bank = bool(_s(data.get("bank_name")) or _s(data.get("iban")))

    story: list[Any] = [
        Paragraph("BANK &amp; PAYMENT DETAILS", _TITLE),
        Spacer(1, 2),
        Paragraph("<br/>".join(meta), _META),
        Spacer(1, 8),
    ]

    if is_bank:
        story.append(_section("Bank Account", "بینک اکاؤنٹ"))
        story += _grid(
            [
                [("Bank Name", "بینک کا نام", _v(data.get("bank_name")))],
                [("Account Title", "اکاؤنٹ کا عنوان", _v(data.get("account_title")))],
                [("IBAN", "آئی بی اے این", _v(data.get("iban")))],
            ]
        )
    else:
        story.append(_section("Mobile Wallet", "موبائل والٹ"))
        story += _grid(
            [
                [("Wallet Provider", "والٹ فراہم کنندہ", _v(data.get("wallet_provider")))],
                [("Wallet Number", "والٹ نمبر", _mobile(data.get("wallet_number")))],
            ]
        )

    return _build(story, PAGE_COUNT[OnboardingFormType.BANK_PAYMENT_DETAILS], f"{code} — Bank & Payment Details")


# ------------------------------------------------------------------ entry --

_RENDERERS = {
    OnboardingFormType.BACKGROUND_VERIFICATION: _render_background_verification,
    OnboardingFormType.EMPLOYMENT_APPLICATION: _render_employment_application,
    OnboardingFormType.HALF_NAMA: _render_half_nama,
    OnboardingFormType.BANK_PAYMENT_DETAILS: _render_bank_payment,
}


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
    KB at most (the candidate photo dominates it), small enough to hold
    while it is written into the archive.
    """
    meta = _meta_lines(candidate_code, candidate_name, bootcamp_name, submitted_at)
    renderer = _RENDERERS[form_type]
    return renderer(data, meta, candidate_code, candidate_name, bootcamp_name, submitted_at)
