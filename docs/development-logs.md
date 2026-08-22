> **Branch:** `waqas` — last updated 2026-08-22

# Development Logs

Chronological record of what was built, when, and why. Newest first.

---

## 2026-08-22 (later) — Fix: Register button never left the frozen state

**Branch:** `waqas`

The registration form shipped reachable at `/dashboard/register`, but the
Register button in the portal header still ran the placeholder from the auth
task — a toast reading "Registration opens soon" and no navigation. The form
was only findable by typing the URL.

The freeze was correct when it was written: there was no form to open. It
simply outlived its reason, and nothing connected the two facts.

```
- <Button size="sm" onClick={() => toast('Registration opens soon', ...)}>
+ <Button render={<Link to="/dashboard/register" />} size="sm">
```

`Link` rather than an `onClick` calling `navigate()`. Both route client-side,
but only the anchor supports middle-click, ctrl-click and "open in new tab",
and only the anchor is announced as a link. The `render` prop is how this
codebase composes Base UI buttons with router links — the "Website" button two
lines below already does exactly this.

The `toast` import became dead and was removed with it.

### Left alone, pending a decision

The button behaves identically for somebody who has already registered. That
case has not been agreed yet, so it was not changed — the recommendation is
recorded in `project-status.md` under *Awaiting decisions*.

Worth noting the backend already refuses a duplicate: `application_service.
submit()` raises `ConflictError` with the existing candidate code, and the
`unique (bootcamp_id, profile_id)` constraint backs it. The gap is only that
the UI still invites the attempt.

### Verified

- Typecheck, production build and `oxlint` clean
- Route path confirmed from the router config rather than assumed
- **Not** click-tested in a browser — no frontend test runner is configured.
  The pattern is the one already shipping on the adjacent "Website" button.

---

## 2026-08-22 — Multi-step bootcamp registration form

**Branch:** `waqas`

The form behind the Register button: four sections, one on screen at a time,
each field unlocking only after the one above it validates. UI and local state
only — **no database work**, by instruction. The field list was approved before
any code was written.

### Not the general enrolment form

Adapted from Saylani's public enrolment form rather than copied. The
differences are the point:

| Change | Why |
|---|---|
| Class Preference removed | Bootcamp intake has no class options |
| Course Status added | Replaces it; only meaningful once a course is named, so it is not rendered before then |
| Saylani Roll Number added | Bootcamp applicants are existing students |
| Country locked to Pakistan | One country runs bootcamps |
| Campus locked to Zaitoon Ashraf IT Park | One campus runs bootcamps |
| Course list filtered to 19 IT tracks | Six non-IT vocational courses on the public list are not preparation for an IT bootcamp |
| Laptop callout added | A personal machine is mandatory; worth saying out loud, not burying in a Yes/No |
| CAPTCHA omitted | Deferred to a later task. No stub either — a fake "not a robot" box implies protection that does not exist |

**Only the applicant's CNIC is optional.** An applicant under 18 may not hold
one yet; a guardian always does, so `father_cnic` is required. An earlier draft
had both optional and was corrected.

### Declarations written for this platform

The reference form's declarations were not reused. A bootcamp applicant is
entering a competitive, deadline-gated process with an interview, a physical
interview and a capacity limit — none of which apply to open enrolment, and all
of which they should be told about before agreeing to anything. Five
declarations now cover accuracy, conduct, attendance and commitment, project
completion, and the dress code, plus a separate policy consent.

Each is its own checkbox. Bundling them into one "I agree to everything" makes
consent unfalsifiable and leaves no record of which term was actually shown.

### Progressive unlocking is derived, never stored

`unlockedCount()` walks a section's field order and returns the index of the
first field that does not parse against its own schema. Field `i` is enabled
when `i <= unlockedCount`. Clearing a field re-locks everything after it for
free, with no state to keep in step and no way for the gate to disagree with
validation.

This is why the schemas are split per section rather than kept as one flat
object: the gate needs each field's schema reachable through `.shape`.

### A separate stepper, on purpose

`JourneyStepper` was not reused. It is typed to recruitment concepts —
`ApplicationStage`, stage-to-step mapping, timestamps, a halted flag — none of
which mean anything to a form, and its demo mode advances on a timer, which is
exactly wrong for something that must move only when the user says so. Sharing
it would have meant a third mode and a generic step type, making a component
that does one job well do two badly.

The *design language* is shared: node sizing, checkmark on completion, rotating
ring on the active node, connectors filled by transform. A third consumer would
be the moment to extract a primitive; two is not.

Completed steps are clickable to go back. Forward jumps are not, because that
would skip the validation each Next enforces.

### Page fold

CSS 3D transforms driven by Motion, no new dependency. The outgoing section
pivots on its Y axis about the leading edge while a gradient darkens across it
— the light-catch is what makes it read as paper rather than a rotating
rectangle. The incoming section settles in from a shallower angle.

Only `transform` and `opacity` animate, so it stays on the compositor.
`AnimatePresence mode="wait"` sequences the two: overlapping them needs
absolute positioning and a measured container height, which fights sections of
different lengths. Reduced motion gets a plain crossfade.

### Two bugs found while building

**Base UI Select treats `''` as a selected value**, not as empty, which
suppresses the placeholder. The controller now passes `null` for empty while
form state keeps `''`, so the zod enums still report "required" rather than
"expected string, received null".

**Object URLs leak.** The picture preview revokes the previous URL on every
re-pick and on unmount; without that, each change would strand an image for the
life of the page.

### No new libraries

`react-hook-form`, `@hookform/resolvers`, `zod` and `motion` were all already
installed. The project has no checkbox primitive, so the declaration checkboxes
are buttons with `role="checkbox"` and `aria-checked` — real buttons, so
keyboard operation comes free and the whole row is the hit target.

