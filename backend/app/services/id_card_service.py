"""The candidate ID card: who may have one, and drawing it.

Two pages at 141.75 x 240.75 pt — a portrait CR80 card, not a document page.
Every coordinate below is expressed from the top of the page by `_y`, because
the reference design was measured that way and reportlab's bottom-left origin
would otherwise make each number a subtraction to read.

Drawn with reportlab rather than rendered from HTML: this layout is fixed
position art — two rectangles, a clipped circle, two logos, a QR image and a
handful of centred text runs — which is what reportlab is good at. Nothing
here reflows, so the usual argument for an HTML engine (and its browser
binary) does not apply.
"""

import io
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

import qrcode
from reportlab.lib.colors import Color, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.integrations import supabase_storage
from app.models.application import Application
from app.models.bootcamp import Bootcamp, Program
from app.models.enums import PhysicalInterviewResult
from app.models.physical_interview import PhysicalInterviewBatch, PhysicalInterviewInvite
from app.models.user import CandidateProfile, Profile

# ------------------------------------------------------------- the design --

CARD_W = 141.75
CARD_H = 240.75

NAVY = Color(0.118, 0.227, 0.478)
GREEN = Color(0.298, 0.651, 0.298)
BLUE = Color(0.102, 0.302, 0.600)
INK = Color(0.106, 0.106, 0.106)

# Where the blue band starts, and so also where the photo circle is centred:
# in the reference the circle sits astride that edge.
BAND_TOP = 123.2
PHOTO_R = 40.5

_ASSETS = Path(__file__).resolve().parent.parent / "assets"


def _y(from_top: float) -> float:
    """Reportlab's origin is bottom-left; the design was measured top-down."""
    return CARD_H - from_top


# -------------------------------------------------------------- the rules --


def _latest_invite_result(db: Session, application_id: uuid.UUID) -> str | None:
    """The result on this application's most recent physical interview invite.

    The same "latest invite wins" rule the physical interview summary uses —
    a candidate can be invited more than once, and only the current round
    decides anything.
    """
    row = db.execute(
        select(PhysicalInterviewInvite.result)
        .join(PhysicalInterviewBatch, PhysicalInterviewBatch.id == PhysicalInterviewInvite.batch_id)
        .where(PhysicalInterviewInvite.application_id == application_id)
        .order_by(PhysicalInterviewInvite.created_at.desc())
        .limit(1)
    ).first()
    return row[0] if row else None


def is_eligible(db: Session, application: Application) -> bool:
    """Whether this candidate has passed the physical interview.

    Deliberately *not* `applications.is_selected`, which looks like the right
    field and is not: that is set on the way **into** PHYSICAL_INTERVIEW, so
    it means "cleared the AI round", and every candidate merely invited to an
    interview carries it. What matters here is the verdict of the interview
    itself.

    Onboarding progress is not consulted at all. A card is issued on the
    strength of being selected, long before any form or document is in.
    """
    return _latest_invite_result(db, application.id) == PhysicalInterviewResult.SELECTED


def issued_for_bootcamp(db: Session, bootcamp_id: uuid.UUID) -> bool:
    bootcamp = db.get(Bootcamp, bootcamp_id)
    return bool(bootcamp and bootcamp.id_cards_issued_at)


def availability(db: Session, application: Application) -> bool:
    """What the candidate's portal asks: should the download button show?

    Both halves must hold — the admin has switched cards on for the intake,
    and this particular candidate was selected.
    """
    return issued_for_bootcamp(db, application.bootcamp_id) and is_eligible(db, application)


def assert_can_download(db: Session, application: Application) -> None:
    """The same gate as `availability`, but saying which half failed.

    A hidden button is not access control: a candidate who kept an old link,
    or whose card was switched off while their tab was open, reaches the
    route anyway.
    """
    if not is_eligible(db, application):
        raise ConflictError("An ID card is issued once you have been selected at the interview.")
    if not issued_for_bootcamp(db, application.bootcamp_id):
        raise ConflictError("ID cards have not been issued for this intake yet.")


