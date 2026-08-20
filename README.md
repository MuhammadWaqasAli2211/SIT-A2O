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
```

---

## How to run the backend

**Run from the `backend/` directory** — not from `backend/app/`, and not from
the repository root.

### First-time setup

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
pip install -e .          # registers the `app` package; see note below
```

### Start the server

```bash
cd backend
uvicorn app.main:app --reload
```

| | |
|---|---|
| **Run from** | `backend/` |
| **Command** | `uvicorn app.main:app --reload` |
| **URL** | http://localhost:8000 |
| **API base** | http://localhost:8000/api/v1 |
| **Swagger UI** | http://localhost:8000/docs |

### Verify it is working

```bash
curl http://localhost:8000/api/v1/health
# {"status":"ok","environment":"development","database":"ok"}
```

`"database":"ok"` confirms `.env` loaded and the Supabase connection is live.
If it reads `"not_configured"`, `DATABASE_URL` is missing from `backend/.env`.

Or open http://localhost:8000/docs for the interactive Swagger UI.

### Alternative commands

Both work identically once `pip install -e .` has been run:

```bash
python -m app.main        # from backend/
python app/main.py        # from backend/
python main.py            # from backend/app/
```

> **Why `pip install -e .`?**
> `app/main.py` uses absolute imports (`from app.core.config import ...`), which
> require `backend/` to be on Python's import path. Running `python main.py`
> from inside `app/` puts `backend/app/` on the path instead, so `import app`
> fails with `ModuleNotFoundError: No module named 'app'`. The editable install
> registers the package once, so it resolves from any directory.

### Run the tests

```bash
cd backend
pytest -q
```

---

## How to run the frontend

```bash
cd frontend
npm install
npm run dev
```

| | |
|---|---|
| **Run from** | `frontend/` |
| **Command** | `npm run dev` |
| **URL** | http://localhost:5173 |

The frontend expects the API at the URL in `frontend/.env`
(`VITE_API_BASE_URL`, default `http://localhost:8000/api/v1`). **Start the
backend first** — otherwise forms fail with "Cannot reach the server."

`CORS_ORIGINS` in `backend/.env` must include the frontend's origin. Both
`localhost:5173` and `127.0.0.1:5173` are whitelisted by default, because
browsers treat those as different origins.

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