### Not wired to the Register button

The button in the portal header stays frozen, as previously instructed, and
submitting persists nothing. The form is reachable at `/dashboard/register` for
review. Activating the button is a one-line change once the database layer
exists.

### Verified

- Typecheck (`tsc -b --force`), production build, and `oxlint` all clean
- Register page code-splits to its own 54 kB chunk, so the rest of the portal
  does not pay for it
- Base UI Select and SelectValue props confirmed against their type
  definitions rather than assumed
- **Not** click-tested in a browser — no frontend test runner is configured,
  and adding one would be a new dependency

---

## 2026-08-20 (night, later still) — Correction: signing up is not registering

**Branch:** `waqas`

The dashboard had been built as though every signed-in user was a candidate.
They are not, and the distinction is the whole shape of the product:

- **Sign up / log in** creates a **User**. That is all it does. The person now
  has an account.
- **Register** — a separate, deliberate action — creates an **Application**.
  Only now is the person a candidate.

Everything downstream (candidate code, interview, physical interview, form,
onboarding, the tracker) belongs to the Application, not the User. None of it
should be reachable, populated, or implied before that second action.

### Two things named alike, doing different jobs

Worth writing down because the names invite confusion:

| | What it is |
|---|---|
| **"Register"** button, portal header | The entry point to the actual application *form*. Frozen for now — fires a toast, navigates nowhere. Untouched by this change. |
| **"Application"** sidebar item | Not a form. A read-only *summary* of what was submitted, plus Print/PDF. Nothing to summarise until registration happens, so it stays locked. |

### What was already right

Checked before changing anything, rather than assumed:

- **Candidate codes were never minted at signup.** `mint_candidate_code()` is
  called in exactly one place — `application_service.submit()`, behind
  `POST /applications`. `auth_service.py` contains no reference to it. Signup
  cannot produce a code.
- **The data model already separates User from Application.** `profiles` is
  created by the provisioning trigger; `applications` only ever by an explicit
  submission.

So the backend needed no change and no migration. The fault was entirely in
what the frontend implied.

### Sidebar: locked, not hidden

`PortalNavItem` gains `requires?: 'application'`. Overview and Track
application stay open; Application, Interview, and Documents carry the flag.

A locked row is **not a disabled link** — it is not a link at all. Rendering an
`<a>` that goes nowhere leaves it focusable, tabbable, and openable in a new
tab, promising something it cannot deliver. Locked rows render as a plain
element with `aria-disabled`, a padlock, and a tooltip reading *"Available
after you register"*, plus the same text in `sr-only` for screen readers.

**Locked while loading, deliberately.** Unlocked-then-locked flashes doors open
that the user cannot walk through, which reads as a bug; locked-then-unlocked
just reads as settling. `hasRegistered` is therefore `false` until the fetch
resolves, never optimistic.

Hidden was rejected: a candidate who cannot see Interview at all learns nothing
about what is coming. Locked-with-a-reason teaches the process.

### One fetch, not three

Sidebar, overview, and tracker all need the same answer. `useMyApplication()`
fetches on mount, so three consumers meant three identical requests that could
disagree mid-flight. Lifted into `ApplicationProvider`, mounted in
`PortalLayout`.

It also gained an `enabled` flag: `/applications/mine` is candidate-only, and
admins share this layout, so without gating every admin page load fired a
request guaranteed to 403.

### The URL is still typeable

Locking a sidebar row does not lock a route. `RequiresApplication` guards the
three gated paths and renders an explanation rather than redirecting —
bouncing somebody who followed an emailed link to `/dashboard` with no word why
is worse than telling them what the page is and what unlocks it.

### The profile menu crash

```
Base UI: MenuGroupContext is missing.
Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.
```

`DropdownMenuLabel` is Base UI's `Menu.GroupLabel`, and it was used directly
inside `DropdownMenuContent` with no group ancestor to supply the context.

Wrapping it in a `DropdownMenuGroup` would have silenced it in one line. Not
done: that block labels no group of items — it is an account header — so an
empty labelled group would be a lie told to screen readers purely to satisfy a
context check. It is now the plain presentational div it always was.
`DropdownMenuLabel` stays exported for genuine group labels.

Checked the sibling case too: `SelectLabel` / `SelectGroup` have the identical
constraint but are not used anywhere in app code, so there is no second live
instance of this bug.

### ErrorBoundary

New `components/shared/error-boundary.tsx`, a class component because
`getDerivedStateFromError` and `componentDidCatch` have no hook equivalents.
Wrapped around the portal outlet and, separately, the account menu — the one
header control with enough moving parts to fail. The header gets a compact
inline fallback, since dropping a card into a 4rem bar would be worse than the
error.

Reset happens by `key={location.pathname}`, so the boundary remounts on
navigation and discards the error with the instance. The first attempt used
`componentDidUpdate` + a `resetKey` prop; that costs a second render on every
prop change and lint flagged it fairly.

It does not catch event-handler, `setTimeout`, or promise-rejection errors —
none of those pass through render. Async failures stay with `toErrorMessage()`.

### Track application, before registering

Was a bare *"No application to track yet"* dead end. Now renders the same
stepper in demo mode, so the page explains the process instead of looking
broken, with a secondary card saying plainly that registering is what starts it.

### Result

A newly signed-up user sees Overview and Track application working, and
Application, Interview, and Documents locked with a stated reason. No candidate
code anywhere. The Register button is untouched and still inert.

The Application *summary* view and its Print/PDF export are deliberately not
built — the registration form does not exist yet, so its fields are unknown.
Locked state only, by decision; the summary follows once the form does.

### Verified

