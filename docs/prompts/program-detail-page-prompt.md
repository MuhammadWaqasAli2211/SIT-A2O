# Task: Rebuild the Program Detail Page to This Reference Layout

## Important note on the reference itself

The provided screenshot appears to be a **real, live marketing page** (the
branding, copy, and specific numbers like "10,000+ students trained" read
as an actual site, not a generic template). Treat this the same way we've
treated every other reference screenshot in this project: **structure and
layout only.** Do not carry over its exact wordmark/logo (we have our own —
`BrandLockup`), its exact copywriting, or its specific numbers/claims — our
program detail page needs our own real content, sourced from our own data,
not this page's text relabeled.

---

## Structural breakdown to build to

### Hero
- Reuse the existing navbar (`BrandLockup`, nav links, search, theme
  toggle) — don't rebuild it for this page.
- A small pill badge naming the program's category/track.
- A large multi-line headline, with the final emphasis phrase in the
  accent color and a small underline flourish beneath it.
- A short descriptive paragraph.
- A CTA row: solid primary "Apply for this program" button (linking to
  the real application flow, not a dead link) and an outline secondary
  button ("Watch intro video" — **only include this if an actual intro
  video exists or is planned**; if not, don't ship a button that goes
  nowhere — confirm with me).
- A trust row: overlapping avatar circles plus a stat and a one-line
  description. **The number and the avatars both need to be real** — see
  "ask before deciding" below, don't invent a headline number or use stock
  photos of people who aren't actually connected to this program.
- Floating small badges scattered over the hero's background image/graphic
  (tech stack icons, short motivational phrase pills) — a nice place to
  use the existing motion primitives for a **subtle float/drift
  animation**, not static stickers.

### Stat bar
A white card strip directly beneath the hero, four columns, each: an icon,
a small caps label, a bold value, and a muted one-line note — e.g.
duration, format, level, seats. Pull these from the real program record,
not hardcoded copy.

### Curriculum (two-column body)
- **Left, wider column**: a small pill label ("Curriculum"), a bold
  heading, a short descriptive paragraph, then a **numbered list of
  modules** — each a card row with a number, bold title, muted description,
  and a trailing chevron (expandable, if the content warrants it). This
  needs to come from **real curriculum data** for the program — if that
  doesn't exist yet in whatever powers the Programs/Program-detail pages
  today, tell me rather than inventing six plausible-sounding module names.