def set_issued(
    db: Session,
    bootcamp_id: uuid.UUID,
    *,
    issued: bool,
    actor: Profile,
    valid_from: date | None = None,
    valid_to: date | None = None,
) -> Bootcamp:
    """Switch ID cards on or off for a whole intake.

    Unlike the AI interview announcement this mirrors, off is a true undo:
    no stage moves, no notifications, nothing to recall. It only decides
    whether eligible candidates are offered the download.

    The validity period is set with the switch and cleared with it. That is
    what makes a re-issue ask again instead of quietly reprinting dates an
    admin chose for a previous term — and cards already downloaded keep the
    dates they were printed with, because a PDF in someone's hands is a
    static file that nothing here can reach.
    """
    bootcamp = db.get(Bootcamp, bootcamp_id)
    if bootcamp is None:
        raise NotFoundError("Bootcamp not found.")

    if issued:
        if valid_from is None or valid_to is None:
            raise ConflictError("Set the card's validity dates before issuing.")
        if valid_to < valid_from:
            raise ConflictError("The valid-to date cannot be before the valid-from date.")
        # Re-issuing an already-on intake still rewrites the period: an admin
        # who reopens the dialog to correct a date expects the correction to
        # take, not to be ignored because the switch was already on.
        if bootcamp.id_cards_issued_at is None:
            bootcamp.id_cards_issued_at = datetime.now(UTC)
            bootcamp.id_cards_issued_by = actor.id
        bootcamp.id_cards_valid_from = valid_from
        bootcamp.id_cards_valid_to = valid_to
    else:
        bootcamp.id_cards_issued_at = None
        bootcamp.id_cards_issued_by = None
        bootcamp.id_cards_valid_from = None
        bootcamp.id_cards_valid_to = None
    return bootcamp


def eligible_count(db: Session, bootcamp_id: uuid.UUID) -> int:
    """How many candidates the switch would actually reach, for the admin UI."""
    rows = db.scalars(
        select(Application.id).where(Application.bootcamp_id == bootcamp_id)
    ).all()
    return sum(
        1
        for application_id in rows
        if _latest_invite_result(db, application_id) == PhysicalInterviewResult.SELECTED
    )


# --------------------------------------------------------------- the data --


class CardData:
    """Everything printed on one card, resolved before any drawing starts."""

    def __init__(
        self,
        *,
        full_name: str,
        candidate_code: str,
        bootcamp_number: int,
        father_name: str,
        id_number: str,
        id_label: str,
        designation: str,
        photo: bytes | None,
        valid_from: date | None = None,
        valid_to: date | None = None,
    ) -> None:
        self.full_name = full_name
        self.candidate_code = candidate_code
        self.bootcamp_number = bootcamp_number
        self.father_name = father_name
        self.id_number = id_number
        self.id_label = id_label
        self.designation = designation
        self.photo = photo
        self.valid_from = valid_from
        self.valid_to = valid_to

    @property
    def bootcamp_label(self) -> str:
        """"BOOTCAMP 8.0" for intake 8 — the reference's own wording."""
        return f"BOOTCAMP {self.bootcamp_number}.0"

    @property
    def validity(self) -> str:
        """The printed validity line.

        An em dash rather than a blank when unset: the field is only ever
        empty on a card drawn outside the normal flow, and a ruled line with
        nothing on it reads as a form nobody finished.
        """
        if self.valid_from is None or self.valid_to is None:
            return "—"
        return f"{self.valid_from:%d %b %Y} to {self.valid_to:%d %b %Y}"

    @property
    def qr_text(self) -> str:
        """Plain text, deliberately not a URL.

        There is no verification endpoint behind this and none is wanted: the
        code carries what a human would read off the card anyway, so a phone
        that scans it shows the details rather than opening anything.
        """
        return "\n".join(
            [
                self.full_name,
                self.candidate_code,
                f"Bootcamp {self.bootcamp_number:02d}",
                self.designation,
            ]
        )


def _is_adult(dob: date | None, on: date) -> bool:
    if dob is None:
        return True
    years = on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))
    return years >= 18


# The card's "Designation" is a role title, not the track name printed
# everywhere else in the portal (`programs.title`) — a lookup here rather
# than a column on `programs`, because this is presentation for one PDF,
# not a fact about the program itself, and a dict keeps the whole mapping
# visible in one place instead of spread across program rows.
#
# Mobile Development has no title of its own: it is treated as covered by
# Web & App Development's, by explicit instruction. Machine Learning folds
# into the AI title the same way, for the same reason — neither program was
# named as needing a distinct designation.
_DESIGNATION_BY_PROGRAM: dict[str, str] = {
    "Web & App Development": "Web Dev Intern",
    "Mobile Development": "Web Dev Intern",
    "Data Science & AI": "AI Engineer Intern",
    "Machine Learning": "AI Engineer Intern",
    "Cloud & DevOps": "Data Engineer Intern",
    "UI/UX Design": "UI/UX Design Intern",
}