- Frontend typecheck (`tsc -b --force`), production build, and `oxlint` all clean
- Grep confirms no `Menu.GroupLabel` usage remains outside the primitive, and
  `useMyApplication` now has exactly one caller — the provider
- 38/38 backend tests still pass; no backend change was needed

---

## 2026-08-20 (night, later) — Correction: the journey is five steps, not seven

**Branch:** `waqas`

The seven-stage journey built earlier the same evening was over-specified. The
corrected flow is five visible steps:

```
Application ──> Interview ──> Physical Interview ──> Form ──> Onboarded
```

Two changes, and they are different in kind.

### "Interview Scheduled" and "Interview Completed" become one node

Visually. Not in the database.

Collapsing them in storage as well would have been the obvious reading of the
request, and it would have broken batching. The whole interview workflow — 300
candidates split 50/50/25 across three slots — is a question about *who holds a
slot but has not yet been seen*. One value cannot answer it.

So `INTERVIEW_SCHEDULED` and `INTERVIEWED` both remain, and both map to the
single "Interview" node. `JOURNEY_STEPS` in `lib/stages.ts` now carries a
`stages: readonly ApplicationStage[]` per step, and `STEP_INDEX` is built by
flattening it, so a node can cover any number of stored stages without any page
knowing. Callers still pass an `ApplicationStage`; the mapping happens inside
the stepper.

The guidance panel stays keyed by stored stage, deliberately — "join at your
slot" and "wait for the result" are opposite instructions and cannot share one
message, even though they share one node.

### "Selected" stops being a stage

It was never really one. Clearing the interview is the *condition* for reaching
the physical interview, so the transition into `PHYSICAL_INTERVIEW` already
encodes it.

What the transition cannot encode is which gate stopped somebody, because
`REJECTED` is reachable from several places. `applications.is_selected` records
that, tri-state:

| Value | Meaning |
|---|---|
| `NULL` | Interview not decided yet |
| `true` | Through to the physical interview |
| `false` | Not selected at interview |

A two-state boolean would have made every un-interviewed candidate read as
rejected. The flag is *derived from the transition* in `advance_stage()` rather
than accepted from the caller, so it cannot disagree with the stage it
describes. Rejection from a later gate deliberately leaves `is_selected = true`
standing — they *were* selected; something else stopped them.

### The migration got smaller, not bigger

The earlier seven-stage migration had never been applied, so it was deleted
rather than corrected on top. Replacing it against the *live* schema turned out
to need only two renames:

```sql
alter type public.application_stage rename value 'ASSESSMENT'   to 'PHYSICAL_INTERVIEW';
alter type public.application_stage rename value 'FORM_PENDING' to 'FORM';
alter table public.applications add column if not exists is_selected boolean;
```

`RENAME VALUE` keeps enum positions, so sort order, the default, and the
`(bootcamp_id, stage)` index all survive untouched — none of the type-recreation
dance the seven-stage version needed.

Zero application rows exist, so no data was affected and no sign-off was
required under the standing rule.

### One trap worth recording

Adding `is_selected` to the SQLAlchemy model made it a *blocking* migration,
where the previous one was not. The earlier version changed only enum labels, so
reads kept working against the old schema. This one adds a column, and
SQLAlchemy puts it in every `SELECT` — so `/applications/mine` fails with
`UndefinedColumn` until the migration runs, and the candidate dashboard shows
its error state instead of its empty state.

Verified by querying directly rather than assuming:

```
FAIL: ProgrammingError column applications.is_selected does not exist
```

**The migration is still not applied** — three attempts were refused by the
environment's permission classifier. See *Blocked* in `project-status.md`.

### Changed

| File | Change |
|---|---|
| `supabase/migrations/20260820180000_candidate_journey.sql` | Replaces the deleted seven-stage migration |
| `backend/app/models/enums.py` | `SELECTED` dropped, `FORM_SUBMITTED` → `FORM` |
| `backend/app/models/application.py` | `is_selected` column |
| `backend/app/schemas/application.py` | `is_selected` on `ApplicationOut` |
| `backend/app/services/application_service.py` | Derives `is_selected` in `advance_stage()` |
| `frontend/src/lib/stages.ts` | `JOURNEY_STEPS` with many-to-one stage mapping; `STEP_INDEX`, `TOTAL_STEPS`, `completedSteps` |
| `frontend/src/components/shared/journey-stepper.tsx` | Keys on `step.key`; `earliestStamp()` for multi-stage nodes |
| `frontend/src/features/applications/stage-guidance.ts` | `SELECTED` removed; steps re-cast as places you stand, not events completed |
| `docs/phases.md`, `docs/architecture.md` | Five steps vs seven stages, and why they differ |

Demo mode, real mode, the ring, the connectors, success stories, the typewriter,
and the empty-state hero are all unchanged — only the step list they operate on.

### Verified

- 38/38 backend tests pass
- Frontend typecheck, `oxlint`, and production build all clean
- Repo-wide grep for `SELECTED`, `FORM_SUBMITTED`, `FORM_PENDING`, `ASSESSMENT`,
  `TOTAL_STAGES`, `STAGE_INDEX`, `completedCount` returns only the historical
  Phase 2 migration and the new migration's own rename statements

---

## 2026-08-20 (night) — Candidate dashboard: two states, one stepper

> **Superseded in part.** The seven-stage journey described below was corrected
> to five visible steps the same evening — see the entry above. The stepper,
> empty state, typewriter, countdown, and success stories all survive unchanged;
> only the step list differs.

**Branch:** `waqas`

### The schema was one stage short

The brief called for a seven-stage journey. The enum shipped in the Phase 2
migration had six, and it named two of them for something other than what they
meant:

