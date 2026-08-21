> **Branch:** `huzaifa` — last updated 2026-08-20

# Workflow Phases

Four gates. Each is opened and closed by an admin, each has a deadline, and no
candidate advances without an explicit admin action.

Phase state lives in `bootcamp_phases`, one row per (bootcamp, phase).

---

## Phase 1 — Registration

**Opens:** admin publishes the bootcamp.
**Closes:** registration deadline, or admin closes early.

- Candidate signs up and submits an application
- A candidate code is minted: `B07-001` (see below)
- Email is the natural key at intake; the code identifies the candidate from then on
- After close, no new applications are accepted — enforced server-side

## Phase 2 — Interview

**Opens:** admin closes registration and schedules batches.
**Closes:** interview deadline.

- Admin generates batches. The reference intake is 300 candidates split
  50 / 50 / 25 across slots at 10:00, 11:00, and 12:00.
  *Open question: are these numbers fixed, or configurable per bootcamp?*
- Candidates receive slot invitations by email (one-click batch trigger)
- The AI Interviewer scores and filters.
  *Open question: automated scoring over submitted data, or a conversational
  interview?* This determines whether transcripts need storing.
- Admin reviews results and confirms who advances

## Phase 3 — Physical assessment

**Opens:** admin advances the interview passers.
**Closes:** assessment deadline.

- Selected candidates attend in person, one-to-one with HR
- HR records pass/fail, score, and notes
- *Open question: does the system schedule these sessions, or only record the
  outcome?*

## Phase 4 — Form and onboarding

**Opens:** admin advances the assessment passers.
**Closes:** onboarding deadline.

- Passers receive a form link
- The form collects bank details (IBAN) and identity data (CNIC) — both
  sensitive, see `security.md`
- Submission feeds analytics and Agilytic onboarding
- *Open question: does Agilytic expose an API, or do we export for manual upload?*

---

## Candidate code

Format: `B07-001`

| Part | Meaning |
|------|---------|
| `B` | Prefix |
| `07` | Bootcamp number, zero-padded to 2 digits |
| `001` | Per-bootcamp sequence, zero-padded to 3 digits |

The code is minted once at application and never changes. It appears in emails,
on ID cards, and in Agilytic, so the format is effectively permanent.

Database primary keys remain UUIDs; the code is a `UNIQUE NOT NULL` business
identifier alongside them.

**Known limit:** three digits caps a bootcamp at 999 applicants. The reference
flow describes 300 interviewees, but total applications could exceed that.
Widening the field later means either reformatting historical codes or living
with two formats in circulation.

## Rules that hold across all phases

1. **Deadlines are enforced server-side.** Hiding a button is not enforcement.
   Every stage-advancing endpoint checks `bootcamp_phases` before acting. Editing
   a phase window only ever changes the fields actually sent — an admin
   updating the open date cannot accidentally clear the deadline.
2. **Transitions are logged.** `stage_transitions` records who moved a candidate,
   from which stage to which, and why. A rejection is not permanent: `POST
   /applications/{id}/reinstate` reopens one at an explicit stage.
3. **Bootcamps are isolated.** An admin never sees another bootcamp's candidates,
   regardless of holding a valid token. Covered directly by
   `tests/unit/test_bootcamp_scope.py`, not only by the routes that depend on it.
4. **Every privileged write is audited.** `audit_logs` records the actor, the
   action, and a before/after diff for every bootcamp, phase, application,
   profile, interview, and email change — an admin's own scoped history is at
   `GET /bootcamps/{id}/audit`; the platform-wide view is super-admin only.
