> **Branch:** `waqas` — last updated 2026-08-22

# Project Status

## Where things stand

**Phase 1 is complete and verified against the live Supabase project.** The
database schema is applied, and the full authentication round trip works:
signup provisioning, login, `/auth/me`, token refresh, and logout.

**Both email systems are live and verified with real sends:** Supabase SMTP
for auth emails, and a Gmail API integration for the backend's own emails
(interview invites, results, onboarding links — Phase 2's actual sending
mechanism, built ahead of the routes that will call it).

**Phase 2 registration is built and verified end to end**: a super admin can
create an intake, assign an admin, open and close registration against a
deadline, and candidates can apply and receive a candidate code. Scope and
deadline enforcement are both proven with live tests.

**The candidate dashboard is the first screen wired to real data.** It fetches
`/applications/mine` and `/bootcamps/open` and picks its own state from the
result: an explainer for candidates who have not applied, a live tracker for
those who have. The remaining portal screens still render from fixtures.

**The registration form is built, UI-only.** Four sections, one at a time, with
progressive field unlocking, a page-fold transition, and full validation. It is
reachable from the **Register** button in the portal header and **persists
nothing** — the database layer for it is a separate, not-yet-started task.

**Signing up and registering are now distinct in the UI, as they always were in
the data.** A User is created at signup; an Application only when somebody
registers for a bootcamp. Application, Interview, and Documents stay locked
until an Application exists — in the sidebar *and* at the route, since a URL is
typeable. The Register button now opens the registration form; the summary view
behind "Application" is deliberately unbuilt until the registration form's
fields are known.

**One migration is written but not applied, and it now blocks reads.**
`20260820180000_candidate_journey.sql` renames two enum values and adds
`applications.is_selected`. Because SQLAlchemy selects that column, every
application query fails until it runs — including `/applications/mine`, which
the candidate dashboard calls on load. See *Blocked* below.

---

## Done

### Backend

| Item | Notes |
|------|-------|
| Layered FastAPI structure | `routes → services → models`, versioned at `/api/v1` |
| Settings with fail-fast validation | Missing env vars stop boot, not first request |
| Supabase token verification | ES256 via JWKS **and** HS256 via shared secret |
| GoTrue integration | signup, login, refresh, logout, with error-code mapping |
| Role gates | `require_roles`, `require_admin`, `require_super_admin` |
| Error hierarchy + 3 handlers | Single response envelope everywhere |
| Lazy database engine | App boots and serves `/health` without `DATABASE_URL` |
| Gmail API email integration | `app/services/email_service.py` — real send verified, message id returned |
| **Phase 2 registration pipeline** | 15 new endpoints: bootcamps, phases, programs, applications |
| Deadline enforcement | Service-layer; flag **and** clock, so an expired deadline closes a phase |
| Bootcamp scope enforcement | `assert_can_manage()` — an admin cannot reach another intake's candidates |
| Atomic candidate codes | SQL `mint_candidate_code()`; verified race-safe under 24 concurrent mints |
| 38 tests, all passing | `pytest -q` |

Endpoints live:

```
GET    /api/v1/health
POST   /api/v1/auth/signup|login|refresh|logout        GET /api/v1/auth/me

GET    /api/v1/programs                                # public
GET    /api/v1/bootcamps/open                          # public

GET    /api/v1/bootcamps                               # scoped to caller
POST   /api/v1/bootcamps                               # SUPER_ADMIN only
GET    /api/v1/bootcamps/{id}
PATCH  /api/v1/bootcamps/{id}
POST   /api/v1/bootcamps/{id}/admins/{profile_id}      # SUPER_ADMIN only
PATCH  /api/v1/bootcamps/{id}/phases/{phase}
POST   /api/v1/bootcamps/{id}/phases/{phase}/open|close
GET    /api/v1/bootcamps/{id}/applications             # paginated, filterable

POST   /api/v1/applications                            # CANDIDATE
GET    /api/v1/applications/mine
GET    /api/v1/applications/{id}
POST   /api/v1/applications/{id}/stage                 # ADMIN
```

### Database — applied

**Two of three migrations applied.** The third
(`20260820180000_candidate_journey.sql`) is written but not yet run — see
*Blocked*. It is a hard dependency, not a nicety.

`20260820120000_phase2_registration.sql` added the
pipeline: `programs`, `bootcamps`, `bootcamp_programs`, `bootcamp_admins`,
`bootcamp_phases`, `applications`, `stage_transitions`, four enums, and the
atomic `mint_candidate_code()` function. Pushed with the Supabase CLI. RLS is
enabled deny-by-default on every table; the 5 programs are seeded.