| Journey stage | Was | Now |
|---|---|---|
| Selected | *(absent)* | `SELECTED` |
| Physical Interview | `ASSESSMENT` | `PHYSICAL_INTERVIEW` |
| Form Submitted | `FORM_PENDING` | `FORM_SUBMITTED` |

The missing value was the real problem. An admin marking a candidate as passed
and that candidate attending an in-person round are separate events days apart,
and collapsing them left the tracker unable to say which had happened.

The two renames came along because `FORM_PENDING` broke the rule every other
value follows — stages record what *happened*, not what is owed — and because
the HR round is a conversation, not a test.

`20260820180000_seven_stage_journey.sql` recreates the type rather than using
`ALTER TYPE ... ADD VALUE`, so `SELECTED` lands in pipeline position rather than
at the end. Enum sort order is declaration order and `order by stage` depends on
it. Confirmed with the user before writing; zero application rows existed, so
the rewrite carried no data risk.

**The migration is written but not applied** — see *Not done* below.

### One stepper, two modes

`components/shared/journey-stepper.tsx` is a single component. The brief asked
for one and the geometry justifies it: node sizing, the connector trick, and
the responsive axis flip are identical in both modes, and only each node's
*state* differs — a single `stepState()` call.

- **`demo`** plays the seven stages through once on mount, then settles with
  every node complete and nothing still animating. The `setInterval` lives in an
  effect whose dependencies are all stable for the life of the mount, so a
  re-render cannot restart it; a reload can, which is the requested behaviour.
- **`real`** never sequences. Progress comes from `STAGE_INDEX[currentStage]`,
  and the current node keeps a persistent rotating ring.

Three implementation notes worth keeping:

**The ring is not a masked border.** A conic-gradient disc sits *behind* an
opaque node and protrudes 3px. Rotating the whole element is a compositor-only
transform; animating a conic gradient's angle would repaint every frame.

**Connectors need no measurement.** Each is anchored at 50% of its own cell and
stretched one full cell backwards, which lands exactly on the previous node's
centre because the cells are `flex-1`. No refs, no resize observer.

**Both scale axes are pinned at both breakpoints.** The layout flips from
vertical to horizontal at `lg`, so a connector left with only `scale-y-0` would
collapse in the other orientation.

Horizontal starts at `lg`, not `md`: with a sidebar, `md` leaves roughly 100px
per node for seven of them, which is cramped. Below `lg` it stacks vertically
instead of scrolling sideways.

### Deadlines the candidate could not read

`PhaseOut` was admin-only, so a candidate had no way to know when their own
interview or form window closed — and the tracker was asked for countdowns.
`ApplicationDetail` now carries `phases`. It costs no extra query (the bootcamp
was already eager-loaded) and no extra request, and exposes only windows and an
open flag — nothing about other applicants.

### Testimonials: grid, not carousel

Each quote types itself out when it scrolls into view. A carousel breaks that:
an off-screen slide never intersects, so its typewriter either never fires or
fires unseen. A grid gives every bubble its own trigger. Reused the existing
`TESTIMONIALS` fixture rather than adding a second set, so real content swaps in
one place. Speakers are gradient initials-avatars, matching the marketing site.

### No new dependencies

Framer Motion is already present as `motion` v13 — the same library under its
current name. The typewriter, the countdown, and the bubble tail are all a few
lines each and were written rather than installed.

### Verified

- 38/38 backend tests pass
- Frontend typecheck, `oxlint`, and production build all clean; every
  `set-state-in-effect` warning in the new code was designed out rather than
  suppressed, by deriving state during render instead of assigning it
- Live server against the real database: `/api/v1/health` returns
  `database: ok`, OpenAPI reports the eight-value enum and `ApplicationDetail`
  carrying `phases`, and `/applications/mine` returns 401 unauthenticated

### Not done

**The migration has not been applied.** Both attempts to run it were refused by
the environment's permission classifier. The backend enum, the frontend types,
and the SQL file now agree on eight values; the live database still has the old
seven. Writing any application row will fail until it is applied.

Nothing committed or pushed — awaiting explicit permission.

---

## 2026-08-20 (late) — Fix: backend would not start outside one directory

**Branch:** `waqas`

Reported as two symptoms: `ModuleNotFoundError: No module named 'app'` when
running `python main.py`, and the frontend showing "Cannot reach the server"
during signup. The second was a consequence of the first — the API was never
running.

### Bug 1 — import path

`app/main.py` uses absolute imports, which require `backend/` on Python's
import path. Running `python main.py` from inside `app/` puts `backend/app/`
there instead, so `import app` finds nothing. `main.py` also had no
`__main__` guard, so it was never a working entry point at all.

Fixed structurally rather than by documenting a workaround. `pyproject.toml`
now declares the package, and `pip install -e .` registers it so `app`
resolves from any working directory. Dependencies stay in `requirements.txt`
via `dynamic = ["dependencies"]`, so the two cannot drift.

`pytest.ini` was folded into `pyproject.toml` at the same time — one less
config file.

### Bug 2 — configuration path, found while investigating

Not reported, but the same class of fault and it would have surfaced next:

```python
env_file=".env"          # resolved against the *current working directory*
```

Starting the server from anywhere but `backend/` silently loaded no settings
and failed with four `Field required` errors — an error describing a symptom
rather than the cause. Confirmed by reproducing it from the repository root.

`ENV_FILE` is now absolute, derived from `config.py`'s own location.

### Also addressed

- **`__main__` guard added**, with host and port read from the environment.
  Hardcoding 8000 meant a second instance could not start without editing
  code — which showed up immediately during testing as `WinError 10013`.
- **CORS widened to include `http://127.0.0.1:5173`.** Browsers treat that as
  a different origin from `localhost:5173`, so serving the frontend on the IP
  form would have been rejected. Applied to `.env` and `.env.example`.

