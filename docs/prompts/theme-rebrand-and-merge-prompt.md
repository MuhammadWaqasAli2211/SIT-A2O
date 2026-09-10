# Task: Merge Main, Unify Dashboard UI, New Brand Theme, Radix UI, Real Logo

## Context (read `project-status.md` first)

As of 2026-09-03, `huzaifa` still has a **local, unpushed `main`→`huzaifa`
merge from 2026-09-01** sitting on top of the branch, plus uncommitted hero
work. Confirm the state of the tree before starting — don't assume it's
clean.

---

## Step 1 — Merge `main` into `huzaifa`

- Merge `main` into `huzaifa` and resolve any conflicts.
- This should bring in the admin dashboard UI update mentioned in the
  prompt — **diff what actually changed** in the admin dashboard between
  the pre-merge and post-merge state so you know precisely what pattern
  you're about to replicate elsewhere in Step 2, rather than guessing at
  "the new look" from memory.
- Run the full test suite after the merge before doing anything else —
  confirm it's still green on the merged tree, the same way previous
  merges in this project were verified.
- Still no commit/push beyond what the merge itself requires locally —
  don't push the merge or anything after it until I say so.

---

## Step 2 — Apply the same dashboard UI idea to candidate + super-admin

Once you know exactly what changed in the admin dashboard (Step 1), apply
the **same visual language and patterns** — not necessarily identical
content, since candidate/super-admin dashboards show different data — to:
- The **candidate portal's** own dashboard/overview screen.
- The **super-admin dashboard**.

Keep the actual data and information architecture appropriate to each
role (a candidate doesn't need admin stat cards, a super-admin's are
platform-wide vs. bootcamp-scoped) — this is about carrying over the
**design language** (card style, spacing, typography treatment, chart
styling, stat presentation) consistently across all three, not copy-pasting
the admin dashboard's literal content onto the other two.

---

## Step 3 — New theme, extracted from the logo — needs explicit confirmation first

**This is a genuinely large decision and directly reverses an earlier
instruction** (a previous task explicitly said "theme colors are
untouched — this is an order"). I'm treating this new request as
superseding that for this task specifically, since you've now asked for it
directly — but given how much of the app was already built against the
existing green-only palette across many previous rounds of work, **get
this confirmed with me before rolling it out everywhere**, not just
assumed from one instruction.

**Extract the actual colors programmatically from the real logo file**
(`frontend/public/logo.png`, see Step 6) — don't estimate visually. Write a
quick script (Python/PIL, or a small Node script with a color-extraction
library) to sample the real gradient stops from the image pixels directly,
since an eyeballed color from a screenshot won't be accurate enough to use
as a permanent design token.

What the logo visually appears to contain, as a starting reference only
(confirm against the real extracted values, don't take this as final):
a **diagonal gradient from a deep royal blue** (top-left) **through a
cyan/mid-blue transition, into a bright green** (bottom-right) — the green
end may already be close to the existing app green, which would make this
more of an *extension* (add blue as a new primary/gradient partner) than a
full replacement. Confirm with me which it actually is once you have the
real extracted values:
- **Full replacement** — blue/cyan/green gradient becomes the new brand
  identity everywhere, existing flat-green usage retired.
- **Extension** — existing green stays as the accent it already is, blue
  gets added as a new primary or a secondary brand color, used
  deliberately (e.g. gradients, hero elements) rather than replacing every
  existing green surface.

---

## Step 4 — Apply the confirmed theme platform-wide

Once Step 3 is confirmed:
- Update the **actual token definitions** (Tailwind config / CSS
  variables) centrally, so the change cascades everywhere in one place —
  do not hand-edit colors component by component.
- Every existing themed surface across the whole platform (navbar, footer,
  hero, admin/super-admin/candidate dashboards, buttons, charts, badges,
  the auth pages' `--auth-pane` token, `--hero-canvas`/`--hero-ink`,
  `--nav-shell`/`--nav-shell-ink`) needs to resolve against the new/updated
  tokens, not be missed.
- Verify both light and dark mode still work correctly with the new
  palette — don't assume it only needs checking in one mode.

---

## Step 5 — Animation

Enhanced across the board — extend the existing motion-primitive library
(`Reveal`, `Stagger`, `Counter`, `Marquee`, `PageTransition`, `Typewriter`,
`Countdown`) rather than introducing a second animation approach. Apply it
consistently to whatever in Steps 1–2 doesn't already have it. Respect
`prefers-reduced-motion` throughout, as established everywhere else in the
app.

---

## Step 6 — Font change — needs a decision from me first

You asked for a font change but didn't specify which typeface. **Ask me
directly which font, or confirm a specific direction** (e.g. a named
Google Font, or "match the tone of the new blue/green brand") before
picking one yourself — don't default silently to something that might not
match your actual intent. If it helps to have a starting suggestion: a
clean geometric sans (in the same spirit as the direction discussed for
the logo brief) would fit the tech/education tone, but that's a proposal,
not a decision already made.

---

## Step 7 — Radix UI

Check first: the project already uses shadcn/ui, which is itself built on
top of Radix primitives — so raw Radix may already be a transitive
dependency in `node_modules` even if it's never imported directly. Before
adding it as a first-class dependency, tell me **what specific capability
you need Radix for that shadcn's existing wrapped components don't already
cover** — if there's a specific primitive (a particular menu variant,
combobox behavior, etc.) driving this request, using it directly there
makes sense. If it's just "use Radix" generally with no specific gap, flag
that shadcn already gives you Radix's behavior for everything currently
built, so a from-scratch Radix usage risks duplicating what already exists
rather than adding real capability.

---

## Step 8 — Real logo

The logo now lives at `frontend/public/logo.png` — wire it into
`BrandLockup`/`BrandMark` (the shared branding component everything else
already renders from) so it replaces whatever placeholder is there now in
every place branding shows — navbar, footer, auth pages, favicon.

**Legibility flag**: this logo has real internal detail (small icons
embedded inside the ribbon shape, a fairly intricate gradient) — check how
it holds up at actual small sizes (16×16/32×32 favicon, navbar icon size)
before wiring it in everywhere. If it turns into a blur at those sizes,
tell me rather than shipping it broken small and only fixing it later —
a simplified icon-only variant for small contexts may be needed; don't
generate one without confirming first.

---

## Ask before deciding

- Full replacement vs. extension for the new theme (Step 3).
- The actual font choice (Step 6).
- Whether Radix is solving a real specific gap or would just duplicate
  shadcn's existing Radix-backed components (Step 7).
- Whether the logo needs a simplified small-size variant (Step 8).
- Anything the `main` merge surfaces that looks like a real conflict in
  intent, not just code (Step 1).

## Ideas — for you to decide on, not built without sign-off

- Once the new palette is confirmed, consider whether the homepage hero's
  hand-off between "STUDENT LIFE" (originally themed toward the old green)
  and the rest of the site should pick up the new blue/green gradient too,
  for visual continuity between the marketing site and the logo's actual
  identity.
- A dedicated small "app icon" export of the logo (just the ribbon/B mark,
  no surrounding whitespace) for favicon/PWA-icon use, separate from the
  full lockup — cheap to produce once the legibility check in Step 8 is
  done anyway.

## Hard constraints

- No large/structural decision made silently — ask first (see above).
- **Do not `git commit` or `git push` anything** beyond what's needed to
  complete the local merge in Step 1, until I explicitly say so.
- Keep the test suite green after every step, not just at the end.
- Clean production build (0 type errors, 0 lint errors) before calling
  anything done.
- Complete this properly across the whole platform — every step above,
  not just the easiest ones.

Do your best on this.