- **Right, narrower column**, stacked cards:
  1. A tinted card: "By the end you can" heading + a short checklist of
     outcomes, each with a checkmark icon.
  2. A dark, brand-colored card: "Tools & technologies" heading + a grid of
     tech-logo tiles (see image sourcing below) relevant to *this specific*
     program's actual stack — don't reuse a generic MERN-stack icon set for
     a program that isn't MERN-based.
  3. A small tinted card with a short callout ("build real projects, not
     just theory" style messaging) and a link/arrow.

### "Explore more programs" (bottom section)
A full-width, dark brand-gradient section: a small pill label, a bold
centered heading, a short subtext, then a **grid of program cards** — each
with an icon, a background graphic relevant to that track, a title, a short
description, and a "View program →" link. **Pull this list from the real
programs API/data** so it always reflects whatever programs actually
exist — don't hardcode three specific programs into the page; if there are
more or fewer than three real programs, the layout should handle that
gracefully. End with a "View all programs" link/button.

---

## Image sourcing — this needs real care, not a scrape

You asked to pull images "from the internet" for this — here's how to do
that properly rather than just grabbing whatever shows up first:

- **Tech-stack logos** (React, JS, Node, HTML5, CSS3, MongoDB, Git, GitHub,
  Vercel, Postman, etc.): use an established **open-source icon set**
  built exactly for this purpose — e.g. Simple Icons or Devicon — rather
  than screenshotting/downloading a specific company's logo asset from a
  random page. These are free, properly licensed for this kind of use, and
  already vector/SVG.
- **Photographic elements** (the workspace/laptop-with-code hero photo,
  mug, notebook — if we want a similar photographic hero rather than an
  illustration): source from a genuinely free-to-use stock library
  (Unsplash or Pexels, both have proper free-use licenses) — don't hotlink
  or copy an image directly from someone else's live site, including the
  one in this reference screenshot, even if it looks like a natural fit.
- **Avatar/student photos**: do **not** use random stock photos of
  strangers implied to be "our students" — either use real, consented
  photos of actual alumni if we have them, or fall back to a simple
  illustrated/initials-based avatar treatment instead of implying specific
  real people who aren't actually connected to the program. This is a
  trust/honesty issue as much as a design one — confirm with me which
  option is realistic before building it.
- Keep every sourced asset's license/attribution requirement in mind — if
  a source requires attribution, note where that needs to live (e.g. a
  credits section) rather than silently dropping the requirement.

---

## Theme

Use our existing (or newly confirmed, if that's landed by the time this is
built) theme tokens throughout — this reference happens to lean green,
which may overlap conveniently with our palette, but map every color
through our actual tokens rather than copying this screenshot's specific
hex values directly.

## Animation

Floating hero badges get a subtle drift/float animation; card and list
entrances use the existing `Reveal`/`Stagger` primitives; respect
`prefers-reduced-motion` throughout, as everywhere else in the app.

---

## Ask before deciding

- Whether "Watch intro video" ships at all (depends on whether a real video
  exists or is planned).
- The real "students trained" style headline number and whether we have
  real, consented alumni photos to use for the trust-row avatars.
- Where real curriculum module data for this program actually lives (or
  whether it needs to be entered/created first).
- Which stock-photo source (Unsplash vs. Pexels vs. an illustration
  instead of a photo) you'd prefer for the hero, if a photographic
  treatment is even the right call vs. an original illustration consistent
  with the rest of the site's visual language.

## Scope — every program detail page, not just this one

Build this as a **reusable template/component**, not a one-off page for
the Web Development program. Every program (whatever exists in the real
program data — Mobile App Development, Data Science & AI, Cloud & DevOps,
and any others) needs the **same structural treatment**: hero with
category badge and stat row, curriculum module list, outcomes/tools
sidebar cards, explore-more-programs footer section — all driven by that
program's own real data (its own curriculum, its own tech stack, its own
duration/format/level/seats). Don't hand-build six near-duplicate pages;
one template, fed by each program's real record.

## Also carry this design elevation across the remaining sub-pages

The earlier footer/subpages redesign task already scoped **Programs
(listing), Admissions, About, Success Stories, FAQ, Contact** — this task
should raise those to the **same level of polish** established here:
proper image sourcing discipline (open-source icon sets, properly licensed
stock or original illustration — no scraped/hotlinked images, no stock
photos implying specific real people), animated entrances using the
existing motion primitives, and the same "stat bar / tinted card / dark
contrast section" visual vocabulary **where it genuinely fits that page's
actual purpose** — a FAQ page doesn't need a hero stat bar, an About page
might. Apply the structure each page type actually calls for (per the
research-driven breakdown already given in the earlier footer/subpages
task), not this exact program-detail layout copy-pasted onto pages it
doesn't suit.

---

## One thing to flag back to me

The message that added this instruction also included a large pasted block
of text — but reading it, that block is the **Agilytics integration
recap** from earlier in our conversation (HMAC signing, HR Assessment page,
the lost API spec), not anything related to sub-page design. I'm treating
that as accidentally attached rather than a real instruction for this
task, since nothing in it applies to program pages or sub-page redesign.
If there were actually specific details in there you meant to fold into
this task, tell me which part and I'll add it properly — I don't want to
force unrelated content into this prompt just because it was pasted
alongside the request.



- No large/structural decision made silently — ask first.
- **Do not `git commit` or `git push` anything** until I explicitly say so.
- Keep the test suite green; clean production build (0 type errors, 0
  lint errors) before calling anything done.
- Complete this properly — hero, stat bar, curriculum, sidebar cards, and
  the explore-more section, all wired to real data, not a partial version.

Do your best on this.
