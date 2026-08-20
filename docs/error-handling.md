> **Branch:** `development` — last updated 2026-08-19

# Error Handling

## One envelope

Every error response from the API has the same three fields, whatever went wrong:

```json
{
  "code": "invalid_credentials",
  "message": "Incorrect email or password.",
  "details": null
}
```

| Field | For | Contract |
|-------|-----|----------|
| `code` | Code | Stable, machine-readable. Branch on this, never on `message` |
| `message` | Humans | Safe to display verbatim. Never contains internals |
| `details` | Debugging | Field-level validation errors, or `null` |

Because the shape never varies, `toErrorMessage()` in
`frontend/src/lib/api-client.ts` handles every failure in one function.

## Backend

### The hierarchy

`app/core/exceptions.py` defines `AppError`, and every expected failure subclasses
it. Each subclass carries its own `status_code`, `code`, and default `message`.

| Exception | Status | Code |
|-----------|--------|------|
| `AuthenticationError` | 401 | `unauthenticated` |
| `InvalidCredentialsError` | 401 | `invalid_credentials` |
| `EmailNotVerifiedError` | 401 | `email_not_verified` |
| `PermissionDeniedError` | 403 | `permission_denied` |
| `NotFoundError` | 404 | `not_found` |
| `ConflictError` | 409 | `conflict` |
| `UpstreamError` | 502 | `upstream_error` |
| `DatabaseNotConfiguredError` | 503 | `database_not_configured` |

Services raise these directly. Routes do not catch them and do not construct
`HTTPException`. Three handlers in `app/main.py` do the translating.

### The three handlers

1. **`AppError`** — maps the exception's own fields into the envelope.
2. **`RequestValidationError`** — flattens Pydantic's nested output into a flat
   list of `{field, message}`, dropping the `body` prefix that would otherwise
   appear in every path.
3. **`Exception`** — the catch-all. Logs the full traceback server-side, returns
   `500 internal_error` with a fixed message.

The catch-all exists so that an unanticipated bug can never leak a stack trace,
a SQL fragment, or a connection string to a client.

### Translating upstream failures

`app/integrations/supabase_auth.py` maps GoTrue responses onto our own types in
`_translate()`. Callers never see an `httpx` object or a Supabase error shape.

Two cases deserve note:

- A network failure becomes `UpstreamError` — "could not reach", distinct from
  "rejected your credentials". Different causes should not look identical.
- Login failures return `invalid_credentials` for both an unknown email and a
  wrong password. Distinguishing them would turn the endpoint into an account
  enumeration oracle.

### Degrading without a database

`get_engine()` is lazy. The app boots and serves `/health` and `/docs` before
`DATABASE_URL` is set; endpoints that need the database return
`503 database_not_configured` — an honest, specific answer rather than a crash
at import time.

## Frontend

### Reading errors

`toErrorMessage(error, fallback)` is the only place that inspects an error:

- No `response` at all means the API is unreachable, so it says so — "Cannot
  reach the server" is actionable, "Something went wrong" is not
- Otherwise it uses `message` from the envelope
- Anything unrecognised falls back to the caller's message

### Token refresh

The response interceptor in `api-client.ts` retries once on
`401 token_expired`, using the refresh token, then replays the original request.

Two details that matter:

- **One shared refresh.** A page firing several requests at once would otherwise
  start several refreshes and race. A single in-flight promise is shared by all
  waiters.
- **Retry once only.** The `_retried` flag on the request config prevents an
  endless refresh-retry loop when the refresh token is itself invalid.

If refresh fails, tokens are cleared and the session-expired handler runs, which
returns the user to `/login`.

### Errors in forms

Validation happens twice, on purpose:

- **Client**, via zod schemas in `features/auth/schemas.ts` — immediate feedback,
  no round trip
- **Server**, via Pydantic — the authority, since the client can be bypassed

Field errors render under their input. Request-level failures render in an alert
above the form. A form never silently fails.

## Conventions

1. Raise a typed `AppError` subclass; never return an error dict from a service.
2. Never catch a broad `Exception` to hide it — let the catch-all log it.
3. User-facing text says what to do next where possible.
4. `code` is the contract; adding one is a breaking change if clients branch on it.
5. Log with context server-side, respond without it.
