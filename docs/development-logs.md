> **Branch:** `development` — last updated 2026-08-20

# Development Logs

Chronological record of what was built, when, and why. Newest first.

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
