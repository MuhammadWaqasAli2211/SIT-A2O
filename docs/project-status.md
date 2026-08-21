> **Branch:** `huzaifa` — last updated 2026-08-22

# Project Status

## Where things stand — 2026-08-22 update

**The whole portal now runs on real data. `lib/mock-data.ts` is deleted.**
Super-admin screens (Bootcamps, Administrators, Analytics, Programs) and the
entire candidate portal are wired to the API alongside the admin screens.

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
places, including the account menu in `portal-layout.tsx`. Fixed, and a route
`errorElement` now contains any future error of that class.

**Backend tests: 185** (was 120). Live verification: 31/31 on the
create-intake → deadlines → create-admin → assign → scope flow, and 16/16 on
the document upload/review pipeline.

Still open: the Gmail OAuth Production flip and the Resend/SendGrid migration.

---

## Where things stand

**Phase 1 is complete and verified against the live Supabase project.** The
database schema is applied, and the full authentication round trip works:
signup provisioning, login, `/auth/me`, token refresh, and logout.

**Phase 2 registration is built and verified end to end**: a super admin can
create an intake, assign an admin, open and close registration against a
deadline, and candidates can apply and receive a candidate code.

**The admin portal is now built and wired to the real API** — the biggest
addition since Phase 2. All five admin screens (Dashboard, Candidates,
Interviews, Phases, Emails) run on live data against your Supabase project,
not fixtures. A working `SUPER_ADMIN` account exists
(`admin@sita2o.com`) with a real bootcamp (07) to exercise the flow.

**Both email systems are live and verified with real sends:** Supabase SMTP
for auth emails, and a Gmail API integration for the backend's own emails
(interview invites, results, onboarding links), now wired into the admin
Emails screen with per-recipient delivery logging.

**Super-admin pages (Bootcamps, Administrators, Analytics) and the candidate
portal still render from fixtures.** The backend they need already exists —
see "Next" below.

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
| Deadline enforcement | Service-layer; flag **and** clock, so an expired deadline closes a phase |
| Bootcamp scope enforcement | `assert_can_manage()` — an admin cannot reach another intake's candidates. **Now unit-tested**, not just documented |
| Atomic candidate codes | SQL `mint_candidate_code()`; verified race-safe under 24 concurrent mints |
| Audit trail | Every privileged write (`bootcamp.*`, `phase.*`, `application.*`, `profile.*`, `interview.*`, `email.*`) logged with actor, before/after diff, and a summary |
| **120 tests, all passing** | `pytest -q` — up from 38 |

**59 endpoints live** (up from 21), across 9 route modules: `health`, `auth`,
`programs`, `bootcamps`, `applications`, `interviews`, `emails`, `users`,
`audit`. Full list via `/docs` (disabled in production) or `/openapi.json`.

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

**Three migrations applied**, all recorded in
`supabase_migrations.schema_migrations`:

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

### Frontend

| Item | Notes |
|------|-------|
| Vite 8 + React 19 + TypeScript | `strict` and `noUncheckedIndexedAccess` on |
| Tailwind v4 + shadcn/ui | Full light/dark token ramps, green primary |
| Auth pages | Signup, Login — unchanged since Phase 1 |
| **Admin portal — wired to the real API** | Dashboard, Candidates, Interviews, Phases, Emails — no fixtures remain here |
| `features/admin/api.ts` | Typed wrapper over all 59 endpoints |
| `features/admin/bootcamp-context.tsx` | The selected intake, shared across all 5 admin screens, persisted in `localStorage` |
| `hooks/use-async.ts` | Minimal fetch/mutation hook (no react-query dependency added) |
| Batch interview scheduling | Spaces slots evenly from a start time, all-or-nothing, advances stage automatically |
| Email compose | 4 starting templates, `$candidate_name`-style merge fields, broadcast by stage filter |
| Candidate detail sheet | Stage moves, reinstate, interview history, full timeline, contact info |
| Phase controls | Open/close, date windows, warns when a flag is on but the deadline has passed |
| `lib/types.ts` | Now the canonical mirror of every backend schema; `lib/mock-data.ts` re-exports the enum from it rather than redeclaring |
| Charts | Recharts, lazily loaded per-dashboard, theme-aware |
| Production build | Clean, 0 type errors, 0 lint errors |

**Still on fixtures**: `/super-admin/*` (Bootcamps, Administrators, Analytics)
and the whole candidate portal. The backend for all of it already exists.

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
types — zero mismatches across 7 representative endpoints.

---

## Blocked

Nothing blocks development.

### Open — confirm before relying on Gmail API sending long-term

The Gmail API OAuth consent screen is unverified (Testing status). Refresh
tokens for unverified apps expire after **7 days** — the current token was
issued 2026-08-20, so **sending will silently break around 2026-08-27** unless
the consent screen is flipped to Production (one toggle, no verification
actually required — see `security.md`). Not yet confirmed done.

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

Unanswered questions carried forward:

- Who provisions the *next* super admin after this one, day to day? (`POST
  /users` now exists and works — this is a process question, not a technical one)
- What is the AI Interviewer — automated scoring, or a real conversation?
- Is the 300 → 50/50/25 batch split fixed or per-bootcamp configurable? (The
  batch scheduler supports arbitrary sizes today; nothing hardcodes 50/50/25)
- Does the system schedule physical assessments, or only record outcomes?
- Exact onboarding form fields beyond IBAN and CNIC?
- Agilytic: API integration or manual export?
- Deployment target?

---

## Next

1. **Flip the Gmail API OAuth consent screen to Production** — prevents the
   7-day refresh token expiry, no verification required
2. **Wire the super-admin pages** — Bootcamps (create/edit/delete/assign
   admins), Administrators (staff directory, provisioning, role changes),
   Analytics (platform-wide stats) all have a working backend already;
   `bootcampApi`, `userApi`, and `platformApi` in `features/admin/api.ts`
   cover every call they need
3. **Wire the candidate portal** — application submission, own-interview
   view, documents, profile — `applicationApi` and `interviewApi.listForBootcamp`'s
   sibling `GET /me/interviews` are ready
4. Seed real bootcamp admins so per-bootcamp scoping can be exercised through
   the UI, not just the API
5. Phase 3: interview batching is built (arbitrary slot counts, evenly
   spaced); the AI screening hook is still blocked on deciding what the AI
   Interviewer actually is

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
