# Task: Redesign the Footer and Every Marketing Sub-Page

## Context (read `project-status.md` first)

The homepage hero was just rebuilt (2026-09-03) on a shared branding
component (`features/marketing/brand.tsx` — `BrandLockup`/`BrandMark`) that
the navbar, footer, portal sidebar, and legacy admin shell all already
render from, plus a new `features/marketing/` module (`use-open-bootcamp`,
`dashboard-preview`, `journey-scene`, `application-flow-card`,
`site-search`), three new theme tokens (`--hero-canvas`, `--hero-ink`,
`--nav-shell`/`--nav-shell-ink`), and container-query-based responsive
layout (not viewport breakpoints, since a card's own rendered width doesn't
track the viewport once it sits inside a grid column). **Reuse all of this
— don't fork the branding or animation system a second time.**

Two things were explicitly flagged as unresolved in that last round, and
this task is a natural place to close them:
- The homepage's `ProcessSection` still reads from an older
  `ADMISSION_STEPS` dataset (4 stages) while the new hero card reads from
  the real `JOURNEY_STEPS` (5 stages, the actual `ApplicationStage` enum).
  This duplication is now visibly inconsistent on the same page.
- There's a local, unpushed `main`→`huzaifa` merge from 2026-09-01, and the
  hero work itself is also uncommitted. **Not in scope here** — see hard
  constraints, nothing gets committed or pushed regardless of what this
  task touches.

---

## Scope

**Full redesign, not a reskin**, of:
- The site-wide **footer**.
- Every marketing sub-page: **Programs, Program detail, Admissions, About,
  Success Stories, FAQ, Contact**.

Each page gets rebuilt properly — real structure and content hierarchy
appropriate to what that page is for, not just new colors on the old
layout.

---

## The one non-negotiable rule: theme stays exactly as-is

Do not introduce new colors, do not adjust the existing palette, do not
touch `--hero-canvas`, `--hero-ink`, `--nav-shell`/`--nav-shell-ink`, the
chart color tokens, or the base green primary/light/dark ramps. Every page
in this task pulls from the **existing token set only**. If a page
genuinely needs a color that doesn't exist yet, stop and ask — don't add
one silently the way the hero task explicitly was allowed to (that
exception does not extend to this task).

---

## Research first, per page — then implement

Before building each page, look at how the best current examples of that
*specific* page type are actually structured — footers, FAQ pages, about
pages, program/course listing pages, testimonial pages, contact pages —
and pull general, well-established structural patterns from what you find.
Starting points already gathered, to build on rather than start from zero:

- **Footer**: organize by clear intent-based groups (not a dumping ground
  for every link that didn't fit elsewhere), cap it at a handful of
  columns, put legal/compliance links (Privacy Policy, Terms of Service —
  both already real, written 2026-09-01) somewhere predictable, include a
  genuine support/contact path, and make sure it holds up on mobile
  (collapsible groups, real tap targets) — footers are where users go
  specifically to recover, verify, or find something they couldn't locate
  higher on the page, not to browse.
- **FAQ**: accordion-style questions, grouped by topic if there are enough
  questions to warrant it, a way to get to a real contact path for anything
  not answered ("still need help?"), and treat it as something people
  actually read before applying, not an afterthought — this platform's FAQ
  should answer real applicant questions (deadlines, what happens if an
  interview is missed, what documents are needed, what Agilytic onboarding
  is), not generic placeholder Q&A.
- **About / Success Stories / Contact / Programs / Program detail**: apply
  the equivalent research pass for each — the structural expectations for
  a program listing are different from a testimonials page, which are
  different again from a contact page. Do this per page type, don't reuse
  one generic template across all of them.

**Hard rule on copying:** pull structural/UX patterns only — page sections,
information hierarchy, interaction patterns (accordions, filters, etc.).
Never copy another site's exact layout pixel-for-pixel, its copy, its
imagery, or its branding. Everything gets built fresh in our own theme
tokens and component library.

---

## Resolve the ADMISSION_STEPS / JOURNEY_STEPS duplication

As part of rebuilding the Admissions and/or About page (wherever the
process explanation actually belongs after the redesign), replace the
stale 4-stage `ADMISSION_STEPS` content with the real 5-stage
`JOURNEY_STEPS` data — the same data source `application-flow-card.tsx`
and the candidate's own tracker already use, via the `JourneyStepper`
component's existing `numbered` mode built for exactly this kind of
marketing explainer. **Confirm with me before deleting `ADMISSION_STEPS`
outright** in case any other copy on the site still depends on the
4-stage framing — if nothing else references it, removing it is the right
call, just don't do it silently.

---

## Reuse existing building blocks

- `BrandLockup`/`BrandMark` for any branding in the new footer.
- `JourneyStepper` (`numbered`, `startOnView`) anywhere a process/step
  explanation is needed.
- The motion primitives (`Reveal`, `Stagger`, `Counter`, `Marquee`,
  `PageTransition`, `Typewriter`, `Countdown`) for entrances — respect
  `prefers-reduced-motion` throughout, as already established.
- `site-search.tsx`'s existing page index if any new page should be
  discoverable through the navbar search — extend its index rather than
  building a second search mechanism.
- Container queries (`@container`/`@lg:`/`@2xl:`) over viewport breakpoints
  for any component whose width comes from its layout column rather than
  the viewport directly — same lesson as the dashboard-preview fix.

---

## Ask before deciding

- Deleting `ADMISSION_STEPS` outright vs. leaving it unused but present.
- The exact footer link set — confirm what legal/support/social links
  actually exist and are real (don't invent a social media presence or
  a support channel that isn't real).
- Any new page section that would need a color outside the existing token
  set (should not come up if the rule above is followed, but flag
  immediately if it does).
- Any content decisions where real copy is needed and none exists yet
  (e.g. specific FAQ answers, program descriptions) — ask rather than
  inventing placeholder content that reads as real.

## Ideas — for you to decide on, not built without sign-off

- A "still need help?" contact trigger at the bottom of the FAQ page
  linking straight into the real Contact page/flow, per the FAQ research
  above.
- Reusing `Counter` for any stats shown on the About/Success Stories pages
  (e.g. programs offered, alumni placed) if real numbers exist to back
  them — flagged as illustrative if they don't, following the same
  "figures shown are illustrative" precedent set on the dashboard preview.

## Hard constraints

- **Theme colors are untouched — this is an order, not a preference.**
- No large/structural decision made silently — ask first.
- **Do not `git commit` or `git push` anything** until I explicitly say so
  (this includes the already-pending unpushed work from the last session —
  leave it exactly as it is).
- Keep the test suite green; clean production build (0 type errors, 0
  lint errors) before calling anything done.
- Complete this properly across every page listed in scope — footer plus
  all seven sub-pages — not just the easiest ones.

Do your best on this.