### Verified

All four run commands, each from a clean slate on a free port:

| Command | From | Result |
|---------|------|--------|
| `uvicorn app.main:app --reload` | `backend/` | starts |
| `python -m app.main` | `backend/` | starts |
| `python app/main.py` | `backend/` | starts |
| `python main.py` | `backend/app/` | starts — the originally failing case |

Settings now load from `backend/`, `backend/app/`, `backend/tests/`, and the
repository root.

Live server checks: `/api/v1/health` returns `"database":"ok"`, `/docs`
returns 200, a CORS preflight from `http://localhost:5173` returns the correct
`access-control-allow-origin`, and a real `POST /api/v1/auth/signup` with a
browser `Origin` header returned 201 with the confirmation email sent and the
profile provisioned as `CANDIDATE`. Test user deleted; 38 tests pass.

### Documentation

`README.md` gained a "How to run the backend" section with the exact
directory, command, URLs, and a health-check verification step.
`error-handling.md` gained a startup-failure section mapping each misleading
symptom to its actual cause.

---

## 2026-08-20 (evening) — Phase 2: registration pipeline

**Branch:** `waqas`

Schema approved before writing the migration, per the standing validation rule.
Three decisions were settled first: programs become a seeded database table,
seat limits are deferred, and a candidate may hold one application per intake
across several concurrent intakes.

### Schema — migration `20260820120000_phase2_registration.sql`

Seven new tables: `programs`, `bootcamps`, `bootcamp_programs`,
`bootcamp_admins`, `bootcamp_phases`, `applications`, `stage_transitions`.
Four new enums, all mirroring the frontend's `ApplicationStage` exactly so no
translation layer is needed at the API boundary.

Applied via `supabase db push` — the first migration to use the CLI rather than
the manual pooler route, since the CLI now works.

**Candidate codes are minted by a SQL function, not Python.**
`mint_candidate_code()` increments `bootcamps.next_candidate_seq` inside an
`UPDATE ... RETURNING`, so the row lock guarantees uniqueness. The obvious
`count(*) + 1` approach races: two applicants submitting at the same instant
would both receive `B07-001`.

Verified with 24 concurrent mints across 12 threads, each on its own
connection: 24 unique codes, contiguous `B07-001` … `B07-024`, zero duplicates.
Two-digit intakes format correctly (`B12-001`).

**`bootcamp_programs` kept without a `seats` column.** Capacity was deferred,
but which tracks an intake offered still needs recording — adding `seats` later
is additive, whereas reconstructing that history would be impossible.

**`stage_transitions` written from day one**, including the opening `APPLIED`
entry, so a candidate's timeline starts at submission rather than at the first
admin action.

### Backend

21 endpoints total, 15 new. Models, Pydantic schemas, two services
(`bootcamp_service`, `application_service`), and three route modules.

**Deadline enforcement lives in the service layer**, not the routes, so every
future caller passes the same gate. `is_phase_open()` requires the flag *and*
the clock: an expired deadline closes a phase even if nobody clicked anything.

**Scope enforcement is real, not cosmetic.** `assert_can_manage()` checks
`bootcamp_admins` membership — an admin holding a valid token cannot reach
another intake's candidates by changing the id in the URL.

Reading someone else's application returns **404, not 403** — confirming the row
exists would leak that the id is real.

### Refactor along the way

Routes initially used `db: DbSession = None  # type: ignore` to work around
FastAPI's parameter ordering (a `Depends(...)` default forces every later
parameter to carry one too). Replaced with `AdminUser` / `SuperAdminUser` /
`CandidateUser` annotated aliases in `deps.py`, so callers declare the user as
an ordinary parameter and the placeholder defaults disappear.

### Verified end to end against the live database

Four real users (super admin, admin, two candidates), a real intake, then
deleted. Every assertion passed:

| # | Check | Result |
|---|-------|--------|
| 1 | Programs public endpoint | 5 active |
| 2 | Create bootcamp as SUPER_ADMIN | 201, 4 phases + 2 programs auto-created |
| 3 | Create bootcamp as ADMIN | 403 — super-admin only |
| 4 | Apply while registration closed | 403 `phase_closed` |
| 5 | Open registration | 200 |
| 6 | Public open-intake list | Shows the bootcamp |
| 7 | Candidate 1 applies | 201, code `B07-001`, timeline seeded |
| 8 | Candidate 2 applies | 201, code `B07-002` |
| 9 | Duplicate application | 409 |
| 10 | Program not offered by intake | 409 |
| 11 | Admin lists applicants, unassigned | 403 — scope enforced |
| 12 | Same admin after assignment | 200, both codes returned |
| 13 | Advance stage | 200, timeline grew to 2 |
| 14 | Candidate advances own stage | 403 |
| 15 | Candidate reads another's application | 404, not 403 |
| 16 | Public list after closing registration | 0 intakes |
| 17 | Cleanup | 0 applications, 0 profiles |

38 tests pass, up from 19 — added deadline-boundary tests (including the
exactly-on-the-deadline case) and route-contract tests.

### Not yet wired

The frontend still renders from `lib/mock-data.ts`. These endpoints exist and
work but nothing calls them yet.

---

## 2026-08-20 (later) — Auth UX hardening: signup, login, role foundation

**Branch:** `waqas`

Task brief asked for a full authentication system with bcrypt hashing and
FastAPI-issued JWTs. **Stopped and raised the conflict before building**, since
Phase 1 auth already runs on Supabase Auth — a decision made deliberately after
initially choosing FastAPI-native JWT.