def _designation_for(program_title: str) -> str:
    """The role title printed on the card. Falls back to the track name
    itself for any program not in the table, rather than a blank or a
    generic label — a card is still owed to a candidate in a program this
    mapping has not caught up with yet."""
    return _DESIGNATION_BY_PROGRAM.get(program_title, program_title)


def collect(db: Session, application: Application) -> CardData:
    """Read one candidate's card fields out of the database.

    Missing optional values become an em dash rather than an empty line, so
    a printed card never looks like it failed to render.
    """
    profile = db.get(Profile, application.profile_id)
    candidate = db.get(CandidateProfile, application.profile_id)
    bootcamp = db.get(Bootcamp, application.bootcamp_id)
    program = db.get(Program, application.program_id) if application.program_id else None

    name = (candidate.full_name if candidate else None) or (profile.full_name if profile else None)

    # The same age rule the Documents Hub uses to decide which identity
    # document to ask for, so the card cannot disagree with the file on record.
    dob = candidate.date_of_birth if candidate else None
    stored_type = (candidate.id_document_type if candidate else None) or ""
    minor = stored_type.upper() == "B_FORM" or not _is_adult(dob, date.today())

    return CardData(
        full_name=(name or "").strip() or "—",
        candidate_code=application.candidate_code,
        bootcamp_number=bootcamp.bootcamp_number if bootcamp else 0,
        father_name=((candidate.father_name if candidate else None) or "").strip() or "—",
        id_number=((candidate.cnic if candidate else None) or "").strip() or "—",
        id_label="B-Form#" if minor else "CNIC#",
        designation=_designation_for(program.title) if program else "—",
        valid_from=bootcamp.id_cards_valid_from if bootcamp else None,
        valid_to=bootcamp.id_cards_valid_to if bootcamp else None,
        photo=(
            supabase_storage.download_picture(candidate.picture_path)
            if candidate and candidate.picture_path
            else None
        ),
    )


# ------------------------------------------------------------ the drawing --


def _asset(name: str) -> ImageReader | None:
    path = _ASSETS / name
    if not path.exists():
        return None
    return ImageReader(str(path))


def _fit(reader: ImageReader, box_w: float, box_h: float) -> tuple[float, float]:
    """Scale to fit inside the box without distorting the logo."""
    width, height = reader.getSize()
    scale = min(box_w / width, box_h / height)
    return width * scale, height * scale


def _logos(pdf: canvas.Canvas) -> None:
    """The two marks, top corners, on both faces of the card."""
    left = _asset("bootcampflows-logo.png")
    if left is not None:
        width, height = _fit(left, 17, 17)
        pdf.drawImage(left, 9.3, _y(6.8 + height), width, height, mask="auto")

    right = _asset("saylani-logo.png")
    if right is not None:
        width, height = _fit(right, 48, 11)
        pdf.drawImage(right, CARD_W - 9.3 - width, _y(9.3 + height), width, height, mask="auto")


def _border(pdf: canvas.Canvas) -> None:
    pdf.setStrokeColor(GREEN)
    pdf.setLineWidth(1.4)
    pdf.roundRect(4.5, 4.5, CARD_W - 9, CARD_H - 9, 6, stroke=1, fill=0)


def _centred(
    pdf: canvas.Canvas,
    text: str,
    *,
    from_top: float,
    font: str,
    size: float,
    max_width: float | None = None,
) -> None:
    """Centred text, shrunk if it would otherwise run off the card.

    The reference was drawn around a three-word name. Real names are longer,
    and at 141.75pt wide there is no margin to absorb that — "MUHAMMAD WAQAS
    ALI" at the reference's own size is 138pt, which touches both edges. So
    the size given here is a maximum, not a promise.
    """
    if max_width is not None:
        while size > 4.5 and pdf.stringWidth(text, font, size) > max_width:
            size -= 0.2
    pdf.setFont(font, size)
    pdf.drawCentredString(CARD_W / 2, _y(from_top), text)


