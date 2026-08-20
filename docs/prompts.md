> **Branch:** `development` — last updated 2026-08-19

# Prompt Log

Instructions given during development, and what each produced. Paraphrased for
length; intent preserved.

---

## 2026-08-19

### 1. Project brief

**Branch:** `development`

Full specification: the recruitment workflow diagram, three roles, Phase 1 scope,
tech stack, folder structure requirements, eight documentation files, and four
standing rules.

**Standing rules established:**

- **Git:** nothing committed or pushed without explicit permission, every time.
  No attribution to any AI tool in commits, comments, or docs.
- **Validation:** stop and confirm before any major decision — architecture,
  schema, auth strategy, third-party services, folder structure, refactors.
- **Environment:** never invent placeholder credentials. Ask; the owner supplies
  them.
- **Code quality:** optimal, clean, maintainable. Consistent naming. RESTful
  routing.

**Produced:** workflow and role-hierarchy confirmation, proposed folder structure
for `frontend/` and `backend/`, proposed schema for bootcamps, admins,
candidates, phases, and email logs, plus fourteen clarifying questions split into
blocking and non-blocking.

### 2. Four blocking decisions answered

**Branch:** `development`

| Question | Answer |
|----------|--------|
| Auth strategy | FastAPI-native JWT + bcrypt |
| Frontend language | TypeScript |
| Docs location | `/docs` |
| Candidate accounts | One account, many applications |

**Produced:** decisions recorded; the two schema issues raised for a call
(candidate-code collision at scale, server-side deadline enforcement).

### 3. Auth reversal and format decisions

> "for auth: use supabase auth and in future we would implement reset password
> and continue with google"
> "for identifying a student we use candidate code as key (format: B07-001)"
> "Supabase CLI"

**Branch:** `development`

Reversed decision 1 from the previous turn. Also supplied a JWT secret.

**Produced:**

- Auth architecture reworked for Supabase Auth; consequences laid out, including
  that bcrypt becomes unused
- **The supplied JWT secret was rejected** — decoded as the jwt.io example token,
  signed with a publicly documented secret
- Three new decisions raised: role-lookup strategy, RLS, provisioning trigger
- Candidate code `B07-001` accepted, with a note that three digits caps a
  bootcamp at 999 applicants

### 4. Supabase credentials

**Branch:** `development`

Project URL, anon key, service-role key, and JWT secret supplied.

**Produced:** all three keys verified — project ref, roles, and signatures. The
project URL was the REST endpoint rather than the base; corrected, and the
config now normalises it automatically. Confirmed the JWT secret is used as a raw
string, not base64-decoded.

### 5. Proceed

> "ok, you'll just start for now, I'll provide you later about these"

**Branch:** `development`

Approval to begin building, with the outstanding decisions and `DATABASE_URL` to
follow.

**Produced:** Phase 1 in full — backend, migration, frontend, tests, and these
eight documents. Six provisional decisions taken and flagged with reversal costs
in `project-status.md`. Nothing committed.

### 6. CLI installed, env vars added

> "I have installed the supabase CLI, you can access through it, but I'm not
> logged in yet, can you please do it for me"
> "I have added supabase couple of env's in backend\.env, you can check it out"

**Branch:** `development`

**Produced:**

- **CLI login not performed.** `supabase login` is an interactive browser flow;
  it cannot run in a non-interactive shell, and logging in to an account on
  someone's behalf is theirs to do. Offered the non-interactive alternative
  (`SUPABASE_ACCESS_TOKEN`). Separately, the CLI is **not on PATH** at all — the
  install did not land somewhere reachable.
- **`.env` repaired.** The connection string had been pasted as a bare line with
  loose `host` / `port` / `database` / `user` entries below it, leaving
  `DATABASE_URL` empty. Reassigned correctly and the stray lines removed.
- **Migration applied** over the pooler connection, since the CLI is unavailable,
  and recorded in the CLI's own migration table so the two stay consistent.
- **Three bugs found and fixed**, one of them significant: access tokens are
  ES256, not HS256. See `development-logs.md`.
- **One project constraint discovered:** Supabase's built-in email is rate
  limited to a few messages per hour, which blocks Phase 2 batch email.

### 7. Full UI build

> "firstly create a full scaled, enhanced and professional landing page with all
> its other pages as well with their dropdowns etc"
> "create the full UI of portals, and their dashboards as well"
> "No compromise on animation"

**Branch:** `development`

Recruitment logic explicitly deferred in favour of the interface.

**Produced:** 25 pages and 33 components across the marketing site and all three
portals, built on a shared foundation of design tokens, motion primitives, and a
theme system. Route-level code splitting cut the main bundle by 65%. See
`development-logs.md` for the problems hit along the way.

---

---

## Conventions this log follows

- Every entry records the branch it came from
- Decisions that were **reversed** stay in the log rather than being edited away
- Rejected inputs are recorded with the reason