**Outcome:** keep Supabase Auth, build every UX requirement on top. The spec's
actual security intent (never store plaintext) was already satisfied — Supabase
hashes with bcrypt server-side, which is why bcrypt is not a dependency here.
Roles stay `CANDIDATE` / `ADMIN` / `SUPER_ADMIN` rather than renaming to
`STUDENT`; the UI can display "Student" as a label without a database migration
that would touch the enum, provisioning trigger, and RLS policies.

Zero backend rework was needed. All work was frontend.

### Built

**Validation core — one source of truth**

`features/auth/password-rules.ts` defines the five password rules as a single
array. Both the zod schema (which gates submission) and the live checklist
component (which shows what is missing) are built from it, so validation and UI
cannot drift apart and disagree.

`features/auth/schemas.ts` — each name rule is a separate refinement so the user
gets a specific message rather than one catch-all:

| Input | Result |
|-------|--------|
| `Ayesha Siddiqui` | accepted |
| `Anne-Marie O'Brien` | accepted |
| `Md. Rahman Khan` | accepted |
| `Ayesha` | "Please enter both your first and last name" |
| `Ayesha123` | "Name cannot contain numbers" |
| `Ayesha @#$` | "Name cannot contain special characters" |

Name matching is unicode-aware (`\p{L}`) so non-Latin names are not rejected,
and permits the punctuation that legitimately appears in names.

**Reusable components**

- `PasswordStrength` — live checklist plus animated strength meter
- `PasswordInput` — show/hide toggle, `forwardRef` so react-hook-form's ref
  attaches (without it the field never validates). Toggle is `tabIndex={-1}` so
  keyboard users tabbing through the form reach the next field, not the toggle.
- `RoleSelector` — Student selectable, Admin visible but disabled with a
  "Coming soon" lock badge

**Pages**

- Signup: role selector, full name, email, optional phone, password with live
  checklist, confirm password. `mode: 'onChange'` so the checklist and the
  disabled submit button track input in real time. No auto-login on success —
  redirects to `/login` carrying the email so the success notice can render.
- Login: show/hide password, post-signup confirmation banner, honours the
  `from` location so a protected-route bounce returns the user where they were
  headed.
- Dashboard: `Register` button in the portal topbar, candidate-only, shows a
  "Registration opens soon" toast. Inert by design until Phase 2.

### Security note

The role selector sends **nothing** to the API. Self-service signup always
produces `CANDIDATE` server-side; accepting a role from the request body would
be a privilege-escalation hole. `SignupRequest` has no role field and the
provisioning trigger hardcodes the value — both already documented in
`security.md` and left untouched.

### Problem found and fixed

shadcn's generated `sonner.tsx` imports `useTheme` from **next-themes**, which
this project does not use — its `useTheme` would have returned undefined and
toasts would have ignored the active theme entirely. Repointed at this project's
own `ThemeProvider` and removed `next-themes` from dependencies.

### Verified, not assumed

Full round trip against the live backend, using a pre-confirmed user created via
the Admin API and deleted afterward:

| Step | Result |
|------|--------|
| Provisioning trigger | Profile created, `full_name` carried, role `CANDIDATE` |
| Login | 200, tokens plus profile |
| `GET /auth/me` | 200, correct email and role |
| Wrong password | 401 `invalid_credentials` |
| Cleanup | Profile removed by cascade, 0 rows remaining |

Password rules and name validation exercised directly against the schema (table
above). Typecheck clean, production build clean, 19/19 backend tests pass.

---

## 2026-08-20 — Gmail API integration for backend-triggered email

**Branch:** `waqas`

Built the second, separate email system: while Supabase's SMTP config (set up
the previous day) only covers Supabase Auth's own emails, the recruitment
workflow itself — interview invitations, batch results, onboarding links —
needs the backend to send arbitrary custom email. That requires the Gmail API,
not SMTP.

### Setup process, and what went wrong along the way

Walked through Google Cloud Console: create project → enable Gmail API →
configure OAuth consent screen (External, Testing, one test user) → create
OAuth client → obtain a refresh token via the OAuth Playground.

Two real errors hit during setup, both fixed without redoing prior steps:

1. **`redirect_uri_mismatch`** — the first OAuth client was created as
   "Desktop app," which uses a fixed internal redirect that does not match the
   OAuth Playground's callback URL. Fixed by creating a second client as "Web
   application" with the Playground's URL added as an authorized redirect —
   used only for the one-time authorization, not by the backend.
2. **`access_denied` — verification required** — the authorizing account was
   not yet saved to the consent screen's Test users list. Fixed by confirming
   it was added and saved on the correct project.

**Correction to earlier guidance:** initially advised that the backend should
use the *Desktop app* client's credentials for consistency with the one that
completes authorization. This turned out to be unnecessary — the client type
only affects the initial redirect handshake; once a refresh token exists, any
matching `client_id` + `client_secret` + `refresh_token` triple works
regardless of which type issued it. The Web application client's credentials,
already in hand, were used as-is. No rework needed.

### Built

- `app/integrations/gmail_api.py` — token refresh (cached in memory, ~1 hour
  TTL) and `users.messages.send`, both plain `httpx` calls rather than adding
  `google-api-python-client` as a dependency — consistent with how
  `supabase_auth.py` already talks to GoTrue, and avoids that library's heavy
  transitive dependency tree for two HTTP calls
- `app/services/email_service.py` — single choke point Phase 2's routes will
  call; templating and `email_logs` persistence land later, deliberately not
  built ahead of the schema that will drive them
- `EmailNotConfiguredError` (503) — mirrors the existing
  `DatabaseNotConfiguredError` pattern; Gmail settings are optional so the app
  still boots cleanly without them

### Verified, not assumed