def _tracked(
    pdf: canvas.Canvas, text: str, *, from_top: float, font: str, size: float, gap: float
) -> None:
    """Letter-spaced centred text — the reference spaces BOOTCAMPER and the ID."""
    pdf.setFont(font, size)
    widths = [pdf.stringWidth(ch, font, size) for ch in text]
    total = sum(widths) + gap * (len(text) - 1)
    x = (CARD_W - total) / 2
    y = _y(from_top)
    for char, width in zip(text, widths):
        pdf.drawString(x, y, char)
        x += width + gap


def _photo(pdf: canvas.Canvas, data: CardData) -> None:
    """The circular portrait straddling the top edge of the blue band.

    Clipped to a circle rather than drawn square: the crop is the design.
    The ring is two half arcs, blue over green, matching the reference's
    gradient closely enough at this size.
    """
    cx, cy = CARD_W / 2, _y(BAND_TOP)

    pdf.saveState()
    path = pdf.beginPath()
    path.circle(cx, cy, PHOTO_R)
    pdf.clipPath(path, stroke=0, fill=0)

    if data.photo:
        try:
            reader = ImageReader(io.BytesIO(data.photo))
            width, height = reader.getSize()
            # Cover the circle, preserving aspect: scale to the larger side.
            scale = max((PHOTO_R * 2) / width, (PHOTO_R * 2) / height)
            draw_w, draw_h = width * scale, height * scale
            pdf.drawImage(
                reader,
                cx - draw_w / 2,
                cy - draw_h / 2,
                draw_w,
                draw_h,
                mask="auto",
            )
        except Exception:
            # A corrupt upload must not cost the candidate their card.
            pdf.setFillColor(Color(0.85, 0.87, 0.9))
            pdf.circle(cx, cy, PHOTO_R, stroke=0, fill=1)
    else:
        pdf.setFillColor(Color(0.85, 0.87, 0.9))
        pdf.circle(cx, cy, PHOTO_R, stroke=0, fill=1)
    pdf.restoreState()

    pdf.setLineWidth(2.2)
    pdf.setStrokeColor(BLUE)
    pdf.arc(cx - PHOTO_R, cy - PHOTO_R, cx + PHOTO_R, cy + PHOTO_R, 0, 180)
    pdf.setStrokeColor(GREEN)
    pdf.arc(cx - PHOTO_R, cy - PHOTO_R, cx + PHOTO_R, cy + PHOTO_R, 180, 180)


def _front(pdf: canvas.Canvas, data: CardData) -> None:
    pdf.setFillColor(white)
    pdf.rect(0, 0, CARD_W, CARD_H, stroke=0, fill=1)

    # The band first, so the photo circle can sit on top of its edge.
    pdf.setFillColor(NAVY)
    pdf.rect(0, 0, CARD_W, _y(BAND_TOP), stroke=0, fill=1)

    _border(pdf)
    _logos(pdf)

    pdf.setFillColor(INK)
    # 98pt is the reference's own measured width for the longer line; both
    # lines take the same size so the title stays a block, not two sizes.
    _centred(pdf, "SAYLANI MASS", from_top=35, font="Times-Bold", size=9.0, max_width=98)
    _centred(pdf, "IT TRAINING CENTER", from_top=45, font="Times-Bold", size=9.0, max_width=98)

    # The reference's small ornamental rule between title and intake.
    pdf.setStrokeColor(INK)
    pdf.setLineWidth(0.5)
    pdf.line(24, _y(56), CARD_W - 24, _y(56))

    _centred(pdf, data.bootcamp_label, from_top=71, font="Times-Roman", size=8.5)

    _photo(pdf, data)

    pdf.setFillColor(white)
    _centred(pdf, data.full_name.upper(), from_top=182, font="Times-Bold", size=11, max_width=124)
    _tracked(pdf, "BOOTCAMPER", from_top=195, font="Times-Roman", size=6.4, gap=1.5)
    _tracked(pdf, f"ID: {data.candidate_code}", from_top=207, font="Times-Roman", size=6.4, gap=1.1)


def _qr_image(text: str) -> ImageReader:
    code = qrcode.QRCode(box_size=10, border=0, error_correction=qrcode.ERROR_CORRECT_M)
    code.add_data(text)
    code.make(fit=True)
    buffer = io.BytesIO()
    code.make_image(fill_color="black", back_color="white").save(buffer, format="PNG")
    buffer.seek(0)
    return ImageReader(buffer)


