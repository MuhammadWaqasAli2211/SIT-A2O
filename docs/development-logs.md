> **Branch:** `huzaifa` — last updated 2026-08-22

# Development Logs

Chronological record of what was built, when, and why. Newest first.

---

## 2026-08-22 — Fixtures removed, documents built, two real auth bugs found

**Branch:** `huzaifa`

Brief: remove every mock fixture, fix routing, make each bootcamp's dashboard
properly scoped, and fix a Base UI menu crash. Three decisions were taken
first: build real document uploads (Supabase Storage + a `documents` table)
rather than hiding the page, add `PATCH /auth/me` so candidates can edit their
own profile, and keep interview scores hidden from candidates.

### The menu crash, and what it really was

```
Base UI: MenuGroupContext is missing.
```

`DropdownMenuLabel` renders `MenuPrimitive.GroupLabel`, which Base UI requires
to sit inside a `Menu.Group`. Three call sites rendered one loose — including
`portal-layout.tsx`, which is on **every** portal page, so the account menu
took the whole app down whenever it opened. Fixed by wrapping each in
`DropdownMenuGroup`, not by suppressing the error.

A `RouteErrorBoundary` is now attached as `errorElement` on every top-level
branch, so the next error of this class degrades to one section instead of a
white screen.

### Two auth bugs, found by end-to-end testing rather than review

**1. Clock skew — spurious 401s right after login (the serious one).**

The scope test kept failing: a freshly created admin's token was rejected on
every call while the super admin's worked. Three hypotheses were wrong (JWKS
rotation, an empty key set, upstream rate limiting) before unwrapping the real
exception:

```
ImmatureSignatureError: The token is not yet valid (iat)
```

GoTrue stamps `iat` from **its** clock. Supabase's runs a second or two ahead
of this machine, so a token is "not yet valid" for the first moments of its
life. The super admin's token only worked because it had been minted seconds
earlier and local time had caught up — which is exactly why this looked
intermittent rather than systematic.

In production this reads as *users randomly getting 401s immediately after
signing in successfully*. Fixed with a 60-second `leeway` on decode, with
tests covering drift up to 59s, rejection at an hour, and confirmation that
expiry, audience, subject, and signature checks all still hold.

**2. A JWKS outage was reported as a bad token.**

Found while chasing the above. `security.md` claimed an unreachable JWKS
endpoint returns 502 and an unknown `kid` returns 401, but any
`PyJWKClientError` whose message contained "Unable to find" produced a 401 —
including a key set that came back empty. Telling every signed-in user their
token is invalid, for a fault none of them can fix, is the wrong answer.

Now: a connection error or an unreadable/empty key set is a 502; a readable
key set that genuinely lacks the `kid` is a 401. An unknown `kid` also
refetches once before giving up, so genuine key rotation resolves instead of
locking everyone out.

### Documents — migration `20260820160000_candidate_documents.sql`

A `documents` table indexing objects in a **private** Supabase Storage bucket,
plus `document_type` and `document_status` enums. Metadata only — no base64
column, or every listing query would drag megabytes through the API.

The browser never holds a storage credential: uploads pass through the API
(the only place size and content-type limits can be enforced), and reads are
served by a signed URL valid for 120 seconds. Content types are restricted to
PDF/JPEG/PNG/WebP — SVG is excluded deliberately, being an image that can
carry script.

One live document per `(application, doc_type)`: a re-upload replaces the row,
so "the candidate's CNIC front" is never ambiguous. A rejection must carry a
reason, enforced by a CHECK constraint *and* at the service boundary so the
admin gets a usable message instead of an integrity error. Accepted documents
cannot be replaced or deleted by the candidate.

### Everything else wired to real data

`lib/mock-data.ts` is **deleted**. Every fixture it exported had reached zero
consumers first, verified per-symbol rather than by deleting and seeing what
broke.

- **Super admin**: Bootcamps (create/edit/delete, assign admins, programme
  sets), Administrators (provision staff, roles, activation, password reset),
  Analytics (funnel, tracks, cities, 30-day trend), Overview.
- **Programs**: full CRUD screen — the backend had it since the last sprint
  with no UI.
- **Candidate**: dashboard, application *and* the apply flow, interview
  schedule, documents.