Sent a real email through the full path — `email_service.send_email()` →
`gmail_api.send_email()` → live Gmail API call — and got back a real Gmail
message id (`1a01dd3d05ffda30`). Confirmed in the inbox. 19/19 backend tests
still pass.

### Known risk, not yet resolved

The OAuth consent screen is unverified (Testing status), which means Google
expires the refresh token after **7 days** unless the screen is flipped to
Production — a single toggle, not a new setup, since the app has only one
authorized test user and no verification is actually required for that.
**Not yet confirmed done.** See `security.md` for the exact fix.

---

## 2026-08-19 (evening) — Full UI build: marketing site and three portals

**Branch:** `waqas`

Brief: a full-scale professional landing page with its supporting pages and
dropdown navigation, the complete UI for all three portals and their dashboards,
and no compromise on animation.

### Delivered

**25 pages, 33 components, ~10,400 lines.**

| Area | Pages |
|------|-------|
| Marketing | Home, Programs, Program detail, Admissions, About, Success Stories, FAQ, Contact |
| Auth | Login, Signup |
| Candidate portal | Overview, Application, Interview, Documents, Profile |
| Admin portal | Dashboard, Candidates, Interviews, Phases, Emails |
| Super-admin portal | Dashboard, Bootcamps, Administrators, Analytics |

### Foundation built first

- **Design tokens** — full light/dark ramps, brand scale, chart palette, plus
  keyframes for marquee, aurora, shimmer, and float
- **Motion primitives** — `Reveal`, `Stagger`, `Counter`, `Marquee`,
  `PageTransition`; every one honours `prefers-reduced-motion`
- **Theme system** — light/dark/system with an inline pre-paint script in
  `index.html`, so a dark-mode visitor never sees a white flash
- **Portal shell** — collapsible animated sidebar with a `layoutId` active
  indicator, role-driven navigation, mobile drawer

### Animation

Scroll-reveals with directional offsets, staggered lists, count-up statistics,
seamless dual-direction marquees, an animated mega-menu, spring-driven mobile
drawers, route cross-fades, chart entrance animations, hover lift on every card,
and a pulsing live indicator on in-progress batches.

Reduced motion is honoured throughout: content still appears, it simply stops
travelling.

### Problems hit and fixed

**lucide-react no longer ships brand icons.** Facebook, Instagram, LinkedIn, and
YouTube were removed upstream, presumably for trademark reasons. Rather than add
a second icon package for four glyphs, the marks are now local inline SVG in
`components/shared/social-icons.tsx`, using `currentColor` so they inherit theme
and hover states like any other icon.

**Bundle was 1.4 MB.** Recharts alone is ~354 kB and was being downloaded by
candidates who never see a chart. Introduced route-level code splitting with
`React.lazy`, and moved `Suspense` inside the keyed transition element so a lazy
chunk's loading state belongs to the incoming route rather than blanking the
layout.

| | Before | After |
|---|--------|-------|
| Main chunk | 1,411 kB | 498 kB |
| Gzipped | 417 kB | 162 kB |

Recharts now loads only when an admin opens a dashboard.

**Marquee had a visible seam.** The first implementation rendered the children
plus a differently-wrapped duplicate, so the two copies were not the same width
and the -50% translate did not line up. Both copies now use identical wrappers.

### Verified

- Typecheck clean, production build clean
- Preview server serves 200, assets and favicon resolve, document title correct
- Backend untouched: 19/19 tests still pass

### Data

Portal screens render against fixtures in `lib/mock-data.ts`, since the Phase 2
API does not exist yet. The fixture generator uses a **fixed seed** rather than
`Math.random()`, so the candidate table does not reshuffle on every render and
the UI can actually be reviewed. Every export in that module is expected to
become a fetch.

---

## 2026-08-19 (later) — Database live, three real bugs found

**Branch:** `waqas`

### Environment repair

`backend/.env` had the pooler connection string pasted as a bare line, with
`host` / `port` / `database` / `user` following it, while `DATABASE_URL` itself
was still empty. Rewrote the file: the URI is now assigned to `DATABASE_URL` and
the loose lines are gone.

The Supabase CLI is **not reachable** — absent from PATH, and the npm fallback
reports no `win32-x64` binary. Migrations were applied directly over the pooler
connection instead, and the applied version was recorded in
`supabase_migrations.schema_migrations` so a future `supabase db push` will not
re-run it.

### Migration applied

Postgres 17.6. The `public` schema was empty and `auth.users` held zero rows, so
there was nothing to overwrite. Verified after applying: two tables, the
`user_role` enum, `handle_new_user` and `touch_updated_at`, three triggers, RLS
enabled on both tables, and two select-own policies.

### Bug 1 — access tokens are ES256, not HS256

`/auth/me` rejected a token that had just been issued by a successful login.
Decoding the header showed `alg: ES256` with a `kid`.

**This project signs user access tokens with asymmetric keys.** The legacy
`SUPABASE_JWT_SECRET` signs only the API keys (anon and service_role) — which is
exactly why those verified against it earlier and user tokens did not. The
dashboard showing a "JWT Secret" is not evidence that user tokens use it.

`app/core/security.py` now resolves the key by algorithm: JWKS public key for
ES256/RS256, shared secret for HS256, rejection for anything else. Both paths are
supported because a project can be migrated between them without a redeploy.
Added regression tests for `alg: none` and unsupported algorithms.

### Bug 2 — signup failures reported as "invalid credentials"

`_translate()` mapped every 400 and 401 to `InvalidCredentialsError`, so a signup
rejected for an invalid email address told the user their password was wrong.

Rewritten around GoTrue's `error_code`, which is stable and specific, with an
explicit table covering invalid email, weak password, duplicate account,
unconfirmed email, disabled signup, and rate limiting. The status-code fallback
now depends on which operation was called: a 400 from `/token` means bad
credentials, a 400 from `/signup` does not. Four new exception types added.