def _field(
    pdf: canvas.Canvas, label: str, value: str, *, from_top: float, value_size: float = 7.0
) -> None:
    """One "Label: value" row sitting on a ruled line, as in the reference.

    The value is drawn on the rule rather than in place of it, so the card
    still reads as the printed form it is modelled on. A long value is
    stepped down in size instead of running past the margin. `value_size` is
    the size it starts from, for the rows whose values run long.
    """
    left, right = 13.0, CARD_W - 13.0
    baseline = _y(from_top)

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica", 7)
    pdf.drawString(left, baseline, label)
    label_end = left + pdf.stringWidth(label, "Helvetica", 7) + 2.5

    pdf.setLineWidth(0.6)
    pdf.setStrokeColor(INK)
    pdf.line(label_end, baseline - 1.6, right, baseline - 1.6)

    size = value_size
    available = right - label_end - 1.5
    while size > 4.4 and pdf.stringWidth(value, "Helvetica-Bold", size) > available:
        size -= 0.2
    pdf.setFont("Helvetica-Bold", size)
    pdf.drawString(label_end + 1, baseline, value)


# The slot the scanned signature-and-stamp drops into. Swapping in the real
# image is a file replacement at SIGNATURE_ASSET and nothing else: it is
# scaled to fit this box without distortion, so an off-ratio scan simply sits
# smaller rather than stretching.
SIGNATURE_ASSET = "issuing-authority-signature.png"
SIGNATURE_W = 74.0
SIGNATURE_H = 52.0
SIGNATURE_BOTTOM = 215.0  # from the top; the rule sits at 213


def _signature(pdf: canvas.Canvas) -> None:
    """The issuing authority's signature and stamp, above the rule.

    Falls back to drawing nothing when the asset is absent, leaving the plain
    ruled line — a missing file must not cost a candidate their card.
    """
    image = _asset(SIGNATURE_ASSET)
    if image is None:
        return

    width, height = _fit(image, SIGNATURE_W, SIGNATURE_H)
    pdf.drawImage(
        image,
        (CARD_W - width) / 2,
        _y(SIGNATURE_BOTTOM),
        width,
        height,
        mask="auto",
    )


# Name and designation run longest, so they start a touch smaller than the
# other rows; still stepped down further if a value would overflow.
NAME_VALUE_SIZE = 6.2


def _back(pdf: canvas.Canvas, data: CardData) -> None:
    pdf.setFillColor(white)
    pdf.rect(0, 0, CARD_W, CARD_H, stroke=0, fill=1)
    _border(pdf)
    _logos(pdf)

    _field(pdf, "Name:", data.full_name, from_top=38, value_size=NAME_VALUE_SIZE)
    _field(pdf, "Father's Name:", data.father_name, from_top=53)
    _field(pdf, f"{data.id_label}", data.id_number, from_top=68)
    _field(pdf, "Designation:", data.designation, from_top=83, value_size=NAME_VALUE_SIZE)
    _field(pdf, "Valid:", data.validity, from_top=98)

    size = 35.0
    pdf.drawImage(
        _qr_image(data.qr_text),
        (CARD_W - size) / 2,
        _y(108 + size),
        size,
        size,
    )

    pdf.setFillColor(INK)
    _centred(pdf, "Note: This is for SMIT premises only.", from_top=153, font="Helvetica", size=6)
    _centred(pdf, "if found please return to SMIT", from_top=160.5, font="Helvetica", size=6)

    _signature(pdf)

    pdf.setStrokeColor(INK)
    pdf.setLineWidth(0.6)
    pdf.line(38, _y(213), CARD_W - 38, _y(213))
    _centred(pdf, "Issuing Authority", from_top=221, font="Helvetica", size=6)


def render_card(data: CardData) -> bytes:
    """Draw the two pages. Split from `render` so the drawing can be tested
    against made-up values without a database behind it."""
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(CARD_W, CARD_H))
    pdf.setTitle(f"{data.candidate_code} ID Card")

    _front(pdf, data)
    pdf.showPage()
    _back(pdf, data)
    pdf.showPage()
    pdf.save()

    return buffer.getvalue()


def render(db: Session, application: Application) -> bytes:
    """The two-page card for one candidate, from live data every time."""
    return render_card(collect(db, application))


def file_name(application: Application) -> str:
    return f"{application.candidate_code}-ID-Card.pdf"
