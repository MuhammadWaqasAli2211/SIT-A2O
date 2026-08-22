> **Branch:** `huzaifa` — last updated 2026-08-22

# Workflow Phases

Four gates. Each is opened and closed by an admin, each has a deadline, and no
candidate advances without an explicit admin action.

Phase state lives in `bootcamp_phases`, one row per (bootcamp, phase).

---

## Two different things called "stages"

Phases are admin gates. The candidate journey is what a candidate sees. They
are related but not the same count, and conflating them causes confusion:

| Candidate step (5) | Stored stage(s) | Phase gate |
|---|---|---|
| Application | `APPLIED` | `REGISTRATION` |
| Interview | `INTERVIEW_SCHEDULED`, `INTERVIEWED` | `INTERVIEW` |
| Physical Interview | `PHYSICAL_INTERVIEW` | *(none — see below)* |
| Form | `FORM` | `FORM` |
| Onboarded | `ONBOARDED` | `ONBOARDING` |

Three consequences worth holding on to:

**The Interview step spans two stored stages.** A candidate is told one thing —
"Interview" — while admins keep the difference between holding a slot and
having been seen. Batching is impossible without it: the 300 → 50/50/25 split
is a question about who is scheduled, not who is finished.

**Selection is not a step.** Clearing the interview is the *condition* for
reaching Physical Interview. Failing it ends the journey at Interview, as
`REJECTED`. The decision is recorded on `applications.is_selected` —
`NULL` while undecided, so an un-interviewed candidate never reads as rejected.

**Physical Interview has no phase gate of its own.** `phase_type` has four
values and this is not one of them; the step sits between the `INTERVIEW` and
`FORM` windows. *Open question: should it get its own gate and deadline, or
stay governed by the surrounding two?*

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
- Stage moves `APPLIED` → `INTERVIEW_SCHEDULED` → `INTERVIEWED`. Both render as
  the single "Interview" node on the candidate's stepper
- The AI Interviewer scores and filters.
  *Open question: automated scoring over submitted data, or a conversational
  interview?* This determines whether transcripts need storing.
- Admin reviews results and confirms who advances. Advancing sets
  `is_selected = true`; rejecting from either interview stage sets it `false`

## Phase 3 — Physical interview

**Opens:** admin advances the interview passers.
**Closes:** governed by the surrounding windows — this step has no
`phase_type` value of its own.

- Selected candidates attend in person, one-to-one with HR
- Non-technical: a conversation, not a test. Named `PHYSICAL_INTERVIEW` rather
  than the earlier `ASSESSMENT` for exactly that reason
- HR records pass/fail and notes
- *Open question: does the system schedule these sessions, or only record the
  outcome?*

## Phase 4 — Form and onboarding

**Opens:** admin advances the physical-interview passers.
**Closes:** onboarding deadline.

- Passers receive a form link; stage moves to `FORM`
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
   from which stage to which, and why. Its `created_at` is the only source of
   per-step timestamps — there are no dated columns on `applications`, so the
   log is not optional bookkeeping. A rejection is not permanent: `POST
   /applications/{id}/reinstate` reopens one at an explicit stage.
3. **Bootcamps are isolated.** An admin never sees another bootcamp's candidates,
   regardless of holding a valid token. Covered directly by
   `tests/unit/test_bootcamp_scope.py`, not only by the routes that depend on it.
4. **Every privileged write is audited.** `audit_logs` records the actor, the
   action, and a before/after diff for every bootcamp, phase, application,
   profile, interview, and email change — an admin's own scoped history is at
   `GET /bootcamps/{id}/audit`; the platform-wide view is super-admin only.
