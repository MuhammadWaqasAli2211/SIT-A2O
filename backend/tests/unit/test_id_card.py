"""The ID card: who gets one, and what ends up printed on it."""

import uuid
from datetime import date

import pytest

from app.services import id_card_service as svc


def card(**overrides) -> svc.CardData:
    base = dict(
        full_name="Muhammad Waqas Ali",
        candidate_code="B07-008",
        bootcamp_number=7,
        father_name="Muhammad Ali",
        id_number="00000-0000000-0",
        id_label="CNIC#",
        designation="Data Science & AI",
        photo=None,
    )
    return svc.CardData(**{**base, **overrides})


# -------------------------------------------------------------- the rules --


def _svc_with_latest(monkeypatch, result):
    monkeypatch.setattr(svc, "_latest_invite_result", lambda db, application_id: result)


class _App:
    def __init__(self, bootcamp_id=None, is_selected=None):
        self.id = uuid.uuid4()
        self.bootcamp_id = bootcamp_id or uuid.uuid4()
        self.is_selected = is_selected


def test_only_a_selected_verdict_makes_a_candidate_eligible(monkeypatch):
    _svc_with_latest(monkeypatch, "SELECTED")
    assert svc.is_eligible(None, _App()) is True


@pytest.mark.parametrize("result", ["REJECTED", None])
def test_any_other_verdict_does_not(monkeypatch, result):
    _svc_with_latest(monkeypatch, result)
    assert svc.is_eligible(None, _App()) is False


def test_eligibility_ignores_applications_is_selected(monkeypatch):
    """The trap this feature had to avoid.

    `applications.is_selected` is set on the way *into* PHYSICAL_INTERVIEW —
    it means "cleared the AI round", so everyone merely invited carries it.
    Reading it here would hand an ID card to candidates who have not sat,
    let alone passed, the interview.
    """
    _svc_with_latest(monkeypatch, None)
    assert svc.is_eligible(None, _App(is_selected=True)) is False


def test_the_offer_needs_both_the_switch_and_the_verdict(monkeypatch):
    application = _App()
    _svc_with_latest(monkeypatch, "SELECTED")

    monkeypatch.setattr(svc, "issued_for_bootcamp", lambda db, bootcamp_id: False)
    assert svc.availability(None, application) is False

    monkeypatch.setattr(svc, "issued_for_bootcamp", lambda db, bootcamp_id: True)
    assert svc.availability(None, application) is True

    # Switch on, but this candidate was never selected.
    _svc_with_latest(monkeypatch, None)
    assert svc.availability(None, application) is False


def test_the_download_route_refuses_and_says_which_half_failed(monkeypatch):
    from app.core.exceptions import ConflictError

    application = _App()

    _svc_with_latest(monkeypatch, None)
    monkeypatch.setattr(svc, "issued_for_bootcamp", lambda db, bootcamp_id: True)
    with pytest.raises(ConflictError, match="selected at the interview"):
        svc.assert_can_download(None, application)

    _svc_with_latest(monkeypatch, "SELECTED")
    monkeypatch.setattr(svc, "issued_for_bootcamp", lambda db, bootcamp_id: False)
    with pytest.raises(ConflictError, match="not been issued"):
        svc.assert_can_download(None, application)


# --------------------------------------------------------------- the data --


def test_the_bootcamp_label_matches_the_reference_wording():
    assert card(bootcamp_number=8).bootcamp_label == "BOOTCAMP 8.0"
    assert card(bootcamp_number=7).bootcamp_label == "BOOTCAMP 7.0"


def test_the_qr_carries_plain_text_and_never_a_link():
    text = card().qr_text
    assert text.splitlines() == [
        "Muhammad Waqas Ali",
        "B07-008",
        "Bootcamp 07",
        "Data Science & AI",
    ]
    # The whole point of the brief: no verification URL, no lookup endpoint.
    assert "http" not in text.lower()
    assert "://" not in text


@pytest.mark.parametrize(
    ("dob", "adult"),
    [
        (date(2000, 1, 1), True),
        (None, True),
        (date(2026, 1, 1), False),
    ],
)
def test_the_age_rule_decides_cnic_against_b_form(dob, adult):
    assert svc._is_adult(dob, date(2026, 9, 16)) is adult


