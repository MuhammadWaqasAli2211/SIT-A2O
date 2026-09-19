"""Rendering Urdu/Arabic-script text with reportlab.

reportlab has no OpenType shaping engine (no HarfBuzz): it maps one Unicode
codepoint to one glyph via the font's cmap and nothing more. Arabic-script
text needs two things reportlab cannot do on its own:

  * **shaping** — a letter takes a different joined glyph form depending on
    its neighbours (isolated/initial/medial/final). `arabic_reshaper` does
    this in Python, output as legacy Unicode presentation-form codepoints
    (U+FE70-FEFF).
  * **bidi reordering** — Arabic/Urdu is read right-to-left; `python-bidi`
    reorders a *logical-order* string into the *visual* order reportlab
    will draw left-to-right.

Both are pure Python, no native dependencies — the same standard as every
other choice in this service.

## The font matters as much as the libraries

Noto Nastaliq Urdu — the font this app uses on screen — was checked first
and rejected: its cmap has none of the U+FE70-FEFF presentation forms
`arabic_reshaper` produces, because it is built for a real shaping engine
(HarfBuzz via a browser or Pango), not for presentation-form fallback. Text
set in it through reportlab draws nothing at all — verified directly, not
assumed.

Noto Naskh Arabic does carry the presentation-form block and renders
correctly, including Urdu-specific letters (retroflex ٹ ڈ ڑ, بڑی ye ے) —
also verified directly. It is a different, more upright style from the
flowing Nastaliq calligraphy the screen uses. That substitution is
deliberate and disclosed here rather than silently swapped: there is no
Nastaliq-shaped path available to reportlab at all, so this is not a
fidelity trade-off between two working options — it is the only one that
draws anything.

## Why wrapping needs its own function

A short field label ("نام", "دستخط") always fits on one line, so shaping
and reordering it once with `shape()` is enough. A multi-line paragraph is
not: reportlab's own line-breaking runs on the string *after* this module
has already reordered it into visual order, so a wrap that happens to fall
mid-sentence would splice together two different lines' worth of
already-reversed words. `wrap()` avoids that by reshaping once (joining is
stable per word — a space always breaks it) and then bidi-reordering each
line *after* that line's word boundaries are decided, never before.
"""

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.pdfbase.pdfmetrics import stringWidth

_reshaper = arabic_reshaper.ArabicReshaper(
    configuration={
        # Urdu, not Arabic proper: keeps ligatures off that would otherwise
        # combine letters Urdu text expects to stay visually separate.
        "language": "Urdu",
        "delete_harakat": False,
    }
)


def shape(text: str) -> str:
    """A short, single-line label or heading, ready to draw left-to-right.

    Not safe for anything that might wrap — see the module docstring.
    """
    return get_display(_reshaper.reshape(text))


def wrap(text: str, *, font: str, size: float, max_width: float) -> list[str]:
    """A paragraph's lines, each already shaped and reordered for drawing.

    Joining is resolved once, up front, on the whole string — reshaping a
    word in isolation gives the same result a space always breaks a joining
    run anyway — and then each line is bidi-reordered on its own once this
    function has decided where it ends, so a wrap can never fall inside an
    already-reversed run.
    """
    words = _reshaper.reshape(text).split(" ")
    lines: list[str] = []
    current: list[str] = []

    for word in words:
        candidate = [*current, word]
        if current and stringWidth(" ".join(candidate), font, size) > max_width:
            lines.append(get_display(" ".join(current)))
            current = [word]
        else:
            current = candidate
    if current:
        lines.append(get_display(" ".join(current)))
    return lines


def bilingual(en: str, ur: str, *, urdu_font: str, sep: str = " / ") -> str:
    """Paragraph-XML markup for an English label beside its Urdu twin.

    `<font face="...">` is reportlab's own inline-markup tag, so this can go
    straight into a `Paragraph`'s text — mixing two fonts, and two
    directions, in one run without either fighting the other's shaping.
    """
    return f'{en}{sep}<font face="{urdu_font}">{shape(ur)}</font>'