Migration `20260819120000_init_auth_profiles.sql` is **applied** to project
`cfffgnynzqmdzcgljuhx` (Postgres 17.6). Verified present:

- `profiles`, `candidate_profiles`
- `user_role` enum
- `handle_new_user()` provisioning trigger on `auth.users`
- `touch_updated_at()` and its two triggers
- RLS enabled on both tables, select-own policies only

Applied over the pooler connection rather than the CLI, and recorded in
`supabase_migrations.schema_migrations` so a later `supabase db push` will skip it.

### Frontend

**25 pages, 33 components, ~10,400 lines.**

| Item | Notes |
|------|-------|
| Vite 8 + React 19 + TypeScript | `strict` and `noUncheckedIndexedAccess` on |
| Tailwind v4 + shadcn/ui | Full light/dark token ramps, green primary |
| Auth pages | Signup (live password checklist, confirm password, role selector), Login (show/hide password) |
| Auth validation | Single source of truth in `features/auth/password-rules.ts` — drives both zod schema and UI checklist |
| Role foundation | Student functional, Admin visible but disabled; selector is presentational only, no role sent to API |
| Marketing site | Home, Programs, Program detail, Admissions, About, Success Stories, FAQ, Contact |
| Candidate portal | Overview, **Track application**, Application, Interview, Documents, Profile |
| **Candidate dashboard — live data** | Fetches `/applications/mine` + `/bootcamps/open`; renders explainer or tracker from the result |
| **Journey stepper** | One component, two modes: `demo` plays once per mount, `real` reflects actual stage. Five visible steps over seven stored stages. `components/shared/journey-stepper.tsx` |
| Typewriter, Countdown | Written in-house — no `typewriter-effect`, no carousel library |
| **User vs Candidate gating** | `ApplicationProvider` holds one answer portal-wide; `requires: 'application'` locks nav rows, `RequiresApplication` guards the routes |
| **ErrorBoundary** | Class component around the portal outlet and the account menu; resets by `key` on navigation |
| **Registration form** | 4 sections, progressive field unlocking, page-fold transition, 19 IT courses, bootcamp-specific declarations. `features/registration/` — UI + local state only |
| Admin portal | Dashboard, Candidates, Interviews, Phases, Emails |
| Super-admin portal | Dashboard, Bootcamps, Administrators, Analytics |
| Navigation | Animated mega-menu dropdowns, spring-driven mobile drawer |
| Portal shell | Collapsible sidebar, `layoutId` active indicator, role-driven nav |
| Motion primitives | Reveal, Stagger, Counter, Marquee, PageTransition |
| Theme | Light / dark / system, pre-paint script prevents flash |
| Charts | Recharts, theme-aware, lazily loaded |
| Code splitting | Main chunk 498 kB (162 kB gzip), down from 1,411 kB |
| Accessibility | `prefers-reduced-motion` honoured throughout |
| Production build | Clean, no warnings |

**The candidate dashboard and tracker now call the API.** The remaining portal
screens — admin, super-admin, and the candidate's Application / Interview /
Documents pages — still render against fixtures in
`frontend/src/lib/mock-data.ts`. That file no longer defines the stage enum; it
re-exports it from `lib/stages.ts`, which is the single definition shared with
the database.

### Verified end to end, not assumed

Using a pre-confirmed user created through the Admin API, then deleted:

| Step | Result |
|------|--------|
| Provisioning trigger | Profile created, metadata carried, role `CANDIDATE` |
| Login | 200 with tokens and profile |
| `GET /auth/me` | 200, correct email and role |
| Token refresh | 200, new tokens |
| Tampered token | 401 `invalid_token` |
| Wrong password | 401 `invalid_credentials` |
| Logout | 200 |
| Delete user | Profile removed by cascade |

Database left clean: `auth.users` and `public.profiles` are both empty.

---

## Blocked

### Open — candidate-journey migration not applied

`supabase/migrations/20260820180000_candidate_journey.sql` renames two enum
values and adds `applications.is_selected`. The code already assumes all three
changes.

Three attempts to run it were refused by the environment's permission
classifier, so it must be applied manually. **Until it runs, the candidate
dashboard is broken**: `is_selected` is on the SQLAlchemy model, so every
`SELECT` on `applications` fails with `UndefinedColumn`, `/applications/mine`
returns 500, and the dashboard renders its error state.

Apply it in the Supabase SQL Editor:

```sql
alter type public.application_stage rename value 'ASSESSMENT'   to 'PHYSICAL_INTERVIEW';
alter type public.application_stage rename value 'FORM_PENDING' to 'FORM';
alter table public.applications add column if not exists is_selected boolean;
```