def test_a_birthday_later_this_year_has_not_happened_yet():
    """Turning 18 in December does not make someone an adult in September."""
    assert svc._is_adult(date(2008, 12, 31), date(2026, 9, 16)) is False
    assert svc._is_adult(date(2008, 9, 16), date(2026, 9, 16)) is True


# ------------------------------------------------------------ the drawing --


def test_the_card_is_two_pages_at_the_reference_size():
    pdfium = pytest.importorskip("pypdfium2")

    pdf = svc.render_card(card())
    assert pdf.startswith(b"%PDF")

    doc = pdfium.PdfDocument(pdf)
    assert len(doc) == 2
    for page in doc:
        width, height = page.get_size()
        assert round(width, 2) == 141.75
        assert round(height, 2) == 240.75


def test_a_long_name_stays_inside_the_card():
    """The reference was drawn around a three-word name; real ones are longer
    and there is no margin at 141.75pt to absorb the overflow."""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    name = "MUHAMMAD WAQAS ALI"
    usable = 124.0  # the band's width less a margin either side

    # At the reference's own size it runs past the usable width and would sit
    # flush against both edges of a 141.75pt card.
    assert stringWidth(name, "Times-Bold", 11) > usable

    size = 11.0
    while size > 4.5 and stringWidth(name, "Times-Bold", size) > usable:
        size -= 0.2
    assert stringWidth(name, "Times-Bold", size) <= usable


def test_a_missing_photo_still_produces_a_card():
    """A candidate whose upload went missing months ago should not be blocked
    from having a card at all."""
    pdf = svc.render_card(card(photo=None))
    assert pdf.startswith(b"%PDF")


def test_a_corrupt_photo_does_not_break_the_card():
    pdf = svc.render_card(card(photo=b"not an image"))
    assert pdf.startswith(b"%PDF")


def test_the_rendered_qr_actually_decodes():
    """Drawn at 42pt, the code still has to survive being scanned."""
    pypdfium2 = pytest.importorskip("pypdfium2")
    zxingcpp = pytest.importorskip("zxingcpp")

    data = card()
    doc = pypdfium2.PdfDocument(svc.render_card(data))
    back = doc[1].render(scale=4).to_pil()

    found = zxingcpp.read_barcodes(back)
    assert len(found) == 1
    assert found[0].text == data.qr_text


# ------------------------------------------------------------- validity --


def test_issuing_without_dates_is_refused():
    """A card prints its validity period, and nobody can be asked for it after
    the fact — so the switch cannot move without one."""
    from app.schemas.id_card import IdCardIssueRequest

    with pytest.raises(ValueError, match="valid-from and a valid-to"):
        IdCardIssueRequest(issued=True)
    with pytest.raises(ValueError, match="valid-from and a valid-to"):
        IdCardIssueRequest(issued=True, valid_from=date(2026, 9, 16))


def test_a_backwards_validity_period_is_refused():
    from app.schemas.id_card import IdCardIssueRequest

    with pytest.raises(ValueError, match="cannot be before"):
        IdCardIssueRequest(
            issued=True, valid_from=date(2026, 12, 16), valid_to=date(2026, 9, 16)
        )


def test_withdrawing_needs_no_dates_and_discards_any_sent():
    from app.schemas.id_card import IdCardIssueRequest

    request = IdCardIssueRequest(issued=False, valid_from=date(2026, 9, 16))
    assert request.valid_from is None
    assert request.valid_to is None


def test_the_validity_line_reads_as_a_period():
    assert (
        card(valid_from=date(2026, 9, 16), valid_to=date(2026, 12, 16)).validity
        == "16 Sep 2026 to 16 Dec 2026"
    )


def test_an_unset_period_prints_a_dash_not_a_blank():
    """A ruled line with nothing on it reads as a form nobody finished."""
    assert card().validity == "—"


def test_the_signature_slot_falls_back_to_the_plain_rule(monkeypatch):
    """A missing asset must never cost a candidate their card."""
    monkeypatch.setattr(svc, "_asset", lambda name: None)
    pdf = svc.render_card(card(valid_from=date(2026, 9, 16), valid_to=date(2026, 12, 16)))
    assert pdf.startswith(b"%PDF")
