# Saylani Bootcamp Recruitment & Onboarding Platform

Automates the bootcamp recruitment pipeline for Saylani Mass IT Training — from
application submission through interview, physical assessment, and onboarding —
replacing a manual process built on phone calls, spreadsheets, and hand-written
email.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, TypeScript, Tailwind v4, shadcn/ui, Recharts |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | Supabase Postgres |
| Auth | Supabase Auth (GoTrue), verified in FastAPI |
| Migrations | Supabase CLI |

## Layout

```
backend/     FastAPI service — routes, services, models, schemas
frontend/    React SPA — pages by role, features by domain
supabase/    SQL migrations (the schema source of truth)
docs/        Architecture, phases, security, status, logs
```

## Getting started

**Prerequisites:** Node 20+, Python 3.11+, Supabase CLI.

```bash
# 1. Environment
cp backend/.env.example backend/.env      # fill in Supabase values
cp frontend/.env.example frontend/.env

# 2. Database
supabase link --project-ref <ref>
supabase db push

# 3. Backend
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload    # :8000

# 4. Frontend
cd frontend
npm install
npm run dev                                                     # :5173
```

API docs at `http://localhost:8000/docs` outside production.

## Tests

```bash
cd backend  && ./.venv/Scripts/python.exe -m pytest -q
cd frontend && npm run build
```

## Roles

| Role | Scope |
|------|-------|
| `SUPER_ADMIN` | All bootcamps, all admins, global analytics |
| `ADMIN` | One bootcamp: deadlines, batching, selection, emails |
| `CANDIDATE` | Own application: apply, track status, fill forms |

## Documentation

| Document | Covers |
|----------|--------|
| [architecture.md](docs/architecture.md) | System design, layers, data flow, trade-offs |
| [phases.md](docs/phases.md) | The four workflow phases and their rules |
| [security.md](docs/security.md) | Secrets, auth, RLS, sensitive data |
| [error-handling.md](docs/error-handling.md) | Error envelope and conventions |
| [project-status.md](docs/project-status.md) | What is done, blocked, and pending |
| [project-summary.md](docs/project-summary.md) | High-level overview |
| [development-logs.md](docs/development-logs.md) | Chronological build log |
| [prompts.md](docs/prompts.md) | Instruction log |

## Conventions

- Documentation updates record the branch they came from.
- `supabase/migrations/` is the schema authority; SQLAlchemy models mirror it by
  hand and must be updated alongside.
- Secrets live only in gitignored `.env` files. No `VITE_`-prefixed secret ever —
  Vite inlines those into the browser bundle.
