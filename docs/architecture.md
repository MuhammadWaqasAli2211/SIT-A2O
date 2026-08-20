> **Branch:** `waqas` — last updated 2026-08-20

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
| Integrations | `app/integrations/` | External boundaries (GoTrue today; email and AI interviewer later) |
| Models | `app/models/` | SQLAlchemy ORM, mirrors `supabase/migrations/` |
| Schemas | `app/schemas/` | Pydantic request and response contracts |

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
`app/api/deps.py` covers the role half; bootcamp scoping arrives with the
`bootcamp_admins` table in Phase 2.

## Data flow: the pipeline

Five steps, as the candidate sees them:

```
Application ──> Interview ──> Physical Interview ──> Form ──> Onboarded
   (email)     (AI filter,       (HR, 1-to-1,        (IBAN,   (Agilytic)
                 batched)        non-technical)       CNIC)
                     │
                     └── not selected ──> Rejected (terminal)
```

Each arrow is an admin-triggered, deadline-gated transition. No stage advances on
its own.

### Five steps, seven stored stages

The stepper shows five nodes. `application_stage` holds seven values, and the
extra granularity is deliberate:

| Step | Stored stage(s) |
|---|---|
| Application | `APPLIED` |
| Interview | `INTERVIEW_SCHEDULED`, `INTERVIEWED` |
| Physical Interview | `PHYSICAL_INTERVIEW` |
| Form | `FORM` |
| Onboarded | `ONBOARDED` |
| *(terminal)* | `REJECTED` |

**Why Interview keeps two stages.** Batching is a question about who has a slot
but has not yet been seen. Collapsing the two would make the 300 → 50/50/25
split unqueryable. The candidate is shown one node; the admin keeps the detail.

**Why selection is not a stage.** Clearing the interview is the condition for
reaching the next step, so the transition already encodes it. What the
transition cannot encode is *which gate* stopped somebody, since `REJECTED` is
reachable from several places — hence `applications.is_selected`, tri-state so
that "not yet decided" stays distinct from a recorded "no".

**Enum order is pipeline order.** Postgres sorts enums by declaration order, so
`order by stage` sorts by progress. Adding a value in the middle therefore means
recreating the type, not `ALTER TYPE ... ADD VALUE`, which appends.

The mapping lives in exactly one place per side — `JOURNEY_STEPS` in
`frontend/src/lib/stages.ts` and `ApplicationStage` in
`backend/app/models/enums.py` — and both mirror the Postgres enum by hand. All
three change together.

## Frontend structure

Feature-first, not type-first. Three distinct role surfaces mean that grouping
globally by `components/`, `hooks/`, and `api/` would scatter one feature across
five directories.

- `pages/` — thin; routing and layout composition, grouped by role
- `features/` — the actual logic, each with its own `api`, `schemas`, components
- `routes/guards.tsx` — `ProtectedRoute`, `RoleRoute`, `GuestRoute`
- `lib/` — API client, token storage, shared types

`lib/types.ts` mirrors the backend enums by hand. Both must change together.

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

## Consequences worth remembering

- **The ORM is not the schema authority.** `supabase/migrations/*.sql` is. There
  is no `alembic autogenerate` safety net, so a model change without a matching
  migration will pass typecheck and fail at runtime.
- **bcrypt is unused.** It appeared in the original stack list, but Supabase
  hashes passwords. It is not a dependency.
- **The app boots without a database.** `get_engine()` is lazy, so `/health` and
  `/docs` work before `DATABASE_URL` is set. Endpoints that need the database
  return `503 database_not_configured` rather than failing at import time.
