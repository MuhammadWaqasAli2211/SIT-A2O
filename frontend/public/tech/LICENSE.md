# Technology icons

Every SVG in this directory comes from [Simple Icons](https://simpleicons.org),
vendored from `simple-icons` on jsDelivr rather than downloaded from each
company's own site.

## Licence

Simple Icons is released under **CC0 1.0 Universal** (public domain
dedication). No attribution is required and none is owed, which is why there
is no credits line anywhere in the app — this file is the record, not a
compliance gesture.

CC0 covers Simple Icons' *rendering* of each mark. It does not grant any right
in the underlying trademarks: React, MongoDB, Docker and the rest remain their
owners' marks. They are used here only to identify the technology a programme
teaches, which is nominative use, and must not be used in a way that suggests
any of those companies endorse or are affiliated with this programme.

## Why these are vendored rather than installed

The `simple-icons` package carries over 3,000 icons; this project needs about
twenty. Vendoring keeps the dependency list shorter and ships nothing unused,
and it matches how `public/logos/` already handles the hiring-partner marks.

Adding a technology to a programme's `skills` in `lib/site-data.ts` means
adding its SVG here and mapping it in `features/marketing/tech-icons.ts`. A
skill with no icon is not a bug — it falls back to a neutral glyph.

## How they are rendered

As CSS `mask-image`, not `<img>`. These are single-colour glyphs with no `fill`
attribute, so as an `<img>` they would paint solid black and stay black in dark
mode. Masking lets `background-color` supply the colour, so they take a theme
token and adapt to both themes.

`css3.svg` is from `simple-icons@11`; v12 renamed the slug and v13 dropped it.
Every other icon is from v13.
