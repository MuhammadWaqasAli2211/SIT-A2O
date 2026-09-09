# Agilytics External Workspaces API

A quick-reference guide for integrating with the Agilytics portal API. All endpoints live under `/api/v1/external/workspaces/` and are protected by HMAC-SHA256 request signing.

---

## Authentication — How It Works

Every request must include two headers (or query params) so the server can verify it actually came from you.

### Required Headers

| Header | Description |
|--------|-------------|
| `x-portal-signature` | HMAC-SHA256 hex digest of the signed payload |
| `x-portal-timestamp` | Current time as Unix milliseconds (e.g. `1756000000000`) |

> **Tip:** You can also pass these as query params `signature`/`sig` and `timestamp`/`ts` for GET requests.

### Timestamp Rules

The server rejects any request where the timestamp drifts more than **5 minutes** from server time. This stops replay attacks — always generate a fresh timestamp per request.

### How to Calculate the Signature

**For POST / PUT requests:**

```
payload = <raw request body>
hmac = HMAC-SHA256(secret, payload)
signature = hmac.hex()
```

**For GET requests:**

```
# Sort all query params (except signature/sig) alphabetically, URL-encode key=value pairs
payload = "key1=val1&key2=val2"
hmac = HMAC-SHA256(secret, payload)
signature = hmac.hex()
```

The server also tests a few variations (`timestamp.payload` and `payload.timestamp`) for backwards compatibility, so either format works.

### Secret

Read from `process.env.PORTAL_AGILYTICS_SECRET`.

---

## Endpoints

### `POST /api/v1/external/workspaces`

Provision a new workspace with tracks, leads, and students in one atomic call. Existing users are matched by email — new users are created automatically.

**Request Body:**

```json
{
  "name": "Bootcamp 7",
  "description": "Q3 cohort",
  "tracks": ["Web Dev", "AI/ML"],
  "leads": [
    { "email": "lead@example.com", "fullName": "Jane Doe" }
  ],
  "students": [
    { "email": "student@example.com", "fullName": "John Smith", "trackName": "Web Dev" }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Workspace name |
| `description` | string | No | Defaults to empty string |
| `tracks` | string[] | No | Deduplicated automatically |
| `leads` | object[] | No | Each needs `email` + `fullName` |
| `students` | object[] | No | Each needs `email` + `fullName`, optional `trackName` |

**Response (201):**

```json
{
  "success": true,
  "data": {
    "workspaceId": "d8c42c93-...",
    "tracksCreated": ["Web Dev", "AI/ML"],
    "summary": {
      "leadsProvisioned": 1,
      "studentsProvisioned": 1
    }
  }
}
```

- Leads get `APPROVED` status automatically.
- Students get `PENDING` status (need workspace lead approval).
- Duplicate emails across leads and students are resolved — leads take priority.

---

### `GET /api/v1/external/workspaces/[id]/onboarding-status`

Check onboarding progress for a workspace, or look up a specific student by email.

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Workspace UUID |

**Query Params (optional):**

| Param | Description |
|-------|-------------|
| `email` | Filter to a single member's status |

#### Without `email` — Full workspace analytics

**Response (200):**

```json
{
  "success": true,
  "data": {
    "workspaceId": "d8c42c93-...",
    "workspaceName": "Bootcamp 7",
    "totalMembers": 25,
    "statusBreakdown": {
      "approved": 18,
      "pending": 5,
      "left": 1,
      "rejected": 1,
      "revoked": 0
    },
    "roleBreakdown": {
      "leads": 2,
      "subLeads": 1,
      "students": 22
    },
    "trackBreakdown": [
      { "trackId": "abc-123", "trackName": "Web Dev", "memberCount": 12 }
    ],
    "leads": [
      { "id": "user-uuid", "fullName": "Jane Doe", "email": "lead@example.com", "status": "APPROVED", "joinedAt": "2026-08-01T..." }
    ]
  }
}
```

#### With `email` — Single member lookup

**Response (200):**

```json
{
  "success": true,
  "data": {
    "workspaceId": "d8c42c93-...",
    "email": "student@example.com",
    "fullName": "John Smith",
    "status": "PENDING",
    "role": "STUDENT",
    "trackName": "Web Dev",
    "joinedAt": "2026-08-01T..."
  }
}
```

Returns `404` if the email isn't found in that workspace.

---

### `POST /api/v1/external/workspaces/[id]/bulk-invite`

Generate and stage invitation tokens for all pending members in a workspace. Useful for triggering bulk email sends from an external system.

**Path Params:**

| Param | Description |
|-------|-------------|
| `id` | Workspace UUID |

**Request Body:** None needed — the endpoint finds all `PENDING` members automatically.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "workspaceId": "d8c42c93-...",
    "invitesIssued": 15,
    "expiresAt": "2026-09-12T00:00:00.000Z"
  }
}
```

- Invites expire after **7 days**.
- Any existing unrevoked invites for the same emails are revoked first (idempotent).
- Each invite includes a unique token — use the `GET /api/invites/[token]` endpoint to build accept URLs.
- Returns `invitesIssued: 0` with a friendly message if no pending members exist.

---

## Error Responses

All errors follow this shape:

```json
{
  "error": "Short error type",
  "message": "Human-readable explanation"
}
```

| Status | When |
|--------|------|
| `400` | Invalid JSON or missing required fields |
| `403` | Missing/bad HMAC signature or expired timestamp |
| `404` | Workspace or member not found |
| `500` | Server-side failure |

---

## Quick Integration Checklist

1. Store `PORTAL_AGILYTICS_SECRET` securely on your side.
2. Generate `x-portal-timestamp` as `Date.now()` (milliseconds) per request.
3. For POST: HMAC the raw JSON body. For GET: HMAC the sorted query string.
4. Pass both `x-portal-signature` and `x-portal-timestamp` as headers.
5. Handle 403s by re-syncing your clock and regenerating the signature.
