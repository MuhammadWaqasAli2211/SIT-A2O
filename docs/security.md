> **Branch:** `development` — last updated 2026-08-19

# Security

## Credentials and secrets

| Secret | Lives in | Reaches the browser? |
|--------|----------|----------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` | **Never** |
| `SUPABASE_JWT_SECRET` | `backend/.env` | **Never** |
| `DATABASE_URL` | `backend/.env` | **Never** |
| `SUPABASE_ANON_KEY` | `backend/.env` | Only when Google OAuth is added |
| `GMAIL_CLIENT_SECRET` | `backend/.env` | **Never** |
| `GMAIL_REFRESH_TOKEN` | `backend/.env` | **Never** — grants send-as access to the mailbox indefinitely |
| `VITE_API_BASE_URL` | `frontend/.env` | Yes, by design |

Rules in force:

- `.env` is gitignored at the repository root; `.env.example` carries key names
  with empty values and is committed.
- **Vite inlines every `VITE_`-prefixed variable into the production bundle.**
  No secret may ever carry that prefix. `frontend/.env` currently holds only the
  API base URL — no Supabase key of any kind.
- No secret is hardcoded anywhere in the source tree.

### Open item: rotate before production

The service-role key and JWT secret were transmitted in plain text during
development. Rotating the JWT secret in the Supabase dashboard reissues both the
anon and service keys and invalidates the old pair. This should happen before
the project handles real candidate data.

### The JWT secret is used as a raw string

Supabase's legacy JWT secret ends in `==`, which makes it look base64-encoded.
It is not — it is the HMAC key verbatim. Verified empirically: both the anon and
service keys validate against the raw UTF-8 string and fail against the
base64-decoded bytes. `app/core/config.py` documents this at the field.

This matters only for the HS256 verification path, which this project does not
currently exercise — see *This project issues ES256 tokens* below.

## Authentication

Supabase Auth (GoTrue) holds all credentials. This project stores no password
hash and runs no hashing code; bcrypt is not a dependency.

### This project issues ES256 tokens, not HS256

Verified against a live token: **user access tokens are signed with ES256** via
asymmetric signing keys, carrying a `kid` resolved from the project's JWKS
endpoint. The legacy `SUPABASE_JWT_SECRET` signs only the **API keys** (anon and
service_role), which is why those validated against it while user tokens did not.

Assuming HS256 from the dashboard's "JWT Secret" field is a trap: both exist, and
they cover different things.

`app/core/security.py` supports both, selecting the key source by the token's
algorithm:

| Header `alg` | Key source |
|--------------|------------|
| `ES256`, `RS256` | Public key from `/auth/v1/.well-known/jwks.json`, matched by `kid` |
| `HS256` | `SUPABASE_JWT_SECRET` (legacy projects) |
| anything else, including `none` | Rejected |

Every token is then checked for:

- a valid signature
- `aud` equal to `authenticated` — rejects tokens minted for another project
- `exp` present and in the future
- `sub` present

**On algorithm confusion.** Choosing a key by the token's own header is the
classic setup for a downgrade attack, where an attacker re-signs a token with
HS256 using the RSA *public* key as the HMAC secret. That does not work here: the
HS256 branch uses `SUPABASE_JWT_SECRET`, a value never published, and never the
JWKS public key. The two key sources are disjoint, and `none` is unreachable
because it appears in neither branch. Regression tests cover `alg: none` and
unsupported algorithms.

An unknown `kid` is an authentication failure (`401`); an unreachable JWKS
endpoint is an upstream failure (`502`). Different causes, different answers.

### Failure ordering

Token verification is a separate dependency (`get_token_claims`) declared ahead
of the database session, so an invalid token returns `401` even when the database
is unreachable. Before this split, a database outage caused invalid tokens to
surface as `503` — an auth failure masked by an infrastructure failure.

## Authorization

Role is read from `public.profiles` on every request, never from a JWT claim.
Cost is one indexed primary-key lookup; the benefit is that demotion and
deactivation take effect immediately rather than at next token refresh.

`require_roles()` in `app/api/deps.py` builds role gates. Bootcamp-level scoping
(an admin must not read another bootcamp's candidates) arrives in Phase 2 and is
**not yet enforced** — no such endpoints exist today.

## Row Level Security

Every table in the `public` schema is exposed over PostgREST by Supabase. With
RLS off, anyone holding the anon key — which is public by design — could read
those tables directly and bypass the API entirely.

Therefore: **RLS is enabled and deny-by-default on every table.** The API
connects with the service-role key and bypasses RLS; the policies exist to make
direct PostgREST access useless to an attacker.

Only `SELECT` policies are granted, and only for the caller's own row:

```sql
create policy profiles_select_own
    on public.profiles for select
    to authenticated
    using ((select auth.uid()) = id);