Zero application rows exist, so nothing is at risk.

Everything else below needs action but is not blocking today's work.

### Resolved — Gmail OAuth consent screen published

The consent screen was moved from Testing to **Production** on 2026-08-20,
which removes the 7-day refresh token expiry that applies to unverified apps.
Publishing does not revoke existing tokens: the token issued during Testing was
re-tested after publishing and sent successfully, so no re-authorisation was
needed.

Google verification is still not required, because the app has a single
authorised user and requests only the `gmail.send` scope.

### Resolved — Gmail API integration built and verified

Backend can now send its own email (separate from Supabase's SMTP, which only
covers Supabase Auth's emails). Real send tested end to end:
`email_service.send_email()` → live Gmail API call → real message id
returned, confirmed delivered. See `development-logs.md` for the two OAuth
setup errors hit and fixed along the way.

### Resolved — SMTP now working

Custom SMTP (personal Gmail + App Password) is configured in Supabase and
**verified working** end to end: a live signup returned `confirmation_sent_at`
populated with no error, and the provisioning trigger created the profile
correctly. Test account was deleted via the Admin API afterward; database is
clean.

First attempt failed with `"Error sending confirmation email"` (500). Root
cause was Google blocking the new third-party sign-in as suspicious — resolved
by confirming a Google security prompt, not a config error. No SMTP setting
needed to change.

**Known limitation, not yet a blocker:** personal Gmail caps at 500 emails/day
and is not built for bulk/automated sending — a real risk of throttling once
batch interview invites (125+ emails in one click) run at actual bootcamp
volume. Fine for Phase 2 development; **must move to Resend or SendGrid before
the first real intake goes live.**

The Supabase CLI has no `logs` subcommand — hosted Auth/API logs live only in
the dashboard's Log Explorer (Logflare-backed), not something the CLI exposes.
`auth.audit_log_entries` was checked as a Postgres-side alternative and
confirmed empty; it only records successful auth events, not send failures.

**Supabase CLI is now working** (scoop install, v2.115.1-beta.4, logged in, project
linked). `supabase migration list` reports local and remote both at
`20260819120000` — the manual migration record written before the CLI was
available is consistent with what the CLI expects, so no migration will be
re-applied. The npm/npx install path is broken on Windows and should not be used;
scoop is the working route.

---

## Awaiting decisions

Choices made provisionally, each reversible, flagged for confirmation:

| 7 | Register button after registering | Unchanged — still opens the form | Trivial |

Item 7 needs a decision. Recommendation: once an application exists, relabel
the button **View application** pointing at the summary page, and guard
`/dashboard/register` the same way the other gated routes are guarded, since
the URL stays typeable. Do **not** hide it outright — applications are unique
per `(bootcamp, profile)`, so a candidate may legitimately apply to a second
concurrent intake, and a vanished button would block that.

| # | Decision | Taken | Reversal cost |
|---|----------|-------|---------------|
| 1 | Role source | `profiles` lookup per request | Low |
| 2 | RLS | Deny-by-default, select-own | Low — one migration |
| 3 | Provisioning trigger | Auto-create profile, role `CANDIDATE` | Low |
| 4 | Auth traffic | Through FastAPI, not browser-to-GoTrue | Medium |
| 5 | Token storage | `localStorage` | Medium — one file, plus backend cookie work |
| 6 | Primary colour | Green, matching Saylani | Trivial — two CSS variables |

Unanswered questions carried forward:

- **Email provider** — now urgent, not optional; it gates Phase 2
- Who provisions admins, and through what interface?
- What is the AI Interviewer — automated scoring, or a real conversation?
- Is the 300 → 50/50/25 batch split fixed or per-bootcamp configurable?
- Does the system schedule physical assessments, or only record outcomes?
- Exact onboarding form fields beyond IBAN and CNIC?
- Agilytic: API integration or manual export?
- Deployment target?

---

## Next

1. **Apply `20260820180000_candidate_journey.sql`** — the candidate dashboard
   returns 500 until it lands
2. Provision the first real `SUPER_ADMIN` (test accounts were deleted)
3. Seed a real Bootcamp 07 so the tracker can be exercised with a real
   application rather than only its empty state
4. **Approve the registration field list**, then design its schema — the form
   is reachable and validates, but stores nothing
5. Add CAPTCHA to the registration form (deliberately omitted, no stub)
6. Build the Application summary view + Print/PDF, once the form's fields are final
7. Wire the remaining portal screens to the API — admin and super-admin still
   read `lib/mock-data.ts`
8. Phase 3: interview batching (50/50/25 slots) and the AI screening hook —
   still blocked on deciding what the AI Interviewer actually is

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
```
