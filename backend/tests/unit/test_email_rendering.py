"""Merge-field rendering and the plain-text fallback.

Admin-authored copy is untrusted input to a template engine: a stray brace or
a mistyped placeholder must not raise at send time and take a 200-person batch
down with it.
"""

import pytest

from app.services.email_service import _plain_text, render

CONTEXT = {
    "candidate_name": "Ayesha Khan",
    "candidate_code": "B07-014",
    "program": "Web & App Development",
    "bootcamp": "Bootcamp 07",
    "email": "ayesha@example.com",
}


def test_placeholders_are_substituted():
    assert render("Hi $candidate_name ($candidate_code)", CONTEXT) == "Hi Ayesha Khan (B07-014)"


def test_unknown_placeholder_is_left_alone():
    """A typo should be visible in the sent mail, not fatal to the batch."""
    assert render("Hi $candidat_name", CONTEXT) == "Hi $candidat_name"


def test_a_stray_brace_does_not_raise():
    """format() would explode here; Template must not."""
    assert render("Rate: {90%} for $program", CONTEXT) == "Rate: {90%} for Web & App Development"


def test_missing_context_key_becomes_empty_not_an_error():
    assert render("Hello $candidate_name", {}) == "Hello "


def test_repeated_placeholders_all_render():
    assert render("$candidate_code / $candidate_code", CONTEXT) == "B07-014 / B07-014"


@pytest.mark.parametrize(
    "html,expected",
    [
        ("<p>Hello</p><p>World</p>", "Hello\nWorld"),
        ("Line<br>Break", "Line\nBreak"),
        ("<h1>Title</h1>Body", "Title\nBody"),
        ("<a href='#'>Click</a>", "Click"),
        ("Tom &amp; Jerry", "Tom & Jerry"),
        ("&lt;not a tag&gt;", "<not a tag>"),
    ],
)
def test_plain_text_fallback(html, expected):
    assert _plain_text(html) == expected


def test_plain_text_survives_a_full_document():
    html = "<div><h2>Interview</h2><p>Dear $x,</p><p>See you <b>Monday</b>.</p></div>"
    text = _plain_text(html)

    assert "Interview" in text
    assert "Monday" in text
    assert "<" not in text