### Bug 3 — Supabase rejects `example.com`

Not a code bug, but worth recording: GoTrue returns `email_address_invalid` for
`example.com`, and `email-validator` rejects `.local` on our side. Test accounts
need a plausible domain.

### Constraint discovered: built-in email is rate limited

A second signup attempt returned `over_email_send_rate_limit` after a single
prior attempt. Supabase's built-in SMTP allows only a few messages per hour.

**This blocks Phase 2.** The workflow requires batch emails to hundreds of
candidates at every stage gate. A real SMTP provider must be configured in
Supabase before interview batching can work. Ties directly to the open question
about which email provider to use.

### Verified end to end

Created a pre-confirmed user through the Admin API — which sends no email, so it
sidesteps the rate limit — and confirmed:

| Step | Result |
|------|--------|
| `handle_new_user` trigger | Profile row created, `full_name` and `phone` carried from metadata, role `CANDIDATE` |
| Login | 200, tokens plus profile |
| `GET /auth/me` | 200, correct email and role |
| Refresh | 200, new tokens |
| Tampered token | 401 `invalid_token` |
| Wrong password | 401 `invalid_credentials` |
| Logout | 200 |
| Cleanup | User deleted; profile removed by cascade, verified |

19 tests pass. The test user was removed; `auth.users` and `public.profiles` are
both empty again.

---

## 2026-08-19 — Phase 1: authentication and application shell

**Branch:** `waqas`

### Planning

Reviewed the recruitment workflow, confirmed the role hierarchy, and proposed a
folder structure and database schema for validation. Four decisions were settled
before any code was written:

| Decision | Outcome |
|----------|---------|
| Auth strategy | Initially FastAPI-native JWT; **reversed to Supabase Auth** to get password reset and Google OAuth without building them |
| Frontend language | TypeScript |
| Docs location | `/docs` |
| Candidate model | One account, many applications |

The auth reversal has a consequence worth recording: **bcrypt, listed in the
original stack, is now unused.** Supabase hashes passwords.

### Credential verification

The first JWT secret supplied was the default example token from jwt.io —
decoded to `{"sub": "1234567890", "name": "John Doe", "admin": true}`, signed
with the publicly documented secret `a-string-secret-at-least-256-bits-long`.
Rejected before use. Two problems: it is a token rather than a signing key, and
its secret is public.

Real Supabase credentials were then supplied and verified rather than assumed:

- Both keys carry project ref `cfffgnynzqmdzcgljuhx` and the expected roles
- Both signatures validate against the supplied JWT secret
- The secret works as a **raw UTF-8 string**, not base64-decoded, despite the
  trailing `==`. Tested both ways; recorded in `security.md` because this
  detail costs hours when guessed wrong.

The project URL supplied was the REST endpoint
(`.../rest/v1/`) rather than the project base. Rather than only correcting it,
`Settings` now strips `/rest/v1`, `/auth/v1`, and `/storage/v1` suffixes, so the
same mistake cannot break a future deployment.

### Built

**Order:** `.gitignore` first, before any file containing a credential existed,
and verified with `git check-ignore`.

- Backend: layered FastAPI, config, error hierarchy, JWT verification, GoTrue
  client, auth service, role gates, six endpoints
- Migration: `profiles`, `candidate_profiles`, `user_role`, provisioning trigger,
  RLS policies
- Frontend: Vite 8 / React 19 / TypeScript, Tailwind v4, shadcn/ui, router with
  three guard types, auth context, API client, login and signup pages, role
  dashboards
- Tests: 16, covering config normalisation, token verification, and the route
  contract

### Problems hit and fixed

**Invalid token returned 503 instead of 401.** FastAPI resolves all dependencies
before the function body runs, so the database session was constructed — and
failed, since `DATABASE_URL` is unset — before the token was ever decoded. An
auth failure was being masked by an infrastructure failure. Fixed by extracting
`get_token_claims` as its own dependency, declared ahead of the session, so
verification happens first. Caught by a smoke test, not by review.

**shadcn init failed on path aliases.** It reads `tsconfig.json`, which the Vite
template leaves as a bare solution file with no `compilerOptions`. Added
`baseUrl` and `paths` there.

**shadcn omitted theme tokens and `lib/utils`.** The generated components import
`cn` and reference `bg-background`, `text-muted-foreground`, and similar, none of
which existed. Wrote `lib/utils.ts` and a full Tailwind v4 token set — `:root`,
`.dark`, and `@theme inline` — and installed the missing `@base-ui/react` peer.

**`asChild` does not exist on the new shadcn Button.** The `base-nova` style is
built on Base UI, which uses a `render` prop instead. Two call sites updated.

**`baseUrl` is deprecated in TypeScript 6+.** Removed from `tsconfig.app.json`;
`paths` resolves relative to the config file. Kept in `tsconfig.json` because
shadcn's CLI still reads it.

**Vite 8 warned on `__dirname`.** Switched to `import.meta.dirname`.

### Verified

- 16/16 tests pass
- Typecheck clean, production build clean with no warnings
- Live GoTrue call correctly returns and translates `invalid_credentials`
- No `service_role` reference anywhere under `frontend/`

### Not done

Nothing committed or pushed — awaiting explicit permission.

Migration written but **not applied**: `DATABASE_URL` is still outstanding and
the Supabase CLI is not yet installed.

### Deferred, flagged for confirmation

`localStorage` token storage, role-lookup strategy, RLS policy set, the
provisioning trigger, auth traffic routed through FastAPI, and the green primary
colour. All are listed with reversal costs in `project-status.md`.
