# Task: Footer Rebuild (temporary branch, PR workflow)

## Context (read `project-status.md` first)

The shared branding component (`features/marketing/brand.tsx` —
`BrandLockup`/`BrandMark`) already renders the navbar, footer, portal
sidebar, and legacy admin shell from one place — the new footer must keep
using it, not fork branding again. The **dark, fixed-in-both-themes**
token pattern already exists for exactly this kind of surface —
`--nav-shell`/`--nav-shell-ink` was built for a bar that must stay dark
under white text regardless of light/dark mode. Reuse that token for the
footer's background rather than adding a new one, unless it genuinely
doesn't fit (say so if not, don't add a new token silently).

---

## 0. Branch + workflow — I create the branch myself, you wait

**Don't create the branch yourself.** Start by giving me the exact
command(s) to run to create the new temporary branch off `huzaifa` (and
switch to it). I'll run them myself.

Then **stop and wait** — do not start any of the work below until I come
back and say "continue." Once I do, you can assume you're on the new
branch and proceed.

My standing rule every prompt has carried still holds: **don't commit or
push until I say**, even after I tell you to continue — a branch existing
is not the same as permission to commit to it. Tell me explicitly when the
footer is ready for its first commit, rather than assuming "continue" also
meant "and commit whenever you're done."

---

## 1. One thing to flag before you build: the reference is off-topic in the middle

The provided screenshot is a footer from a **UI-component marketplace**
product. Its five columns are: Pages, Legal, Components, Resources,
Marketing. The **structure** (column layout, brand block, divider,
copyright line, decorative background treatment) is good reference
material. The **content of three of those five columns is specific to
that other product** — "Components" (Buttons, Cards, Modals...) and
"Resources"/"Marketing" (their own docs, Product Hunt, Indie Hackers,
Discord) describe a UI-kit business, not a bootcamp recruitment platform.
Do not port that column content over.

**Propose real replacement columns for our actual site** before building —
my starting suggestion, for you to adjust or challenge:
- **Pages**: Home, About, Programs, Admissions, Success Stories, FAQ,
  Contact
- **Legal**: Terms of Service, Privacy Policy (both real and already
  written — don't add Cookie Policy/Refund Policy/GDPR/Licenses unless
  those actually exist or are genuinely planned; don't invent policy pages
  that don't exist)
- Two more columns genuinely relevant to us — e.g. something like "For
  Candidates" (Apply, Track your application, FAQ) and "For Admins/Staff"
  (Dashboard/login) — or your own better idea. **Confirm the final column
  set with me before building the content**, since this is real content
  users will click, not filler.

## 2. Structural breakdown of the reference (layout only)

- Dark, full-width footer band.
- A grid of link columns on the left (four-plus in the reference), each
  with a bold heading and a vertical list of plain links beneath it.
- A wider brand block on the right: a small logo mark next to the
  wordmark, a short 2–3 line description beneath it, and a row of social
  icons below that (only include icons for accounts that actually exist —
  don't invent a Slack/Twitter presence we don't have; confirm what's
  real).
- A thin horizontal divider beneath the columns.
- A centered, muted copyright line below the divider.
- A very subtle, large-scale decorative background treatment bleeding off
  the bottom edge — low-opacity, purely atmospheric, not readable text
  competing with the real content above it. For us, build this from our
  own brand system (e.g. an oversized, very-low-opacity repeat of
  `BrandMark`, or a motif consistent with the existing `journey-scene.tsx`
  illustration style) rather than the reference's specific shapes —
  propose what you'd use before committing to it.

## 3. The wordmark + hover behavior

Wherever the reference shows its large bold wordmark ("Compos"), ours
reads **"Bootcamp Flows"** — reuse `BrandLockup`, don't hand-type it a
second time.

On hover, that specific wordmark gets an outline in the site's existing
theme accent color — **scoped only to the element actually being
hovered**, not a global hover state. Confirm with me: should this same
hover-outline treatment extend to the footer's other links and the social
icons too (for a consistent hover language across the whole footer), or
stay unique to the wordmark only? I'd lean toward consistent across all
interactive elements in the footer, but it's your call to make, not mine
to assume.

## 4. One thing I'm dropping from your list

The instruction about the "dashboard...user can click and see some
fields" doesn't apply here — that line reads like it carried over from an
earlier prompt about the homepage hero's dashboard preview, and this
reference image is a footer with no dashboard in it. I'm treating it as
not applicable to this task; flag me if you actually meant something
different by it.

## 5. Libraries

Shadcn's existing primitives should cover this (accordion for any
mobile-collapsed link groups, etc.). If something genuinely isn't covered
and a small, free, well-maintained library would help, go ahead and add
it — just tell me what you added and why once it's in, rather than asking
permission first for something this minor.

## 6. Animation

Enhanced, professional, smooth — column entrances via the existing
`Reveal`/`Stagger` primitives, a polished hover transition on links and the
wordmark's outline effect, and nothing that fights `prefers-reduced-motion`
(same standard as everywhere else in the app). This should feel distinct
and a little memorable, not a generic fade-in.

---

## Ask before deciding

- The final column set and its real content (section 1).
- What the decorative background treatment actually looks like (section 2).
- Whether the hover-outline treatment extends beyond the wordmark
  (section 3).
- When to make the first commit on the new branch (section 0).

## Ideas — for you to decide on, not built without sign-off

- A small "back to top" affordance in the footer, common on long marketing
  pages and cheap to add given the motion primitives already in place.
- Tying the footer's Programs links directly to the real program data
  (same source the Programs page itself uses) so it can never list a
  program that no longer exists.

## Hard constraints

- No large/structural decision made silently — ask first.
- **Do not `git commit` or `git push`** until I explicitly say so, even on
  the new branch (see section 0).
- Keep the test suite green; clean production build (0 type errors, 0
  lint errors) before calling anything done.
- Complete this properly — full footer, real content, real links, not a
  placeholder version.

Do your best on this.
