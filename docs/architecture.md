> **Branch:** `huzaifa` — last updated 2026-08-20

# Architecture

## Shape

```
React + Vite (TypeScript)          FastAPI                    Supabase
  browser                          API layer                  platform
     |                                  |                          |
     |-- POST /api/v1/auth/login ------>|                          |
     |                                  |-- POST /auth/v1/token -->|  GoTrue
     |                                  |<-- access + refresh -----|
     |                                  |                          |
     |                                  |-- SELECT profiles ------>|  Postgres
     |<-- { tokens, profile } ----------|                          |
     |                                  |                          |
     |-- GET /... (Bearer token) ------>| verify signature         |
     |                                  | resolve role             |
```

The frontend never talks to Supabase directly. Every call goes through FastAPI,
so authorization, deadline enforcement, and audit logging live in one place.

## Layers (backend)

| Layer | Directory | Responsibility |
|-------|-----------|----------------|
| Routes | `app/api/v1/routes/` | HTTP shape only: parse, delegate, return |
| Dependencies | `app/api/deps.py` | Session, current user, role gates |
| Services | `app/services/` | Business rules — the testable core |
| Integrations | `app/integrations/` | External boundaries (GoTrue, GoTrue admin API, Gmail API; AI interviewer later) |
| Models | `app/models/` | SQLAlchemy ORM, mirrors `supabase/migrations/` |
| Schemas | `app/schemas/` | Pydantic request and response contracts |

Nine route modules as of the admin-portal build: `health`, `auth`, `programs`,
`bootcamps`, `applications`, `interviews`, `emails`, `users`, `audit`. Nine
matching service modules, plus `audit_service.py`, which every mutating
service calls into rather than writing `audit_logs` rows itself — one place
decides what an audit entry looks like.

Routes never touch the ORM directly, and services never see a `Request`. This
keeps business rules unit-testable without HTTP, and makes the eventual second
consumer (AI interviewer callbacks) cheap to add.

## Identity

Supabase Auth (GoTrue) owns credentials: password hashing, email confirmation,
reset tokens, and — once enabled — Google OAuth.

FastAPI never issues a token. It verifies the signature, then resolves the
caller's role from `public.profiles`.

**This project signs access tokens with ES256**, using asymmetric keys published
at the JWKS endpoint. The legacy `SUPABASE_JWT_SECRET` signs only the API keys
(anon and service_role) — a distinction that is easy to miss, since the dashboard
shows both. `app/core/security.py` supports ES256/RS256 via JWKS and HS256 via
the shared secret, selecting by the token's algorithm. See `security.md`.

**Why role lives in the database, not the JWT:** a claim baked into a token stays
valid until that token expires. Reading `profiles.role` per request costs one
indexed primary-key lookup and makes deactivation and demotion take effect
immediately — which matters when an admin is removed mid-intake.

## Role hierarchy

```
SUPER_ADMIN ── sees every bootcamp, every admin, global analytics
    |
    +-- ADMIN ── scoped to assigned bootcamp(s) only
            |
            +-- CANDIDATE ── own application only
```

Authorization is always **role plus scope**. An admin holding a valid token must
still be denied another bootcamp's candidates. `require_roles()` in
`app/api/deps.py` covers the role half; `assert_can_manage()` in
`bootcamp_service.py` covers scope, checking `bootcamp_admins` membership on
every admin-facing call. Unit-tested directly (`tests/unit/test_bootcamp_scope.py`)
rather than only asserted by integration tests, after this exact gap was found
during the admin-portal review.

`ADMIN` stays bootcamp-scoped by design, even though the platform's one
`SUPER_ADMIN` account currently does everything: keeping the scope check live
means a second admin can be assigned to one intake later without touching
authorization code.

## Data flow: the pipeline

```
Application ──> Interview ──> Physical assessment ──> Form ──> Onboarding
   (email)      (AI filter,      (HR, 1-to-1)        (IBAN,   (Agilytic)
                 batched)                             CNIC)
```

Each arrow is an admin-triggered, deadline-gated transition. No stage advances on
its own.

## Frontend structure

Feature-first, not type-first. Three distinct role surfaces mean that grouping
globally by `components/`, `hooks/`, and `api/` would scatter one feature across
five directories.