```

**No `UPDATE` policy exists on `profiles`, deliberately.** A self-update policy
would let any candidate set their own `role` to `SUPER_ADMIN`. All writes go
through the API, which decides what a caller may change.

## Privilege escalation

Self-service signup can only ever produce a `CANDIDATE`:

- `SignupRequest` has no `role` field, so a role in the request body is discarded
- `handle_new_user()` hardcodes `'CANDIDATE'` and never reads a role from
  `raw_user_meta_data`, which is client-controllable

Admin and super-admin accounts are provisioned deliberately. *Open question:
by whom and through what interface.*

## Token storage in the browser

Access and refresh tokens are held in `localStorage`, confined to
`src/lib/storage.ts`.

**Trade-off:** `localStorage` survives reloads and matches Supabase's own default,
but any script running on the page can read it — so an XSS bug becomes a session
compromise. `httpOnly` cookies would remove that exposure at the cost of CSRF
protection and cross-origin cookie configuration.

Confining all access to one module keeps that migration to a single file.
**Decision deferred, not settled** — it should be revisited before the platform
handles IBAN and CNIC data.

## Outbound email — two separate systems

**Supabase SMTP** (personal Gmail, App Password) — configured in the Supabase
dashboard, powers only Supabase Auth's own emails: signup confirmation,
password reset. Never touched by application code.

**Gmail API** (`app/integrations/gmail_api.py`) — powers everything the
recruitment workflow itself sends: interview invitations, batch results,
onboarding links. Uses OAuth2 with a refresh token obtained once via the
Google OAuth Playground, against a Google Cloud project (`saylani-bootcamp-mailer`)
with the Gmail API enabled and the `gmail.send` scope only.

Both currently send through the same personal Gmail account
(`thewaqasali59@gmail.com`), for two unrelated purposes. Neither is
production-appropriate at real bootcamp volume:

- Personal Gmail caps at **500 emails/day** and is not built for bulk/automated
  sending — real risk of throttling once interview batches (125+ emails per
  click) run at scale
- **Must move to Resend or SendGrid before the first real intake.** Tracked as
  an open item, not yet scheduled

### The OAuth consent screen is unverified — by design, with a consequence

The Google Cloud project's OAuth consent screen is in **Testing** status, not
verified by Google. This is appropriate for a single internal mailbox — full
verification is a review process meant for public-facing apps — but it has a
real operational consequence: **while unverified, Google expires refresh
tokens after 7 days.** Flipping the consent screen to **Production**
(APIs & Services → OAuth consent screen → Publish App) removes the expiry
without requiring verification, since only the one added test user
(`thewaqasali59@gmail.com`) will ever authorize this app.

**Open item:** confirm the consent screen has been flipped to Production. If
not, the Gmail API integration will silently stop sending ~7 days after the
refresh token was issued (2026-08-20), with no warning until a send fails.

### Access granted by the refresh token

`GMAIL_REFRESH_TOKEN` grants indefinite send-as access to the configured
Gmail account, scoped to `gmail.send` only (cannot read mail, cannot access
other Google services). Equivalent in sensitivity to a password for that one
capability — never logged, never returned by any endpoint, never committed.

## Sensitive data (Phase 4)

The onboarding form collects **IBAN** and **CNIC**. Neither is yet implemented.
Requirements when it is:

- encrypted at rest, not stored as plain columns
- never written to application logs
- never returned by list endpoints — detail views only, for roles that need them
- access recorded in `audit_logs`

## Error handling and information disclosure

The catch-all handler in `app/main.py` logs the stack trace server-side and
returns a generic message. Internal details, including database errors, never
reach the client. See `error-handling.md`.

Login failures return one message — "Incorrect email or password" — for both an
unknown email and a wrong password, so the endpoint cannot be used to enumerate
registered accounts.

## Transport and CORS

CORS origins come from `CORS_ORIGINS`, defaulting to `http://localhost:5173`.
The production origin must be set explicitly; the list is never `*`, since
`allow_credentials=True` is in effect.

API docs (`/docs`) are disabled when `ENVIRONMENT` is `production`.
