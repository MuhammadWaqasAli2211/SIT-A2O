> **Branch:** `waqas` — last updated 2026-09-04

# Project Status

## Where things stand — 2026-09-04 (admin dashboard visual redesign)

**Bootcamp Dashboard redesigned for visual polish — same data, better
presentation.** No change to `BootcampStats`, no new API calls, no metric
removed or hidden.

- The second stat row (average score, attendance rate, rejected, new this
  week) now carries an icon per card and the same uppercase-label voice the
  pipeline funnel widget uses, reading as a clear secondary tier under the
  headline stat row instead of a flat duplicate of it.
- The by-stage Pipeline card now colours each stage with the same tone
  already used for its badge everywhere else in the app, shows each stage's
  share of the total next to its count, and holds a fixed stage order so a
  zero-count stage keeps its row instead of the list reshuffling.
- The by-program donut gets a centred total figure overlaid on the ring, so
  a single-category donut reads as one real data point instead of an
  unfinished-looking ring.
- The applications-over-time chart gets a distinct compact state for exactly
  one data point — a big figure with a short line, rather than either a
  misleading "no data" empty state or a chart with nothing to draw.

**21st Magic MCP connected and test-driven once.** Added as an HTTP MCP
server scoped to this project. One search call returned a good reference
match for a centred-label donut; its actual component code was **not**
installed (an external paid component would add an unreviewed dependency
and its own styling conventions on top of this project's established
design system) — the concept was hand-built instead using the existing
Recharts + Tailwind-token setup. Available for future UI work as a
reference/ideation source; not yet proven as a source of mergeable code in
this codebase.

**Verified without a live admin login.** No super-admin password was on
hand, and resetting one on the live production database was judged outside
a visual-only task's scope. Verified instead by rendering the real new
markup against the actual compiled Tailwind CSS via headless-browser
screenshots in light mode, dark mode, and a 390px mobile width — all three
clean.

**Verified:** clean production build, 0 type errors, 0 lint errors. Nothing
committed or pushed — awaiting explicit sign-off.

---

## Where things stand — 2026-09-03 (Physical Interview round, AI result announcement, pipeline funnel, search fixes)

**A second, in-person interview round now exists end to end.** Physical
Interview sits after the AI screening round: admins bulk-invite candidates
to a venue/date/time batch, candidates see their own pending/selected/
rejected/missed status (internal rejection notes never exposed to them),
and recording a result advances the application's stage through the same
`application_service.advance_stage` path every other stage move already
uses — so the transition, audit row, and notification all happen the one
way they already happen everywhere else. New tables:
`physical_interview_batches` and `physical_interview_invites`, deliberately
separate from the pre-existing `interviews` table, which serves the AI
round.

**AI interview results are now announced in bulk, not revealed the instant
each candidate finishes.** A candidate who has completed sees a plain
"completed" status with no score until an admin announces the whole
intake's results at once — score and verdict stay hidden until then.
Announcing moves every invited candidate on in the same pass: passes go to
Physical Interview, failures and unscored records go to Rejected. Hiding
the announcement again reverses only the visibility, never those stage
moves — a deliberate, stated asymmetry. Candidates see their result once
via a one-time reveal popup, stamped seen only after it has actually been
shown (a mount-time stamp was caught and rejected before shipping — it
would have unmounted the popup before anything was read).

**The manual "move to any stage" override is now super-admin only**, on
both the API (`POST /applications/{id}/stage` and `/reinstate`) and the
admin UI's stage dropdown. Ordinary admins keep every routine path —
announcing AI results, recording a Physical Interview outcome — since both
already move stages as a *consequence* of a real decision through their own
endpoints; only the unrestricted, gate-skipping override was narrowed.

