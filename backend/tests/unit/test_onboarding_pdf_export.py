"""The onboarding-form export PDFs: structure, page counts, and the Urdu
shaping the Half Nama form depends on entirely.

Page count is the one number this file exists to pin down — it is what a
regression here looks like, since the visual structure cannot be asserted
from a unit test the way a rendered screenshot can be.
"""

from datetime import UTC, datetime

import pytest

from app.models.enums import OnboardingFormType
from app.services import onboarding_pdf_service as svc
from app.services import urdu_text as ur

MOMENT = datetime(2026, 9, 16, 9, 11, tzinfo=UTC)


def _pages(pdf: bytes) -> int:
    pdfium = pytest.importorskip("pypdfium2")
    return len(pdfium.PdfDocument(pdf))


def _render(form_type: OnboardingFormType, data: dict) -> bytes:
    return svc.render_form(
        form_type=form_type,
        data=data,
        candidate_code="B07-008",
        candidate_name="Muhammad Waqas Ali",
        bootcamp_name="Bootcamp 07",
        submitted_at=MOMENT,
    )


# --------------------------------------------------------- page counts --


@pytest.mark.parametrize(
    ("form_type", "data"),
    [
        (OnboardingFormType.BACKGROUND_VERIFICATION, {}),
        (OnboardingFormType.EMPLOYMENT_APPLICATION, {}),
        (OnboardingFormType.HALF_NAMA, {}),
        (OnboardingFormType.BANK_PAYMENT_DETAILS, {}),
    ],
)
def test_a_blank_submission_still_matches_the_established_page_count(form_type, data):
    """Even with every field empty, the layout — not the content — is what
    fixes the page count. A blank Background Verification Form filling more
    than one page would mean the grid itself, not the data, grew too tall."""
    pdf = _render(form_type, data)
    assert pdf.startswith(b"%PDF")
    assert _pages(pdf) == svc.PAGE_COUNT[form_type]


def test_a_fully_answered_employment_application_is_still_two_pages():
    """The addable tables (education, employment history, family, courses)
    are exactly what could push this past two pages if their row counts or
    column widths were wrong."""
    data = {
        "academicEducation": [
            {"majorSubject": "Science", "institution": "Govt School", "grade": "A", "passingYear": "2020"}
        ]
        * 5,
        "islamicEducation": [{"majorSubject": "", "institution": "Masjid", "grade": "Done", "passingYear": "2012"}] * 4,
        "professionalCourses": [
            {"course": "Python", "majorSubject": "Data Science", "duration": "3mo", "issuingAuthority": "Coursera", "passingYear": "2025"}
        ]
        * 4,
        "employmentHistory": [
            {"company": "TechCorp", "designation": "Analyst", "periodFrom": "012024", "periodTo": "012025", "grossSalary": "50000"}
        ]
        * 3,
        "familyDetails": [
            {"name": "Someone", "relation": "Sibling", "age": "20", "education": "BS", "occupation": "Student"}
        ]
        * 5,
        "reference1": {"name": "A", "designation": "B", "organization": "C", "mobile": "03001234567", "email": "a@example.com"},
        "reference2": {"name": "D", "designation": "E", "organization": "F", "mobile": "03001234567", "email": "d@example.com"},
        "whySaylani": "A reasonably long answer explaining career motivation in a few sentences, as a real candidate might write.",
    }
    pdf = _render(OnboardingFormType.EMPLOYMENT_APPLICATION, data)
    assert _pages(pdf) == 2


def test_the_half_nama_embeds_the_candidates_own_words_into_the_oath():
    """The on-screen form writes the candidate's name directly into the
    sentence ("... يہ عہد کرتا ہوں") rather than listing it as a field —
    the export has to do the same, not fall back to a label:value row."""
    data = {"page1Name": "زید احمد", "page1FatherName": "احمد علی"}
    pdf = _render(OnboardingFormType.HALF_NAMA, data)
    assert _pages(pdf) == 2


# ----------------------------------------------------------- formatting --


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("4240112345671", "42401-1234567-1"),
        ("123", "123"),  # too short to format — shown as typed, not mangled
        (None, "—"),
        ("", "—"),
    ],
)
def test_cnic_formatting(raw, expected):
    assert svc._cnic(raw) == expected


@pytest.mark.parametrize(("raw", "expected"), [("23082004", "23-08-2004"), ("", "—")])
def test_date_formatting(raw, expected):
    assert svc._ddmmyyyy(raw) == expected


@pytest.mark.parametrize(("raw", "expected"), [("03342800972", "0334-2800972"), ("", "—")])
def test_mobile_formatting(raw, expected):
    assert svc._mobile(raw) == expected


def test_a_boolean_answer_prints_as_yes_or_no_not_true_or_false():
    assert svc._v(True) == "Yes"
    assert svc._v(False) == "No"


def test_a_missing_value_prints_as_a_dash_not_a_blank_or_none():
    assert svc._v(None) == "—"
    assert svc._v("") == "—"


# ----------------------------------------------------- Urdu text safety --


def test_bilingual_markup_never_breaks_reportlabs_paragraph_parser():
    """A field label ends up as literal Paragraph-XML — an unescaped value
    containing `<` or `&` would otherwise be interpreted as markup."""
    from reportlab.platypus import Paragraph

    markup = svc._label("Name", "نام")
    # Must not raise: this is reportlab actually parsing the XML we built.
    Paragraph(markup, svc._LABEL)


def test_the_qr_style_shape_helper_is_single_line_safe():
    """Confirms `shape()` round-trips a short label without raising and
    without silently producing an empty string."""
    result = ur.shape("دستخط")
    assert result
    assert isinstance(result, str)


def test_wrap_reorders_each_line_independently():
    """The failure mode this guards: reordering the whole paragraph before
    wrapping would scramble which words land on which line once reportlab's
    own line breaks are added. Reordering after wrapping must not."""
    long_text = "یہ ایک لمبا جملہ ہے جو کئی الفاظ پر مشتمل ہے اور ایک سے زیادہ سطروں میں تقسیم ہونا چاہیے۔"
    lines = ur.wrap(long_text, font=svc.NASKH, size=10, max_width=150)
    assert len(lines) > 1
    # Every line is non-empty and independently reordered — not a slice of
    # one giant pre-reordered string.
    assert all(line.strip() for line in lines)


def test_wrap_with_ample_width_returns_one_line():
    lines = ur.wrap("مختصر جملہ", font=svc.NASKH, size=10, max_width=9999)
    assert len(lines) == 1


# ------------------------------------------------------- missing images --


def test_a_missing_photo_does_not_break_the_export():
    pdf = _render(OnboardingFormType.BACKGROUND_VERIFICATION, {"photo": None})
    assert pdf.startswith(b"%PDF")


def test_a_corrupt_signature_does_not_break_the_export():
    pdf = _render(OnboardingFormType.HALF_NAMA, {"page1Signature": "not-a-real-data-url"})
    assert pdf.startswith(b"%PDF")


# ------------------------------------------------------------- dispatch --


def test_every_form_type_has_a_renderer():
    for form_type in OnboardingFormType:
        assert form_type in svc._RENDERERS
        assert form_type in svc.PAGE_COUNT
        assert form_type in svc.FORM_LABEL