- **Account**: one `/account` screen for every role, replacing a
  candidate-only profile page that the topbar linked staff to — they were
  bounced straight back out by the role gate.

`PlatformStats` gained `by_city`, `applications_over_time`, and per-intake
summaries so the super-admin screens need one call rather than N+1.

### Scoping proven, not assumed

The provider now wraps both staff branches, so a super admin uses the same
per-bootcamp tools without a parallel mechanism. A live end-to-end run —
create intake → set deadlines → create admin → assign → sign in as them —
confirms an admin sees exactly one intake and gets **403** on another's
detail, applicants, interviews, documents, emails, and stats, plus platform
stats, global audit, bootcamp creation, and staff creation. 31/31 checks pass.

A second run covers documents end to end against live Supabase: apply →
checklist → upload → signed-URL download (bytes match) → executable refused →
reject without reason refused → reject with reason → candidate sees it →
re-upload → accept → deletion refused. 16/16 pass.

### Verified

| Check | Result |
|-------|--------|
| Backend tests | 185 pass, up from 120 |
| Frontend typecheck | Clean |
| Production build | Clean |
| Frontend lint | 0 errors |
| Fixture imports outside tests | None — the module is gone |
| Live scope/flow run | 31/31 |
| Live documents run | 16/16 |

Lint warnings dropped from a mix including purity, immutability, and
ref-during-render to only fast-refresh notices plus three `set-state-in-effect`
in files this sprint did not touch.

### Not done

The Gmail OAuth Production flip and the Resend/SendGrid migration remain open,
as does the AI Interviewer and Agilytic — all explicitly out of scope.

---

## 2026-08-20 (night) — Admin portal: full backend surface, frontend wired to it

**Branch:** `huzaifa`

Brief: build out full admin functionality — every feature an admin should
have, wired to real data, plus a working `SUPER_ADMIN` account
(`admin@sita2o.com`). Preceded by a codebase-wide analysis pass (branches
confirmed: `main`, `development`, `waqas`, `huzaifa` all present) that
surfaced three real bugs, folded into this work rather than fixed separately.

Four decisions confirmed before building: `SUPER_ADMIN` stays the only truly
global role rather than flattening `ADMIN` to global too, three new tables
(`interviews`, `email_log`, `audit_logs`) get built rather than left as mock
UI, the password was supplied directly rather than generated, and the build
went page-by-page (Dashboard → Candidates → Phases/Interviews → Emails) rather
than backend-then-frontend in two passes.

### Schema — migration `20260820140000_admin_portal.sql`

Three new tables, three new enums (`interview_mode`, `interview_status`,
`email_status`). Applied over the pooler connection — the Supabase CLI is
still not on this machine's PATH — and recorded in the ledger.

`email_log` and `audit_logs` carry **no RLS policies at all**, a deliberate
departure from every earlier table: both are staff-only with no "select own
row" case for a candidate, so the safest policy is none rather than a
partial one someone might extend incorrectly later.

`interviews` is many-per-application by design: a reschedule adds a row
instead of overwriting one, so the history of attempts survives.
`Application.stage` remains the single source of truth for pipeline position
— interview rows never drive routing decisions on their own.

### Backend: 21 → 59 endpoints

Nine route modules (four new: `interviews`, `emails`, `users`, `audit`), nine
matching services, plus `audit_service.py` as the one call site every mutating
service goes through — `record()` joins the caller's transaction rather than
committing separately, so a failed action never leaves an audit row claiming
it succeeded.

**Staff provisioning answers the open question from `security.md`.** `POST
/users` (`create_staff`) calls GoTrue's admin API with `email_confirm=True`,
rejects `role=CANDIDATE` outright, and is gated `require_super_admin`. The
first super admin has nobody to authorise them, so
`scripts/create_super_admin.py` exists as a one-time, idempotent bootstrap
reading credentials from env vars only.

**Guardrails added, not just documented:** a super admin cannot demote,
deactivate, or delete their own account, or the last active super admin —
checked server-side, both return `409` since the caller could resolve the
conflict (promote someone else first), which is not what `403` means.

### Three real bugs found and fixed

Found during an initial full-codebase review (requested separately, before
this build started), then fixed as part of it rather than deferred:

1. **HIGH — `PATCH` on a phase window silently wiped the deadline.**
   `update_phase_window` assigned `opens_at` and `deadline_at`
   unconditionally; sending only one field nulled the other, leaving
   registration open indefinitely with no error. `PhaseUpdate` schema and
   service now use `model_dump(exclude_unset=True)`, matching the pattern
   `update_bootcamp` already used correctly. Six unit tests pin the
   omitted-vs-explicit-null distinction; verified against the *live* database
   in a smoke test, not just the fixture.
2. **MEDIUM — duplicate-application race surfaced as a raw 500.** The
   pre-insert `SELECT` is not a lock; two simultaneous submissions could both
   pass it and collide on the DB's unique constraint. Now caught by
   constraint name and translated to the same `409` the non-racing path
   already returned.
3. **MEDIUM — rejection was permanently terminal.** `advance_stage` raised
   `403 permission_denied` for any non-`ACTIVE` application, with no route
   back — and no way to reapply either, since `(bootcamp_id, profile_id)` is
   unique. Added `POST /applications/{id}/reinstate`; corrected the status
   code to `409` to match the identical "already at this stage" case two
   lines above it in the same function.

### Frontend: admin portal wired to the real API

`lib/types.ts` is now the canonical mirror of every backend schema, not just
the enums — `lib/mock-data.ts` re-exports `ApplicationStage` from it instead
of redeclaring it, closing a drift risk that existed even before this session.

**No react-query added.** `hooks/use-async.ts` covers loading/error/refetch
and stale-response cancellation in ~80 lines — judged lighter than a query
library for five screens.

**`BootcampProvider` is a layout route**, not a per-page hook: the selected
intake has to survive navigation between Candidates, Interviews, Phases, and
Emails, so it sits above all five as `routes/admin-layout.tsx` and persists
the choice to `localStorage`.

**Batch interview scheduling** spaces slots evenly from a chosen start time
and duration, is all-or-nothing server-side, and advances each candidate to
`INTERVIEW_SCHEDULED` automatically. Built for the 50/50/25 split the docs
describe, but nothing hardcodes those numbers — batch size is a plain input.

**Email compose** renders four starting templates through the backend's
`$candidate_name`-style merge fields (`string.Template.safe_substitute`,
chosen specifically because an admin's typo in a placeholder must not fail
the send — it must render literally and stay visible in the sent mail).

Two `set-state-in-effect` lint warnings introduced during the build were
removed before finishing, not left for later: one intake-selection default
moved from an effect into a `useMemo` (it was being derived correctly every
render already; writing it back bought nothing), and one phase-edit form's
sync-with-server-props effect was replaced with a remount key built from the
server's own field values.

### Verified end to end against the live database, not assumed

Real login as `admin@sita2o.com` → confirmed `SUPER_ADMIN` from both the
login response and `/auth/me`. Real Bootcamp 07 created with all 5 tracks.
The phase-window fix specifically verified live: a deadline set, then a
follow-up PATCH touching only `opens_at`, then confirmed the deadline was
still present — the exact failure mode of bug #1, reproduced and disproven
against production data, not a mock.

Every self-guardrail exercised for real: self-demotion `409`, self-deactivation
`409`, no-token `401`. Response shapes for all 7 representative endpoints
diffed key-for-key against the TypeScript types — zero missing, zero extra
fields.

| Check | Result |
|-------|--------|
| Backend tests | 120/120 pass, up from 38 |
| Frontend typecheck | Clean |
| Frontend production build | Clean |
| Frontend lint | 0 errors (34 pre-existing-style warnings, same count as before minus the 2 introduced-then-fixed) |
| OpenAPI schema generation | 44 paths, 67 models, no errors |
| Live smoke test | Login, stats, Bootcamp 07 lifecycle, phase-window regression, all guardrails — all pass |

### Not yet wired

Super-admin pages (`/super-admin/*` — Bootcamps, Administrators, Analytics)
and the whole candidate portal still render `lib/mock-data.ts` fixtures. The
backend every one of them needs already exists and is covered by the same
`features/admin/api.ts` wrapper — `bootcampApi`, `userApi`, `platformApi`,
and `GET /me/interviews` are ready to call.

---

## 2026-08-20 (evening) — Phase 2: registration pipeline

**Branch:** `development`

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

**Branch:** `development`

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

**Branch:** `development`

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

**Branch:** `development`

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

**Branch:** `development`

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

**Branch:** `development`

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