**Two live UI bugs fixed app-wide:** every toggle/switch in the app had its
thumb able to drift outside its track and sit on top of adjacent text (most
visibly, the Phases screen's "Open" label briefly reading as "pen") — fixed
once in the shared `Switch` primitive, covering every instance. Separately,
the Physical Interview invite dialog's "Some fields are invalid" error was
a page-size request (200) exceeding the backend's actual cap (100), not an
invalid field.

**Every search box in the app was audited, not assumed broken.** Ten found;
nine were verified working end to end against live data. The one dead one
— the portal navbar search, an input with no handler at all, shown even to
candidates with nothing to search — is now removed for candidates and
turned into a real staff jump-to-search that seeds the Candidates page via
a URL search param.

**The dashboard's pipeline funnel widget was redesigned** from loose
numbers into proportional segmented bars sized by real share, with a
connector showing the count that actually crossed from the AI round into
the Physical Interview round, in both its compact (Dashboard) and detailed
(Candidates) placements.

**Verified:** 349 backend tests pass (up from 324), clean production build,
0 type errors, 0 lint errors, both new migrations confirmed applied on the
live database via the migration ledger (not assumed from the file's
presence). Committed as 26 one-file-per-commit changes and pushed to
`origin/waqas` after explicit sign-off; `main` and `development` untouched
throughout.

---

## Where things stand — 2026-09-03 (homepage hero rebuild + "Bootcamp Flows" rebrand)

**Rebrand, UI surfaces only.** The wordmark, browser-tab title, and meta/OG
tags now read "Bootcamp Flows" instead of "Saylani Mass IT Training" — the
navbar, footer, portal sidebar, and the legacy admin `AppShell` all render
from one new shared component (`features/marketing/brand.tsx`:
`BrandLockup` + `BrandMark`, an original inline SVG mark) so the four
cannot drift back out of sync the way the old copy-pasted markup would
have let them. **Deliberately not touched:** the email "from" name
candidates already recognise mid-intake, and the Privacy Policy / Terms of
Service legal text, which names *Saylani Welfare International Trust* as
the actual operating entity — renaming that would make it factually wrong
unless the trust itself is renamed. Flagged back to the user rather than
decided silently; the request had asked for three mutually exclusive
scopes at once (UI-only, +email, +legal text).

**Homepage hero rebuilt to a supplied reference design.** New
`features/marketing/` module:

- `use-open-bootcamp.ts` — the "Admissions open for Bootcamp NN" badge now
  reads the real, currently-open intake from the existing public
  `/bootcamps/open` endpoint (the same one `registration-form.tsx` and the
  registration-closed dialog already trust) instead of a hardcoded string.
  Absent entirely, not shown stale, when nothing is open.
- `dashboard-preview.tsx` / `preview-charts.tsx` / `preview-data.ts` — a
  floating preview of the real admin dashboard: icon rail, stat cards that
  count up via the existing `Counter` primitive, a real Recharts area
  chart with a working period dropdown, and a donut chart whose legend
  rows and ring segments highlight together. **The figures inside are
  illustrative**, not live aggregates — decided explicitly with the user
  rather than assumed either way, because `/bootcamps/open`'s own schema
  comment says it is "deliberately narrower ... no counts," and a new
  public endpoint would mean publishing a quiet week's low application
  count to anyone. `preview-data.ts`'s header documents the exact
  real/illustrative split. The card carries an on-screen "figures shown
  are illustrative" line, not just an aria-label, so the caveat reaches
  everyone, not only screen-reader users.
- `journey-scene.tsx` — the "student life → professional life" transition
  panel is original, hand-authored inline SVG, not a photo, stock asset,
  or generative-tool output. Both figures are deliberately featureless
  silhouettes (a head is a plain circle — no face, no skin tone, no hair)
  so the panel depicts a role, not a real, identifiable person.
- `application-flow-card.tsx` — the bottom "Application Status" card
  renders the *same* `JOURNEY_STEPS` data and `JourneyStepper` component a
  candidate sees on their own tracking page, not a re-typed copy, so it
  cannot silently advertise a process the `ApplicationStage` enum no
  longer runs.
- `site-search.tsx` — the navbar's "Search anything…" pill is a real
  client-side search over the programme catalogue and page index, not
  decorative chrome; a box that takes text and does nothing was judged
  worse than not having one.

**`JourneyStepper` gained two additive props**, both off by default so the
three existing call sites (candidate track page, empty-dashboard demo,
registration form-stepper) are unaffected: `numbered` (position pips +
per-segment checkmarks, for the marketing explainer) and `startOnView`
(hold the one-shot demo sequence until scrolled into view, for a stepper
that sits below the fold).

**Three new theme tokens**, following the existing `--auth-pane` pattern
(deliberately fixed-dark in both light and dark mode, so a bar that must
stay dark under white text can't invert): `--hero-canvas`, `--hero-ink`,
`--nav-shell` / `--nav-shell-ink`. The gold/blue/red accents the hero also
needed were **not** duplicated — `--chart-3`, `--chart-2`, and `--chart-5`
already are those exact colors.

**Two layout bugs found during the build, not shipped:**

- The transition illustration originally used `preserveAspectRatio="...
  slice"` on a fixed-height band, which crops *more* content as the
  viewport widens — at a 2560px screen it would have scaled by ~2.1x and
  cut both figures off at the neck. Rewritten at a 1600×380 viewBox with a
  matching `aspect-[1600/380]` container and `meet`, so the scene is never
  cropped at any width; the 26-tower skyline was verified programmatically
  to close at exactly x=1600 with no gaps.
- The dashboard preview's internal grid was originally keyed to viewport
  breakpoints (`lg:grid-cols-4`), but its actual width comes from its grid
  *column*, which does not track viewport breakpoints — at 1280px it is
  ~600px wide (hero split in two) while at 1024px it is ~960px (hero
  already stacked), so the old breakpoint would have laid out four stat
  cards exactly where the card is narrowest. Switched to CSS container
  queries (`@container` / `@lg:` / `@2xl:`) so the card's own rendered
  width governs, verified present in the built CSS output.

**Not built, flagged rather than assumed:** scroll-triggered parallax
between hero → transition scene → step-flow card was listed in the
request as an idea needing explicit sign-off, and no sign-off was given —
only the existing `Reveal`/`Stagger`/`startOnView` scroll-into-view
entrances were used. Also surfaced: the homepage's `ProcessSection`
further down the page still reads from the older `ADMISSION_STEPS` data
(4 stages, "Four stages, clearly defined") while the new hero card reads
from the real 5-stage `JOURNEY_STEPS` — a pre-existing duplication this
change made newly visible. Not resolved without the user's steer on which
side should give way.

**Verified:** 324 backend tests pass (untouched — frontend-only change),
clean production build, 0 type errors, 0 lint errors. Nothing committed
or pushed — a `main`→`huzaifa` merge from 2026-09-01 also remains local
and unpushed, pending explicit instruction on both.

---

## Where things stand — 2026-09-01 (real Privacy Policy / Terms of Service)

**The registration-time policy dialogs no longer show placeholder text.**
`features/registration/policy-dialog.tsx` previously described its own
content as "not written as binding legal language" and showed applicants an
in-dialog banner saying so, while a candidate accepted it and submitted a
CNIC. Both are now real, tailored to what this platform actually does —
every field the registration form and onboarding stage actually collect,
named individually (down to father's CNIC, the B-Form substitution under
18, and the signature captured on the Half Nama form); the three outside
providers that process candidate data on Saylani's behalf, named
individually (Supabase for hosting/storage, Gmail for delivery,
InterviewerAI for the recorded, proctored AI screening interview) rather
than left as an unspecified "third parties"; per-intake admin scoping and
the audit trail, both of which already exist in this codebase, stated as
what they are; the deadline/missed-deadline-explanation flow already built
for interview invites, described accurately rather than glossed over; and
real contact details (`admissions@saylaniwelfare.com`, the phone number and
head-office address already shown on the public Contact page) rather than
invented ones.

**Deliberately not claimed: legal review.** This is accurate, plain-language
description of the platform's real practices, not attorney-reviewed
language — the file's own top comment says so. Recorded here as an honest
open item, not silently glossed over: a document real applicants accept
while submitting a national ID number is worth a lawyer's pass before this
goes live to the public, particularly given Pakistan's evolving personal
data protection legal landscape and that minors' data is in scope.

**A version-tracking gap was found, not fixed.** `terms.ts`'s
`TERMS_VERSION` is recorded per-application and governs the three
declaration checkboxes, but the Privacy Policy / Terms of Service text
itself has no equivalent — `POLICY_EFFECTIVE_DATE` is shown in the dialog
today but not persisted per-applicant. If this policy text changes after
real applicants have accepted it, there will be no record of which wording
a given applicant actually saw. Not built here: it needs a new backend
column and is a schema change, not a copy change — flagged for a decision
rather than assumed.

**Verified:** 324 backend tests pass (untouched — this was a frontend-only,
static-content change), clean production build, 0 type errors, 0 lint
errors.

---

## Where things stand — 2026-08-31 (Student's Folder: onboarding forms + Documents Hub)

The 3 pixel-perfect onboarding form replicas (built earlier as an admin-only
preview) are now a real, submittable candidate flow, plus a new Bank &
Payment Details form and a 7-tab Documents Hub, plus the full admin review
side. Built in this order: schema → backend endpoints → student-side flow →
admin-side review, each phase reviewed and approved before the next started.

**Gating.** "Student's Folder" (renamed from "Documents" in the candidate
sidebar) stays locked until `application.stage` reaches `FORM` or
`ONBOARDED` — i.e. once Physical Interview clears. Enforced twice: the
sidebar row (`portal-nav.ts`'s `requires: 'onboarding'`) and a real route
guard (`RequiresOnboardingUnlocked`), same double-layer pattern
`RequiresApplication` already established — a locked nav row is not an
access boundary on its own.

**The 4-item sequence.** Background Verification → Employment Application →
Half Nama → Bank & Payment Details, one at a time. Locking is derived, not
stored: `onboarding_form_service.unlocked_map()` walks the fixed order and a
form is reachable only while every predecessor is `SUBMITTED` — a `REOPENED`
predecessor counts as not-submitted, which is the entire mechanism behind
"reopening one form re-locks everything after it" with no extra state to
keep in sync. The Documents Hub unlocks the same way, off all 4 being
`SUBMITTED`.

**PDF stays client-side, deliberately not stored.** Submitted data is the
source of truth (JSONB), not a rendered PDF file — "download PDF" is the
same `window.print()` + CSS approach already verified for A4 fidelity,
applied to a read-only render of the submitted data. Avoids a server-side
headless-browser dependency (Playwright) purely to re-render what the
browser already renders correctly, and never goes stale relative to what was
actually submitted.

**Documents Hub: 7 tabs, age-reactive.** Personal ID (CNIC vs B-Form) and
Bank/Easypaisa proof swap which type is asked for based on
`app.core.age.is_adult(date_of_birth)` — one function, mirrored in
`frontend/src/lib/age.ts`, both replacing three near-duplicate copies of the
same calendar-correct age formula that had accumulated across registration
and this feature. Educational Documents and Experience Letters hold several
files at once (`onboarding_documents` has no unique-per-type index, unlike
every other type here); everything else supersedes on re-upload, same rule
`document_service.upload()` used to enforce for the checklist this replaces.

**Admin side.** `/admin/onboarding`: bootcamp-scoped candidate-folder list
(search by code or name), a progress summary per row so admin can scan
without opening every folder. Per candidate: the 4 forms read-only (view +
print, no approve/reject — there's nothing on a candidate's own filled
paperwork for an admin to accept or reject the way a blurry CNIC scan can
be), each document approve/reject individually with a required rejection
reason, and a "Reopen for correction" action with an optional note the
candidate sees.

**The old pre-onboarding document checklist is gone, not just replaced.**
CNIC front/back, Photo, Qualification, Bank Letter — the `documents` table,
`document_type` enum, `document_service.py`, both candidate and admin pages,
and their routes. Zero rows existed in `documents` in production before
removal (checked directly, not assumed), and nothing else in the codebase
referenced any of it — confirmed with a full grep pass before deleting
anything. `document_status` (PENDING/ACCEPTED/REJECTED) survives; it's
shared with the new `onboarding_documents` table.

**Migrations applied and verified live** (`20260831100000`,
`20260831110000`): `onboarding_form_submissions`, `onboarding_documents`, 3
new enum types, RLS on both new tables; `documents`/`document_type` dropped.
All checked directly against the schema post-apply, not just the ledger.

**Verified two ways, since the live database has exactly one real
application row and it currently can't be read at all** (see the flagged
issue below) — so no full browser click-through as a real candidate was
possible this round:

1. A real-DB, real-Storage integration pass: created a temporary application
   for the real `thewaqasali59@gmail.com` profile under Bootcamp 07 (additive
   only — never touched the existing broken row), ran the full cycle through
   the actual service functions — sequential submit, out-of-order rejection,
   reopen, re-lock, resubmit, re-unlock, single-file supersede vs multi-file
   coexistence, approve, reject-with-reason, delete-blocked-when-accepted,
   admin folder-list summary counts — 18/18 checks passed, everything
   (including uploaded Storage objects) deleted afterward.
2. Real HTTP against a running server via `TestClient`, auth bypassed only
   at the token-verification step (no password available, so the actual
   route/permission/serialization layer was exercised for real rather than
   guessed at): `GET /bootcamps/{id}/onboarding/candidates` returns a clean,
   correctly-shaped empty list for both bootcamps — confirming the one
   broken application row is excluded by the stage filter before SQLAlchemy
   ever tries to hydrate it, so this endpoint is unaffected by the issue
   below.

Backend: 305/305 tests pass (45 new). Frontend: build and `oxlint` clean.

**Flagged, not fixed — explicitly left alone per instruction.** The live
`application_stage` Postgres enum contains `AI-INTERVIEWED` where every
migration file and `enums.py`/`types.ts` say `INTERVIEWED` — changed
directly against the database outside the migration system at some point,
by something not tracked in `supabase/migrations`. The one real application
row (`B08-015`, the `thewaqasali59@gmail.com` account) sits at that value
right now, which means `GET /applications/mine`, the admin candidates list,
admin application detail, and dashboard stage-breakdown all 500 for that
row today — confirmed directly, traced to `application_service.my_applications`,
nothing to do with this round's changes. Left untouched on request; still
open.

## Where things stand — 2026-08-30 (closing Phase 3)

Three gaps flagged when asked to "complete Phase 3" — all three approved and
built, plus the pass/fail threshold you supplied (**50/100**).

**1. A score no longer dead-ends on a screen.** The completed-interview
report now carries "Advance to Physical Interview" / "Reject" buttons, right
where the score is being read. They call the exact same endpoint the
Candidates screen's own stage control already uses
(`applicationApi.advanceStage` → `POST /applications/{id}/stage`) — no new
backend action, no new permission model. Shown only when the record resolves
to a real, still-ACTIVE application that hasn't already moved past this
point; a manual/Instructor invite (no application behind it) gets no buttons
at all. Verified live against a real ACTIVE application and rolled back:
`INTERVIEW_SCHEDULED` → `PHYSICAL_INTERVIEW`, `is_selected` set `True`.

**2. Admins are now notified when a candidate finishes.** The honest
mechanism, stated plainly rather than glossed over: **this backend has no
scheduler and InterviewerAI sends no webhook**, so "a candidate just
finished" is only knowable when something asks their own status — which the
candidate's own interview page already polls every 10s. Detection piggybacks
on that existing poll (`candidate_score()`), guarded by a new
`admin_notified_at` timestamp on `interview_invites` so a notification is
created once, not on every subsequent poll. Falls back to active super
admins if the bootcamp has no admin assigned — same fallback
`submit_deadline_explanation` already uses. **The trade-off, named
outright:** an admin is notified the next time that candidate's browser
happens to poll after finishing, not the instant InterviewerAI marks it
complete. A real webhook or a scheduled poll would remove the dependency on
the candidate's tab being open; neither exists in this codebase today.

The notification system itself widened from candidate-only to any
authenticated role to carry this — every route was already scoped to
`user.id` internally, so the change is additive, not a new exposure. The bell
now renders for every signed-in role, not just candidates.

**3. Pass/fail wording is live, deliberately not final.** `PASS_THRESHOLD =
50.0` in `ai_interview_service.py`, mirrored as `AI_PASS_THRESHOLD` in
`records.ts` (two runtimes, one constant, cross-referenced in both places so
a future change is caught by grep). `CandidateScore.passed` is a fact about
the number, not an automated verdict — nothing auto-rejects on it, which is
why the candidate-facing copy says "below the pass mark" rather than
"failed," and explicitly notes the admissions team makes the final call.

**Verified:** 273 backend tests pass (7 new — the threshold constant, the
notify-once-per-completion guard, the notify-every-assigned-admin fan-out),
clean production build, 0 type errors, 0 lint errors. One real bug caught and
fixed before it shipped: the new stage-advance buttons initially called
`useMutation` after two conditional early returns, which breaks React's
Rules of Hooks — moved the hook calls above every return.

**One migration mistake caught in verification, not by anyone else:** the
`admin_notified_at` column first landed on the wrong model
(`InterviewInviteBatch`, batch-level) instead of `InterviewInvite`
(per-candidate row) — text-matched on the wrong `deadline_at` comment nearby.
Caught immediately by a live smoke test (`UndefinedColumn` on the *other*
table), fixed before the migration mattered.

---

## Where things stand — 2026-08-29 (Completed Interviews)

**A filterable, exportable roster of every finished AI interview**, built on
top of the 2026-08-29 lifecycle/performance work. `list_completed()` in
`ai_interview_service.py` costs exactly **one DB query and one external HTTP
call** regardless of row count or whether the view is bootcamp-scoped or
platform-wide — the same round-trip discipline as the dashboard fix, verified
live: 1 query / 1 call / ~2s (external API latency, not ours) for the
platform-wide read.

**Status filtering happens on our side, not theirs.** Their `status=`
query param is unverified — the same undocumented-API problem that already
caused a real bug once (`"complete"` vs `"completed"`, see
`interview_invite_service.py`). Trusting their filter risked silently
returning nothing; fetching everything and filtering with the existing
`is_completed()` tolerant-spelling check does not.

**Structural call made without a prior question, flagged here:** the
super-admin "platform-wide, filterable by bootcamp" requirement does not fit
inside the existing `/admin/ai-interviews` screen — that page is locked to
one bootcamp at a time via the shared `BootcampSwitcher`, with no "all
bootcamps" mode. Every other cross-cutting concern in this app already splits
the same way (`bootcamp_stats`/`platform_stats`, `/admin` vs
`/super-admin/analytics`), so this got the same treatment: a new
`/super-admin/ai-interviews` page, platform-wide by default, filterable down.
It shares one component (`CompletedInterviewsPanel`) with the admin tab —
nothing is duplicated between the two.

**Two private helpers were promoted to shared utilities** rather than
written a third time: `relativeTime()` ("2h ago") lived inside the
notification bell, `downloadCsv()` lived inside the candidates page. Both now
live in `lib/format.ts` / `lib/csv-export.ts`, and their original call sites
were refactored to use the shared version — same pattern as promoting
`Switch` out of the interview-invite dialog on 2026-08-29.

**Search and the track/bootcamp filters are entirely client-side** over the
single fetched batch — there is nothing to page through at current volumes,
and re-filtering an in-memory array costs nothing worth a network round trip
over. Export ships exactly what's currently filtered on screen, matching the
existing candidates-page export's behaviour.

**Verified:** 266 backend tests pass (13 new, covering the stat-card date
math and the admin-without-bootcamp refusal), clean production build, 0 type
errors, 0 lint errors. Confirmed live against real data: Muhammad Waqas Ali
(B08-014, Data Science & AI, Bootcamp 8) and Vera (no application — a manual
invite row) both resolve correctly with names, bootcamp and score intact.

---

## Where things stand — 2026-08-29 (interview lifecycle, live status, performance)

**The admin dashboard was taking 4.3 seconds. It now takes 0.9.** Profiled
rather than guessed: it was issuing **18 sequential queries**, and the
database is a pooler roughly **106ms away**, so the cost was almost entirely
round trips rather than query work — there are only 4 applications in the
table. Nine of those were separate `count(*)` statements that Postgres does
in one pass with `count(*) FILTER (WHERE ...)`, and `get_bootcamp` was
eager-loading phases and programs for a function that reads four scalar
columns. **18 queries → 8, 4343ms → 939ms.** Platform stats went 13 → 11.

Worth carrying forward: at ~106ms per round trip, **query count is the whole
performance story on this project**, not query cost. An N+1 that would be
invisible against a local database is seconds here.

This also settles the react-query question: it points the other way. The fix
was server-side query collapsing, so the hand-rolled `use-async` hook stays.

**Interview invites now have a lifecycle.** An invite can only go out while
the intake's INTERVIEW phase is open — the same `assert_phase_open`
flag-and-clock gate registration uses, not a second mechanism — and the phase
must have a deadline set, or the send is refused outright. There is no
default: an invite with no deadline is a link that works forever.

The deadline is **snapshotted onto the batch** at send time rather than read
live, so an admin editing the phase later cannot retroactively expire links
that were valid this morning. Past it, the candidate's status becomes
`expired` and the link stops being honoured. **We enforce this, not
InterviewerAI** — their OpenAPI spec has no invite-expiry concept at all
(their only "expiry" terms are password-reset codes, API keys, and an
in-session timer), so nothing on their side would have done it.

**Missed deadlines hold, they do not reject.** The application stays exactly
where it is — no automatic rejection, no automatic progression. The candidate
sees a live `Countdown` to the deadline beforehand, and afterwards a form to
write to the intake's administrators. **No AI judges the reason** (decided
2026-08-29): a person reads it. The explanation is stored as an `email_log`
row (also decided) and the reason text goes into the audit trail either way.
Unsticking a candidate is an ordinary stage move, which is already audited.

Known trade-off, taken knowingly: `email_log` is a delivery record with no
decision column, so there is no accepted/declined state — the candidate sees
"sent", not a verdict.

**"Unknown candidate" is fixed at the source.** It was the frontend reading
the name out of InterviewerAI's undocumented payload, which may carry no name
under any key we recognise. The name is now joined server-side from our own
invite and application rows and attached as `local` on each record, so the UI
never guesses. Verified: a payload carrying only `candidate_id: 271` resolves
to "Muhammad Umar Khan / B08-011".

**Live status, without the dependency.** Decided 2026-08-29 as *polling now,
realtime later*: `useLiveResource` refreshes on a fast cadence while the tab
is visible and backs off when it is not, behind a narrow enough contract that
swapping in Supabase Realtime later is one module. A `LiveIndicator` shows
when the data last landed. What this avoided for now: `@supabase/supabase-js`
is not installed, and the `supabase_realtime` publication contains **zero
tables**, so realtime would have needed a dependency *and* a migration. The
RLS side was already fine — `applications_select_own` exists.

Stale reads were fixed at the source too: `ApplicationProvider` is the single
copy of the candidate's stage that the tracker, stepper, interview screen and
locked nav rows all read, and it fetched once on mount. It now refreshes in
the background, so one fix covers every screen downstream.

**The report UI was rebuilt, not reskinned.** It previously fetched the
report, the recording and every snapshot the moment it opened — three
external calls to answer a question nobody had asked — and stacked them in
one scrolling column. Now the score leads (via `Counter`), the per-question
breakdown is scannable rows that expand for the answer, and evidence sits
behind its own tab that does not fetch until opened.

**Routing was audited and left alone.** Every route already sits behind the
right guard and the hierarchy is consistent; there was nothing to fix, so
nothing was changed. One naming observation: `/admin/interviews` (our
physical round) and `/admin/ai-interviews` (the external one) are similar
names for genuinely different things.

**Verified:** 253 backend tests pass (12 new, covering deadline expiry and
the explanation gate), clean production build, 0 type errors, 0 lint errors.
Expiry transitions confirmed against the live database and rolled back:
before → `invited`, after → `expired` with the explanation route open, no
deadline → not retroactively expired. Migration `20260829140000` applied.

---

## Where things stand — 2026-08-29 (AI Interviewer, role-gated)

**The AI Interviewer integration now covers results, not just sending.** A new
scoped API key (ten scopes) replaced the send-only one, and the whole partner
surface is wired through our own FastAPI routes: interviews, reports,
recordings, proctor snapshots, reinterview decisions, analytics and their
audit log. The key never leaves the backend.

**The access model, as built:**

| | |
|---|---|
| `CANDIDATE` | Their own overall score and nothing else. `CandidateScore` carries four fields and has no field able to hold question data, snapshots, recordings or audit entries — the boundary is the schema, not a UI filter |
| `ADMIN` | Every read, scoped to their own intakes. **No writes at all** by default |
| `SUPER_ADMIN` | Everything, and grants individual write scopes to individual admins |

**Permissions are a table, not a flag.** `admin_permissions`
(`profile_id`, `scope`, `granted_by`, `granted_at`) with a native `ai_scope`
enum holding only the four *write* scopes — reads are not grantable because
they are never withheld from an admin. Grant and revoke are idempotent and
both land in the existing audit trail. Screen at
`/super-admin/permissions`.

**Four things were decided rather than assumed** (2026-08-29): the permission
table over bundles; `invites:send` extends the existing bulk flow while
`interviews:delete` stays separate from our own Phase 3 cancel; their audit
log stays a separate read; and their candidate id is now stored on
`interview_invites` with an email fallback.

**Three findings worth carrying forward:**

1. **Their `/api/v1` responses are undocumented.** The OpenAPI spec types
   query parameters but leaves every response schema empty, and there are no
   component schemas for score/report/proctor. Everything is parsed
   defensively — `extract_score` looks under six key names and three nested
   containers, and returns `None` rather than guessing.
2. **Their tenant is empty.** Zero interviews, reports, snapshots,
   recordings, reinterview requests or audit entries as of 2026-08-29, so no
   read surface has been verified against real data. Only the shapes are
   built; the first real interview is what will confirm them.
3. **Two of their endpoints cannot be intake-scoped.** `/audit-log` and
   `/analytics/summary` are tenant-wide with no filter, so the audit read is
   super-admin only and an admin's analytics are computed from their own
   bootcamp's interviews instead of passed through.

**Still open — needs your answer:** what "overall score" actually means
numerically (raw, percentile, or a band) and where the pass threshold sits.
The candidate card deliberately shows the number with no pass/fail wording
until that is confirmed, because telling someone they failed against an
invented threshold is worse than showing a bare score.

**Bug found and fixed while testing:** `delete_interview` checked bootcamp
scope before the permission scope, which meant an admin holding no delete
grant could tell an existing interview id from a missing one by whether they
got a 404 or a 403. Permission is now the first gate, with a regression test
pinning the ordering rather than only the outcome.

**Verified:** 241 backend tests pass (39 new, covering the gating), clean
production build, 0 type errors, 0 lint errors, all 16 new routes registered
and returning 401 unauthenticated. Migration `20260829120000` applied to the
live database and recorded in the ledger.

---

## Where things stand — 2026-08-28 (notifications)

**The header bell does something now.** It was decorative — no click handler,
a hardcoded unread dot, and no backend behind it. Candidates now get a
notification when their application passes or fails a stage, created from
`application_service.advance_stage()` since every stage move already funnels
through that one function. Polls every 30s; click marks read.

Scoped to candidates deliberately: there is no staff notification source yet,
so the bell renders only for them rather than showing an empty panel to
admins. New `notifications` table, migration `20260828120000`, applied.

**Also fixed:** the bootcamp switcher showed a raw UUID until the dropdown had
been opened once. Base UI's `Select.Value` can only render a label once its
matching item has mounted, and the selection is restored from `localStorage`
before that happens — so the trigger fell back to the raw value. Passing
`items` to the `Select` fixes it everywhere, since `BootcampSwitcher` is
shared by all five admin screens.

---

## Where things stand — 2026-08-28 (A4 pagination, mobile, huzaifa merged)

**The onboarding forms' PDF download now matches the source PDFs' page
count exactly** — Background Verification: 1 page, Employment Application:
2 pages, Half Nama: 2 pages, each on real A4 (210x297mm). Verified with
headless Chromium + `pypdf`, not eyeballed: before the fix, every form had
no `@page` rule at all and was defaulting to US Letter with no compaction,
so a 1-page form printed as 3 and a 2-page form as 5. Fixed with an explicit
`@page` rule plus a per-form `zoom` factor tuned against the real measured
output, `break-inside: avoid` on every table row and field cell, and the
source PDFs' own page-break points confirmed by extracting the actual text
from each generated PDF page.

**All three forms are now responsive**, verified with real screenshots at
375px and 768px, not code review alone. The mobile bug was `flex-nowrap`
(added earlier specifically to stop CNIC boxes wrapping on desktop) having
no mobile fallback. The real fix — after two false starts with flex-wrap
variants that each failed in a different way — was replacing two-cell field
rows with a responsive grid and switching section/salary bars to an
unconditional stack-below-`sm:` pattern, since flex's shrink-vs-wrap
ambiguity kept resurfacing at different nesting levels. Full account in
`development-logs.md`.

**`huzaifa` merged into `waqas`**, clean fast-forward, zero conflicts. Brings
the AI Interview Invites feature: bulk-invite service with eligibility
gates, `InterviewerAI` integration, admin dialog, two new tables
(`interview_invite_batches`, `interview_invites`). Verified live and fully
correct after merging — every column, index, and RLS setting checked
directly against the migration file, not assumed from the ledger alone.

---

## Where things stand — 2026-08-28 (onboarding forms)

**The first three onboarding forms exist, admin-preview only.** Background
Verification Form (SWIT-IHR-FAF-11), Employment Application Form
(SWIT-IHR-FAF-03, 2 pages), and the Half Nama oath form (2 pages, pure
Urdu/RTL) are all digital twins of Saylani's paper forms, built pixel-first
against the source PDFs rather than a general redesign. UI-only: no
backend route, no database table, no candidate-facing URL yet — that
waits for the selection phase these forms actually belong to, which this
project hasn't built. Reachable now only at
`/admin/onboarding-preview/{background-verification,employment-application,half-nama}`,
behind the existing admin role gate.

**Shared across all three**, not rebuilt per form: a segmented digit-box
input (CNIC and date fields), a canvas-based signature pad, a localStorage
auto-save hook with a stubbed backend save function, and a form-primitives
file (`features/onboarding/form-primitives.tsx`) holding the bilingual
label, section bar, field-grid cells, Yes/No radio pairs, the bordered
text-input style, an addable-table row-helper set, and — new for the Urdu
form — an inline mid-sentence blank distinct from every boxed field on the
other two. `Download as PDF` is `window.print()` plus a print stylesheet on
every form, not a PDF-rendering library.

Two new small UI primitives (`components/ui/checkbox.tsx`,
`components/ui/radio-group.tsx`) were added on top of `@base-ui/react`,
already a dependency — no new package.

**Verified:** production build and `oxlint` clean across every file, new
and touched, project-wide. **Not verified:** no rendered screenshot exists
from this side — no browser-automation tool is available in this
environment. All three forms were reviewed directly in-browser by the
project owner against the source PDFs; the Background Verification Form's
listed fixes below came from that review.

**Background Verification Form — Round 1 fixes, all applied:** real logo
(previously a placeholder — no logo asset existed in the repo until
supplied), wider page and more internal padding, the bilingual intro note
forced onto one line, CNIC/phone fields given enough width and forced
`flex-nowrap` so digit-boxes stop dropping to a second line under their
label (this recurred in the References section too, on Imam/Other CNIC —
fixed there as well), every checkbox/radio enlarged and recoloured to
black-ink for visibility, and all four phone number fields (Mobile#,
Emergency#, both References Mobile No.) converted from plain text to the
same segmented digit-box style as CNIC.

---

## Where things stand — 2026-08-27 (Gmail token, resolved for now)

**The restart step in the entry below was the last piece.** A new refresh
token authenticating in isolation was not enough — the running backend
process had cached the old, dead one at startup (`@lru_cache` on
`get_settings()`), so it kept failing even after `.env` was updated, until
the process was restarted. After that, a real registration submitted through
the actual UI produced the confirmation email successfully.

**Sender display name fixed in the same pass.** The registration
confirmation email was showing the raw address (`thewaqasali59`) instead of
a name, while the signup email already showed "Saylani IT - A2O" via
Supabase's SMTP sender-name field. `gmail_api.py` now sets the same display
name on every email this integration sends, via `email.utils.formataddr()`
rather than a raw address string. Verified by decoding the actual MIME
message built and by a real send (`200` from `gmail.googleapis.com`) through
a real registration.

**Today's full set of fixes, verified working, dated 2026-08-27:**

| Fix | Verified |
|---|---|
| University status fields (semester, university, class timing) | Live DB write, 3-layer validation |
| CNIC/B-Form split by age for the applicant's own ID | Identity logic + CHECK constraints |
| Registration + signup email content rewritten | 20 content assertions, dashboard template applied |
| `POST /auth/resend-confirmation` | Real resend, masking verified, rate-limit passthrough verified |
| Custom SMTP (Gmail) for Supabase auth emails | Confirmed as the active sender |
| Gmail OAuth refresh token rotated | Real send through real registration endpoint |
| Sender display name ("Saylani IT - A2O") on Gmail-integration mail | Real send, header decoded and confirmed |

**Still open:** whether a token minted after Production publishing survives
past 7 days is not settled by any of the above — only time settles it. See
`development-logs.md` and the **Next** list's item on checking back
**2026-09-03**.

---

## Where things stand — 2026-08-27 (Gmail token)

**The registration confirmation email — the one carrying the candidate
code — stopped sending.** Not the DB write: the success modal and the code
were always correct, because `send_registration_confirmation()` runs as a
`BackgroundTask` after the transaction commits and is designed to never
surface a mail failure to the candidate. Traced by calling that exact
function directly: `gmail_api._get_access_token()` failed with Google's
`invalid_grant: Token has been expired or revoked.`

**Open question, not yet settled: why.** The OAuth consent screen has been in
Production since 2026-08-20 — confirmed in this file and in `security.md`,
both predating this investigation — so "still in Testing" is not the
explanation. The likely mechanism: the *specific* refresh token in use was
minted earlier the same day, while the app was still in Testing, and a
same-day Production re-test only proved it wasn't immediately revoked, not
that its expiry policy had changed. `backend/.env`'s file timestamp (Aug 20,
unchanged since) lines up with that token, and today — Aug 27 — is exactly
7 days later.

A new refresh token was generated 2026-08-27, after Production has been
active for a week, and placed in `.env`. Verified working immediately:
token exchange returned a fresh access token, and a real registration
submitted through the actual `POST /applications` endpoint produced a `200`
from `gmail.googleapis.com/.../messages/send` and `Registration confirmation
sent` in the log. **That only proves the new token works today — it does
not yet prove Production actually stops the 7-day expiry for a token issued
after the flip.** That requires waiting past 7 days without touching the
token. **Check back around 2026-09-03**: if sending is still failing then,
Production publishing is not the fix it was assumed to be and this needs a
different answer (possibly moving off personal-Gmail OAuth entirely, given
the existing plan to migrate to Resend/SendGrid).

---

## Where things stand — 2026-08-27 (auth)

**A signed-up account that never confirmed its email had no way back in.**
GoTrue correctly refuses sign-in until the address is confirmed — that has
always been true, not a regression — but nothing re-sent the confirmation
email if the first one was missed, so the account was stuck for good.
`POST /auth/resend-confirmation` now wraps GoTrue's own resend, and the login
page shows a **Resend confirmation email** button specifically when sign-in
fails with `email_not_verified`. The endpoint answers identically for a known
and an unknown address, so it cannot be used to test which addresses have
accounts.

**The signup email template is applied and verified**, not just written to a
file. The markup now lives at `supabase/templates/confirmation.html` and was
applied by hand in the Supabase dashboard (Authentication → Emails → Confirm
signup); `supabase/scripts/push_email_templates.py` exists as the
config-as-code path for the *next* change, using the Management API rather
than `supabase config push` — the latter would push `config.toml`'s implicit
defaults for anything not set, which include `enable_confirmations = false`.

Verified end-to-end against the live project: a fresh unconfirmed signup, a
real resend that bumped `confirmation_sent_at` after clearing GoTrue's
per-address cooldown, and confirmation that Custom SMTP (Gmail, configured
separately in the dashboard) is what's now sending it rather than Supabase's
low-quota built-in mailer. Both test accounts were deleted afterward. Full
detail in `development-logs.md`.

---

## Where things stand — 2026-08-27 (registration)

**The registration form asks two more things, and one old rule was wrong.**
University status (with semester, university and class timing for students)
is now collected so bootcamp sessions are not timetabled against a
candidate's classes. And the applicant's own identity number is now mandatory
at every age: an adult gives a CNIC, a minor gives the B-Form they hold
instead. Previously it was skippable under 18, which left those records with
no way to identify the person. `candidate_profiles.id_document_type` records
which document the number is, derived server-side from the date of birth.

**Both candidate emails were rewritten.** The registration confirmation
greets by full name, carries a red callout warning that a missed interview
ends the application, and lists the seven documents needed at later stages
with a separate block for under-18 applicants. It is framed as informational:
nothing is collected at that stage.

**The signup email is a Supabase template, not application code.** GoTrue
sends it, so it cannot be changed from this repository. It has since been
applied — see the entry above.

Migration `20260827054856_university_and_id_document.sql` is **applied** via
`supabase db push --linked`, which now works again since the migration ledger
was reconciled.

---

## Where things stand — 2026-08-24 (third merge)

**Login and signup were rebuilt on a split-pane layout** — form on the left,
a rotating alumni quote over an original inline-SVG illustration on the
right, both restyled from theme tokens rather than new hardcoded colours.
Google/Apple buttons show a "coming soon" toast; no OAuth is wired. The
alumni quotes reuse the copy already on the public Success Stories page but
attribute it by programme and cohort instead of by employer, since the
original data pairs invented names with real companies (Careem, Telenor,
etc.) — accurate for the quotes, not for who is saying them.

Caught two bugs building it: `bg-primary` inverts for dark mode, which is
right for a button and wrong for a full-height panel — glared badly next to
the near-black form pane, fixed with a dedicated `--auth-pane` token that
stays deep in both themes. And the auth pages were never actually
route-split despite a comment above them claiming otherwise, adding roughly
27 kB gzip to the landing page's chunk for a page most visitors never open;
`GuestRoute` was missing the `Suspense` boundary it needed. Both pages are
lazy-loaded now.

Merged cleanly with `waqas`'s next batch below — no conflicts.

**The registration flow is complete and in real use.** Three applications
exist in the live database, created through the browser, with candidate
profiles populated: `B07-004`, `B08-002`, `B08-003`. Codes mint sequentially
per intake, confirmation email is queued without blocking the response, and
the account page shows the submitted details, the profile picture, and the
candidate code.

**The registration window is now enforced in the UI as well as the API.** A
closed intake shows a compact notice instead of mounting a form with no track
to select. The header button reads **View application** for anyone who has
already applied, pointing at the tracker rather than back into a form that
would 409.

**One frontend bug class was found and swept.** A guard added for the closed
window watched the wrong loading flag and unmounted the registration form on
its own success refetch, destroying the modal that shows the candidate code.
`useMyApplication` now distinguishes `initialLoading` (first settle) from
`loading` (any fetch); mount-gates use the former. Three other components had
the same defect, including `RequiresApplication`, which would have discarded
an in-progress document upload on any refetch.

**Verified on the merged tree**, which the previous status entry listed as
outstanding: 185 backend tests pass, frontend typecheck, production build and
`oxlint` all clean.

Still outstanding before this is production-ready: the Privacy Policy and
Terms of Service dialogs carry **placeholder text**, clearly marked as such on
screen, and need real legal wording from the project owner.

---

## Where things stand — 2026-08-22 update (second merge)

**`waqas` moved 19 commits past the first merge and was merged in again.**
Registration now actually submits — `POST /applications` writes both halves
(`candidate_profiles` and `applications`) in one transaction, returns the
candidate code, and queues a confirmation email that never blocks the
response on failure. Candidates can upload a profile picture to a second
private Storage bucket (`candidate-pictures`) ahead of or during
registration, read back with a short-lived signed URL. A new `/profile`
router carries the picture endpoints; `/auth/me` now returns the candidate's
full profile instead of a placeholder.

Two conflicts were real design collisions, not just textual overlap:

- **`app/integrations/supabase_storage.py`** — both branches independently
  created a module at this exact path, one for documents, one for pictures.
  Combined into one file; the picture side's `signed_url`/`BUCKET`/
  `MAX_BYTES`/`ALLOWED_TYPES` were renamed to `picture_signed_url`/
  `PICTURE_BUCKET`/`PICTURE_MAX_BYTES`/`PICTURE_ALLOWED_TYPES` since the
  document side already held the unprefixed names and the two intentionally
  behave differently — a failed document sign is a real error (raises); a
  failed picture sign degrades to a missing avatar (returns `None`).
- **`app/schemas/user.py`** and **`frontend/src/lib/types.ts`** — both branches
  added a `CandidateProfileOut`/`CandidateProfile` type. waqas's fuller one
  (with `picture_path`, `father_cnic`, etc.) now sits on the base
  `ProfileOut`/`Profile`, so `/auth/me` returns everything. Huzaifa's narrower
  admin-directory one (just `cnic`/`date_of_birth`/`city`/`education`) was
  renamed to `CandidateProfileSummary` on both sides so the two do not
  collide. On the frontend this also required switching `UserDetail` from
  `extends Profile` to `Omit<Profile, 'candidate_profile'> & {...}` —
  TypeScript does not allow a subtype to narrow an inherited property, which
  the old code was unknowingly relying on being absent.

Verified after resolving: 185/185 backend tests, clean production build, 0
lint errors, server boots against the live database with `/profile/picture`
registered.

**`waqas` is merged into `huzaifa`.** The admin/super-admin build and the
candidate-portal build happened in parallel on separate branches and are now
one tree: the whole portal — marketing site, auth, candidate portal, admin
portal, super-admin portal — runs on real data. `lib/mock-data.ts` is deleted.

**The candidate registration form now persists.** `applications` gained
`is_selected` plus nine registration-detail columns (course history, laptop
ownership, campus, declarations); `candidate_profiles` gained nine more
(father's name/CNIC, gender, phone, address, Saylani roll number). Two stage
values were renamed for clarity: `ASSESSMENT` → `PHYSICAL_INTERVIEW`,
`FORM_PENDING` → `FORM`. Both migrations were already applied directly against
the live database; only the migration ledger was missing the two entries,
which is now corrected — see *Resolved* below.

**Candidate document uploads are built and verified** — a private Supabase
Storage bucket, indexed by a new `documents` table, with admin review.

**Two real auth bugs were found by end-to-end testing** and fixed:

1. **Clock skew caused spurious 401s immediately after login.** GoTrue stamps
   `iat` from Supabase's clock, which runs ahead of ours, so a freshly issued
   token was "not yet valid" for its first seconds. Fixed with 60s of leeway.
2. **A JWKS outage was reported as a bad token** (401 instead of 502) — the
   split `security.md` already described was not actually implemented.

**A Base UI menu crash was taking down every portal page.**
`DropdownMenuLabel` was rendered outside a `DropdownMenuGroup` in three
places, including the account menu in `portal-layout.tsx`. Fixed by wrapping
each in a real group, and a route `errorElement` now contains any future
error of that class.

Still open: the Gmail OAuth Production flip and the Resend/SendGrid migration.

---

## Where things stand — the merge in detail

**Phase 1 is complete and verified against the live Supabase project.** The
database schema is applied, and the full authentication round trip works:
signup provisioning, login, `/auth/me`, token refresh, and logout.

**Phase 2 registration is built and verified end to end**: a super admin can
create an intake, assign an admin, open and close registration against a
deadline, and candidates can apply and receive a candidate code. Candidates
can now also complete the full registration form — course history, laptop
ownership, declarations — and it persists to `applications` and
`candidate_profiles`.

**The admin portal is built and wired to the real API.** All five admin
screens (Dashboard, Candidates, Interviews, Phases, Emails) and all four
super-admin screens (Dashboard, Bootcamps, Administrators, Analytics) run on
live data against your Supabase project, not fixtures. A working
`SUPER_ADMIN` account exists (`admin@sita2o.com`) with a real bootcamp (07) to
exercise the flow.

**Both email systems are live and verified with real sends:** Supabase SMTP
for auth emails, and a Gmail API integration for the backend's own emails
(interview invites, results, onboarding links), wired into the admin Emails
screen with per-recipient delivery logging.

**The candidate portal is fully wired to real data.** Overview, registration
form, application tracker, own-interview view, and documents all call the
live API. The journey stepper shows five visible steps
(Application → Interview → Physical Interview → Form → Onboarded) over the
seven stages actually stored, since `INTERVIEW_SCHEDULED` and `INTERVIEWED`
collapse into one visible node — the distinction only matters to admin
batching. Application-scoped pages (`/dashboard/application`,
`/dashboard/interview`, `/dashboard/documents`) stay locked behind
`RequiresApplication` until a candidate has actually registered.

---

## Known issue from the merge — two enum sources of truth

`frontend/src/lib/types.ts` (admin/super-admin side) and
`frontend/src/lib/stages.ts` (candidate side) each declare their own
`ApplicationStage` and `STAGE_LABEL`, built independently on the two branches
before they diverged. The merge already caused one real drift — `types.ts`
still had the pre-rename `ASSESSMENT`/`FORM_PENDING` values after `stages.ts`
and the backend had moved to `PHYSICAL_INTERVIEW`/`FORM`, which would have
shown blank stage badges on every admin candidate list. Fixed as part of the
merge, but the underlying duplication remains: the two files must be kept in
sync by hand until one imports from the other. Recommend unifying them onto
`lib/stages.ts` next, since it is the one with journey-stepper semantics
(`STEP_INDEX`, `completedSteps`) the candidate portal depends on.

---

## Done

### Backend

| Item | Notes |
|------|-------|
| Layered FastAPI structure | `routes → services → models`, versioned at `/api/v1` |
| Settings with fail-fast validation | Missing env vars stop boot, not first request |
| Supabase token verification | ES256 via JWKS **and** HS256 via shared secret |
| GoTrue integration | signup, login, refresh, logout, with error-code mapping |
| GoTrue admin API | create/update/delete auth users directly — powers staff provisioning |
| Role gates | `require_roles`, `require_admin`, `require_super_admin` |
| Error hierarchy + 3 handlers | Single response envelope everywhere |
| Lazy database engine | App boots and serves `/health` without `DATABASE_URL` |
| Gmail API email integration | Real send verified, message id returned, now logged per recipient |
| Phase 2 registration pipeline | Bootcamps, phases, programs, applications |
| **Admin portal surface** | Users, interviews, email log, audit trail, dashboard stats |
| **Candidate registration** | Full form persisted across `applications` + `candidate_profiles` |
| Deadline enforcement | Service-layer; flag **and** clock, so an expired deadline closes a phase |
| Bootcamp scope enforcement | `assert_can_manage()` — an admin cannot reach another intake's candidates. **Unit-tested**, not just documented |
| Atomic candidate codes | SQL `mint_candidate_code()`; verified race-safe under 24 concurrent mints |
| Audit trail | Every privileged write (`bootcamp.*`, `phase.*`, `application.*`, `profile.*`, `interview.*`, `email.*`) logged with actor, before/after diff, and a summary |
| Editable package install | `pip install -e .` registers `app`, so `uvicorn app.main:app` resolves from any directory |

**59+ endpoints live**, across 9 route modules: `health`, `auth`, `programs`,
`bootcamps`, `applications`, `interviews`, `emails`, `users`, `audit`. Full
list via `/docs` (disabled in production) or `/openapi.json`.

Highlights beyond Phase 2:

```
# users — reads open to any admin, writes super-admin only
GET/POST   /api/v1/users                          # directory / provision staff
GET/PATCH  /api/v1/users/{id}                      # detail / edit profile
POST       /api/v1/users/{id}/role|active|password
DELETE     /api/v1/users/{id}
GET        /api/v1/users/{id}/audit

# interviews — scoped through the application's bootcamp
GET/POST   /api/v1/bootcamps/{id}/interviews[/batch]
PATCH/DELETE /api/v1/interviews/{id}
POST       /api/v1/interviews/{id}/cancel
GET        /api/v1/me/interviews                  # candidate's own schedule

# email — addressed by application id, never a raw address
GET        /api/v1/bootcamps/{id}/emails
POST       /api/v1/bootcamps/{id}/emails/send|broadcast

# oversight
GET        /api/v1/audit                          # platform-wide, super-admin
GET        /api/v1/stats                           # cross-intake totals
GET        /api/v1/bootcamps/{id}/stats|audit      # per-intake

# reference data, now fully editable
POST/PATCH/DELETE /api/v1/programs[/{id}]
GET        /api/v1/programs/manage                 # incl. inactive, with usage counts

# bootcamps — extended
DELETE     /api/v1/bootcamps/{id}                  # refused once anyone applied
GET/POST/DELETE /api/v1/bootcamps/{id}/admins[/{profile_id}]

# applications — extended
PATCH/DELETE /api/v1/applications/{id}
POST       /api/v1/applications/{id}/reinstate      # undo a rejection
GET        /api/v1/applications/{id}/admin          # full record incl. contact info
```

### Bugs found and fixed during the admin-portal build

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | `PATCH` on a phase window assigned both `opens_at` and `deadline_at` unconditionally — editing only the open date silently wiped the deadline, leaving registration open indefinitely | High | `exclude_unset=True`; 6 tests pin omitted-vs-explicit-null semantics. Verified against the live DB: a deadline survives a partial PATCH |
| 2 | Two simultaneous duplicate-application submissions could both pass the pre-check and hit the DB's unique constraint, surfacing as a raw `500` | Medium | Catch the `IntegrityError` by constraint name, translate to `409` |
| 3 | A `REJECTED` application had no path back — permanently locked, and the error returned (`403`) didn't match the equivalent "already at this stage" case (`409`) | Medium | Added `POST /applications/{id}/reinstate`; corrected the status code |

### Database — applied

**All six migrations applied**, recorded in `supabase_migrations.schema_migrations`:

1. `20260819120000_init_auth_profiles.sql` — `profiles`, `candidate_profiles`,
   `user_role` enum, provisioning trigger, RLS.
2. `20260820120000_phase2_registration.sql` — `programs`, `bootcamps`,
   `bootcamp_programs`, `bootcamp_admins`, `bootcamp_phases`, `applications`,
   `stage_transitions`, four enums, `mint_candidate_code()`. RLS enabled
   deny-by-default; 5 programs seeded.
3. `20260820140000_admin_portal.sql` — `interviews`, `email_log`,
   `audit_logs`, three enums (`interview_mode`, `interview_status`,
   `email_status`). RLS deny-by-default; `email_log` and `audit_logs` carry
   no policies at all — staff-only, readable exclusively through the API.
4. `20260820160000_candidate_documents.sql` — `documents` table, two enums
   (`document_type`, `document_status`).
5. `20260820180000_candidate_journey.sql` — renames `ASSESSMENT` →
   `PHYSICAL_INTERVIEW` and `FORM_PENDING` → `FORM` on `application_stage`;
   adds `applications.is_selected`.
6. `20260822055446_registration_details.sql` — nine registration columns on
   `candidate_profiles`, nine on `applications` (course, laptop, campus,
   declarations).

### Frontend

| Item | Notes |
|------|-------|
| Vite 8 + React 19 + TypeScript | `strict` and `noUncheckedIndexedAccess` on |
| Tailwind v4 + shadcn/ui | Full light/dark token ramps, green primary |
| Auth pages | Signup (live password checklist, confirm password, role selector), Login (show/hide password) |
| Auth validation | Single source of truth in `features/auth/password-rules.ts` — drives both zod schema and UI checklist |
| Marketing site | Home, Programs, Program detail, Admissions, About, Success Stories, FAQ, Contact |
| **Admin portal — wired to the real API** | Dashboard, Candidates, Interviews, Phases, Emails |
| **Super-admin portal — wired to the real API** | Dashboard, Bootcamps, Administrators, Analytics, Programs |
| **Candidate portal — wired to the real API** | Overview, Track application, Registration form, Application, Interview, Documents |
| `features/admin/api.ts` | Typed wrapper over the admin/super-admin endpoints |
| `features/admin/bootcamp-context.tsx` | The selected intake, shared across all 5 admin screens, persisted in `localStorage` |
| `features/applications/application-context.tsx` | The candidate's own application state, shared across the candidate portal |
| `hooks/use-async.ts` | Minimal fetch/mutation hook (no react-query dependency added) |
| Batch interview scheduling | Spaces slots evenly from a start time, all-or-nothing, advances stage automatically |
| Email compose | 4 starting templates, `$candidate_name`-style merge fields, broadcast by stage filter |
| Candidate detail sheet | Stage moves, reinstate, interview history, full timeline, contact info |
| Phase controls | Open/close, date windows, warns when a flag is on but the deadline has passed |
| **Registration form** | 4 sections, progressive field unlocking, page-fold transition, 19 IT courses, bootcamp-specific declarations — persists to the API |
| **Journey stepper** | One component, two modes: `demo` plays once per mount, `real` reflects actual stage |
| **User vs Candidate gating** | `ApplicationProvider` holds one answer portal-wide; `RequiresApplication` guards the routes that describe a submitted application |
| Charts | Recharts, lazily loaded per-dashboard, theme-aware |
| Motion primitives | Reveal, Stagger, Counter, Marquee, PageTransition, Typewriter, Countdown |
| Code splitting | Admin/super-admin charts split from the candidate bundle |
| Production build | Clean — see *Verification pending* below |

### Admin account

| | |
|---|---|
| Email | `admin@sita2o.com` |
| Role | `SUPER_ADMIN` |
| Provisioned via | `backend/scripts/create_super_admin.py` — reusable, idempotent, reads credentials from env vars only |

Every further staff account should go through `POST /api/v1/users`
(`create_staff`) instead, so it lands in the audit trail with a named actor.
The bootstrap script exists only because the very first super admin has
nobody to authorise them.

### Verified end to end, not assumed

Beyond the Phase 1 table (still holds): a live `TestClient` smoke run against
the real database confirmed login → `SUPER_ADMIN` role, global reads,
Bootcamp 07 creation with all 5 tracks, the partial-PATCH deadline fix,
registration open/close, per-bootcamp stats/interviews/emails/audit reads,
and every self-demotion/self-deactivation guardrail returning `409`. Every
response shape was diffed field-for-field against the frontend TypeScript
types — zero mismatches across 7 representative endpoints. Also: 31/31 on the
create-intake → deadlines → create-admin → assign → scope flow, and 16/16 on
the document upload/review pipeline.

**Not yet re-run after the merge** — backend test count, frontend build, and
lint need a fresh pass now that both branches' code shares one tree. See
*Verification pending*.

---

## Blocked

Nothing blocks development. The candidate-journey migration that previously
blocked `/applications/mine` was, in fact, already applied directly against
the live database — only its ledger entry was missing, which is now fixed
(see *Resolved* below). No further database action is required.

### Resolved — migration ledger corrected

`20260820180000_candidate_journey.sql` and
`20260822055446_registration_details.sql` had both been run against the live
Supabase project, but neither was recorded in
`supabase_migrations.schema_migrations`. Confirmed by inspecting the live
schema directly: `application_stage` already carries `PHYSICAL_INTERVIEW` and
`FORM`, `applications.is_selected` exists, and both new column sets are
present. Added the two missing ledger rows so the record matches reality —
no schema change was made, only the bookkeeping.

### Resolved — Gmail OAuth consent screen published

The consent screen was moved from Testing to **Production** on 2026-08-20,
which removes the 7-day refresh token expiry that applies to unverified apps.
Publishing does not revoke existing tokens: the token issued during Testing was
re-tested after publishing and sent successfully, so no re-authorisation was
needed.

Google verification is still not required, because the app has a single
authorised user and requests only the `gmail.send` scope.

**Known limitation, not yet a blocker:** personal Gmail caps at 500 emails/day
and is not built for bulk/automated sending — a real risk of throttling once
batch interview invites (125+ emails in one click) run at actual bootcamp
volume. **Must move to Resend or SendGrid before the first real intake goes
live.**

---

## Awaiting decisions

Choices made provisionally, each reversible, flagged for confirmation:

| # | Decision | Taken | Reversal cost |
|---|----------|-------|---------------|
| 1 | Role source | `profiles` lookup per request | Low |
| 2 | RLS | Deny-by-default, select-own (or none, for staff-only tables) | Low — one migration |
| 3 | Provisioning trigger | Auto-create profile, role `CANDIDATE` | Low |
| 4 | Auth traffic | Through FastAPI, not browser-to-GoTrue | Medium |
| 5 | Token storage | `localStorage` | Medium — one file, plus backend cookie work |
| 6 | Primary colour | Green, matching Saylani | Trivial — two CSS variables |
| 7 | `ADMIN` stays bootcamp-scoped | `SUPER_ADMIN` is the only global role; requested by project owner over making `ADMIN` itself global, to keep multi-admin isolation viable | Medium — touches `assert_can_manage` and its tests |
| 8 | ~~Register button after registering~~ | **Decided 2026-08-24** — relabels to *View application*, pointing at the tracker | Done |

Item 8 is settled and built. The button is not hidden when an application
exists: applications are unique per `(bootcamp, profile)`, so a candidate may
legitimately apply to a second concurrent intake, and a vanished button would
block that. It relabels instead, and `/dashboard/register` is guarded
separately because the URL stays typeable.

Unanswered questions carried forward:

- Who provisions the *next* super admin after this one, day to day? (`POST
  /users` now exists and works — this is a process question, not a technical one)
- What is the AI Interviewer — automated scoring, or a real conversation?
- Is the 300 → 50/50/25 batch split fixed or per-bootcamp configurable? (The
  batch scheduler supports arbitrary sizes today; nothing hardcodes 50/50/25)
- Does the system schedule physical assessments, or only record outcomes?
- Exact onboarding form fields beyond IBAN and CNIC?
- ~~Agilytic: API integration or manual export?~~ **Answered 2026-09-05: API
  integration, built and verified live.** All three HMAC-signed endpoints
  (provision, onboarding-status, bulk-invite) work against their API; driven
  from the HR Assessment screen. Open items: their base URL is still a Vercel
  *preview* deployment, and one throwaway probe workspace
  (`95086c38-1974-474c-90fc-506d351dc080`) exists on their side that we cannot
  delete.
- Deployment target?

---

## Next

1. ~~Supply the real Privacy Policy and Terms of Service text~~ — **done
   2026-09-01**, see today's entry above. Still worth a lawyer's pass before
   public launch given CNIC and minors' data are involved, but the dialogs no
   longer show placeholder copy or say they're unreviewed
2. **Unify the two `ApplicationStage` sources** — `lib/types.ts` and
   `lib/stages.ts` — onto one definition; see *Known issue* above
3. **Check back around 2026-09-03** on whether the Gmail refresh token
   generated 2026-08-27 has survived past 7 days — see today's entry above.
   If it has, the open question is settled and this item can go. If it has
   not, Production publishing does not actually prevent the 7-day expiry for
   this app and a different fix is needed
4. Seed real bootcamp admins so per-bootcamp scoping can be exercised through
   the UI, not just the API
5. **Approve the registration field list against Agilytic's requirements**,
   if not already done — the form is live and storing data now, so a field
   change is a migration, not a design tweak
6. Build the Application summary view + Print/PDF for a submitted registration
7. Add CAPTCHA to the registration form (deliberately omitted so far, no stub)
8. Phase 3: interview batching is built (arbitrary slot counts, evenly
   spaced); the AI screening hook is still blocked on deciding what the AI
   Interviewer actually is
9. **Decide how a thumbprint is captured digitally** — the Half Nama form's
   two thumbprint areas are reserved layout space only, deliberately
   non-functional, pending this decision
10. Wire the three onboarding forms to a real backend once the selection
    phase exists: a draft-persistence endpoint (`saveDraft()` is already
    stubbed for this), a submission endpoint, and the eventual
    candidate-facing route — none of which exist yet, by design, since
    admin-preview was the explicit scope so far

## Running it

```bash
# backend
cd backend
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload   # http://localhost:8000
./.venv/Scripts/python.exe -m pytest -q

# frontend
cd frontend
npm run dev                                                    # http://localhost:5173
npm run build

# provision another super admin (bootstrap only — prefer POST /api/v1/users after the first)
cd backend
SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... ./.venv/Scripts/python.exe scripts/create_super_admin.py
```