- `pages/` — thin; routing and layout composition, grouped by role
- `features/` — the actual logic, each with its own `api`, `schemas`, components
- `routes/guards.tsx` — `ProtectedRoute`, `RoleRoute`, `GuestRoute`
- `lib/` — API client, token storage, shared types

`lib/types.ts` mirrors the backend enums and every response schema by hand.
Both must change together — a shape mismatch is a runtime bug, not a typecheck
failure, since `axios` does not validate responses against the TypeScript
type. Verified field-for-field against live API responses after the
admin-portal build; `lib/mock-data.ts` re-exports `ApplicationStage` from
`types.ts` rather than redeclaring it, so the two cannot drift.

### The admin feature

```
features/admin/
├── api.ts                # typed wrapper over every admin endpoint
├── bootcamp-context.tsx   # the selected intake, shared across all 5 admin screens
└── components.tsx         # BootcampSwitcher, AsyncSection, ConfirmDialog, Pagination
```

All five admin pages (`pages/admin/*`) are scoped to one bootcamp at a time.
`BootcampProvider` sits above them as a layout route
(`routes/admin-layout.tsx`) rather than inside each page, so switching from
Candidates to Interviews does not re-fetch the bootcamp list or lose the
selection — it is persisted to `localStorage` and falls back to the newest
intake if the stored one is gone.

There is no react-query dependency. `hooks/use-async.ts` covers what the five
screens actually need — loading state, error state, refetch, and cancellation
of a stale response — in about 80 lines, which is lighter than adding a query
library for five screens.

### The auth feature

```
features/auth/
├── password-rules.ts   # the five rules, as data — single source of truth
├── schemas.ts          # zod schemas, built from password-rules
├── role-selector.tsx   # Student / Admin account-type picker
├── api.ts              # signup, login, me, logout
└── auth-context.tsx    # session state, restore on load
```

**Why `password-rules.ts` exists separately from `schemas.ts`:** the rules are
consumed twice — once by zod to gate submission, once by the `PasswordStrength`
component to show the user what is still missing. Defining them as data in one
place means the checklist can never tick a box the validator would reject, or
vice versa. Adding a rule updates both automatically.

**The role selector is presentational.** It sends nothing to the API. Signup
always produces `CANDIDATE` server-side — see the privilege escalation section
of `security.md`. When admin accounts are eventually supported it will be an
invite flow, so the component's shape does not change; only `enabled` flips.

## Decisions and trade-offs

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Identity | Supabase Auth | FastAPI-native JWT + bcrypt | Password reset and Google OAuth come free; bcrypt is consequently unused |
| Role source | `profiles` table | Custom JWT claim | Immediate effect on demotion and deactivation |
| Auth traffic | Through FastAPI | Browser to GoTrue directly | One API surface, one place for error shaping and logging |
| Migrations | Supabase CLI | Alembic | Chosen by project owner; SQL is the source of truth, ORM mirrors it by hand |
| Frontend layout | Feature-first | Type-first | Three role surfaces would otherwise fragment |
| Admin scope model | `SUPER_ADMIN` global, `ADMIN` bootcamp-scoped | Flatten `ADMIN` to global too | Keeps per-bootcamp admin isolation viable once a second admin exists; requested by project owner |
| Frontend data fetching | A ~80-line hook (`use-async.ts`) | react-query / SWR | Five admin screens don't justify a query-library dependency |
| Audit logging | One `audit_service.record()` call site per mutation | Database triggers | Triggers can't capture *why* (the human-readable summary, the actor's reason) — only *what* |

## Consequences worth remembering

- **The ORM is not the schema authority.** `supabase/migrations/*.sql` is. There
  is no `alembic autogenerate` safety net, so a model change without a matching
  migration will pass typecheck and fail at runtime.
- **bcrypt is unused.** It appeared in the original stack list, but Supabase
  hashes passwords. It is not a dependency.
- **The app boots without a database.** `get_engine()` is lazy, so `/health` and
  `/docs` work before `DATABASE_URL` is set. Endpoints that need the database
  return `503 database_not_configured` rather than failing at import time.
