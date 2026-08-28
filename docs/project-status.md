> **Branch:** `waqas` — last updated 2026-08-28

# Project Status

## Where things stand — 2026-08-28 (A4 pagination, mobile, huzaifa merged)

**The onboarding forms' PDF download now matches the source PDFs' page
count exactly** — Background Verification: 1 page, Employment Application:
2 pages, Half Nama: 2 pages, each on real A4 (210x297mm). Verified with
headless Chromium + `pypdf`, not eyeballed: before the fix, every form had
no `@page` rule at all and was defaulting to US Letter with no compaction,
so a 1-page form printed as 3 and a 2-page form as 5. Fixed with an explicit
`@page` rule plus a per-form `zoom` factor tuned against the real measured
output, `break-inside: avoid` on every table row and field cell, and the
source PDFs' own page-break points confirmed by extracting the actual text
from each generated PDF page.

**All three forms are now responsive**, verified with real screenshots at
375px and 768px, not code review alone. The mobile bug was `flex-nowrap`
(added earlier specifically to stop CNIC boxes wrapping on desktop) having
no mobile fallback. The real fix — after two false starts with flex-wrap
variants that each failed in a different way — was replacing two-cell field
rows with a responsive grid and switching section/salary bars to an
unconditional stack-below-`sm:` pattern, since flex's shrink-vs-wrap
ambiguity kept resurfacing at different nesting levels. Full account in
`development-logs.md`.

**`huzaifa` merged into `waqas`**, clean fast-forward, zero conflicts. Brings
the AI Interview Invites feature: bulk-invite service with eligibility
gates, `InterviewerAI` integration, admin dialog, two new tables
(`interview_invite_batches`, `interview_invites`). Verified live and fully
correct after merging — every column, index, and RLS setting checked
directly against the migration file, not assumed from the ledger alone.

---

## Where things stand — 2026-08-28 (onboarding forms)

**The first three onboarding forms exist, admin-preview only.** Background
Verification Form (SWIT-IHR-FAF-11), Employment Application Form
(SWIT-IHR-FAF-03, 2 pages), and the Half Nama oath form (2 pages, pure
Urdu/RTL) are all digital twins of Saylani's paper forms, built pixel-first
against the source PDFs rather than a general redesign. UI-only: no
backend route, no database table, no candidate-facing URL yet — that
waits for the selection phase these forms actually belong to, which this
project hasn't built. Reachable now only at
`/admin/onboarding-preview/{background-verification,employment-application,half-nama}`,
behind the existing admin role gate.

**Shared across all three**, not rebuilt per form: a segmented digit-box
input (CNIC and date fields), a canvas-based signature pad, a localStorage
auto-save hook with a stubbed backend save function, and a form-primitives
file (`features/onboarding/form-primitives.tsx`) holding the bilingual
label, section bar, field-grid cells, Yes/No radio pairs, the bordered
text-input style, an addable-table row-helper set, and — new for the Urdu
form — an inline mid-sentence blank distinct from every boxed field on the
other two. `Download as PDF` is `window.print()` plus a print stylesheet on
every form, not a PDF-rendering library.

Two new small UI primitives (`components/ui/checkbox.tsx`,
`components/ui/radio-group.tsx`) were added on top of `@base-ui/react`,
already a dependency — no new package.

**Verified:** production build and `oxlint` clean across every file, new
and touched, project-wide. **Not verified:** no rendered screenshot exists
from this side — no browser-automation tool is available in this
environment. All three forms were reviewed directly in-browser by the
project owner against the source PDFs; the Background Verification Form's
listed fixes below came from that review.

**Background Verification Form — Round 1 fixes, all applied:** real logo
(previously a placeholder — no logo asset existed in the repo until
supplied), wider page and more internal padding, the bilingual intro note
forced onto one line, CNIC/phone fields given enough width and forced
`flex-nowrap` so digit-boxes stop dropping to a second line under their
label (this recurred in the References section too, on Imam/Other CNIC —
fixed there as well), every checkbox/radio enlarged and recoloured to
black-ink for visibility, and all four phone number fields (Mobile#,
Emergency#, both References Mobile No.) converted from plain text to the
same segmented digit-box style as CNIC.

---

## Where things stand — 2026-08-27 (Gmail token, resolved for now)

**The restart step in the entry below was the last piece.** A new refresh
token authenticating in isolation was not enough — the running backend
process had cached the old, dead one at startup (`@lru_cache` on
`get_settings()`), so it kept failing even after `.env` was updated, until
the process was restarted. After that, a real registration submitted through
the actual UI produced the confirmation email successfully.

**Sender display name fixed in the same pass.** The registration
confirmation email was showing the raw address (`thewaqasali59`) instead of
a name, while the signup email already showed "Saylani IT - A2O" via
Supabase's SMTP sender-name field. `gmail_api.py` now sets the same display
name on every email this integration sends, via `email.utils.formataddr()`
rather than a raw address string. Verified by decoding the actual MIME
message built and by a real send (`200` from `gmail.googleapis.com`) through
a real registration.

**Today's full set of fixes, verified working, dated 2026-08-27:**

| Fix | Verified |
|---|---|
| University status fields (semester, university, class timing) | Live DB write, 3-layer validation |
| CNIC/B-Form split by age for the applicant's own ID | Identity logic + CHECK constraints |
| Registration + signup email content rewritten | 20 content assertions, dashboard template applied |
| `POST /auth/resend-confirmation` | Real resend, masking verified, rate-limit passthrough verified |
| Custom SMTP (Gmail) for Supabase auth emails | Confirmed as the active sender |
| Gmail OAuth refresh token rotated | Real send through real registration endpoint |
| Sender display name ("Saylani IT - A2O") on Gmail-integration mail | Real send, header decoded and confirmed |

**Still open:** whether a token minted after Production publishing survives
past 7 days is not settled by any of the above — only time settles it. See
`development-logs.md` and the **Next** list's item on checking back
**2026-09-03**.

---

## Where things stand — 2026-08-27 (Gmail token)

**The registration confirmation email — the one carrying the candidate
code — stopped sending.** Not the DB write: the success modal and the code
were always correct, because `send_registration_confirmation()` runs as a
`BackgroundTask` after the transaction commits and is designed to never
surface a mail failure to the candidate. Traced by calling that exact
function directly: `gmail_api._get_access_token()` failed with Google's
`invalid_grant: Token has been expired or revoked.`

**Open question, not yet settled: why.** The OAuth consent screen has been in
Production since 2026-08-20 — confirmed in this file and in `security.md`,
both predating this investigation — so "still in Testing" is not the
explanation. The likely mechanism: the *specific* refresh token in use was
minted earlier the same day, while the app was still in Testing, and a
same-day Production re-test only proved it wasn't immediately revoked, not
that its expiry policy had changed. `backend/.env`'s file timestamp (Aug 20,
unchanged since) lines up with that token, and today — Aug 27 — is exactly
7 days later.

A new refresh token was generated 2026-08-27, after Production has been
active for a week, and placed in `.env`. Verified working immediately:
token exchange returned a fresh access token, and a real registration
submitted through the actual `POST /applications` endpoint produced a `200`
from `gmail.googleapis.com/.../messages/send` and `Registration confirmation
sent` in the log. **That only proves the new token works today — it does
not yet prove Production actually stops the 7-day expiry for a token issued
after the flip.** That requires waiting past 7 days without touching the
token. **Check back around 2026-09-03**: if sending is still failing then,
Production publishing is not the fix it was assumed to be and this needs a
different answer (possibly moving off personal-Gmail OAuth entirely, given
the existing plan to migrate to Resend/SendGrid).

---

## Where things stand — 2026-08-27 (auth)

**A signed-up account that never confirmed its email had no way back in.**
GoTrue correctly refuses sign-in until the address is confirmed — that has
always been true, not a regression — but nothing re-sent the confirmation
email if the first one was missed, so the account was stuck for good.
`POST /auth/resend-confirmation` now wraps GoTrue's own resend, and the login
page shows a **Resend confirmation email** button specifically when sign-in
fails with `email_not_verified`. The endpoint answers identically for a known
and an unknown address, so it cannot be used to test which addresses have
accounts.

**The signup email template is applied and verified**, not just written to a
file. The markup now lives at `supabase/templates/confirmation.html` and was
applied by hand in the Supabase dashboard (Authentication → Emails → Confirm
signup); `supabase/scripts/push_email_templates.py` exists as the
config-as-code path for the *next* change, using the Management API rather
than `supabase config push` — the latter would push `config.toml`'s implicit
defaults for anything not set, which include `enable_confirmations = false`.

Verified end-to-end against the live project: a fresh unconfirmed signup, a
real resend that bumped `confirmation_sent_at` after clearing GoTrue's
per-address cooldown, and confirmation that Custom SMTP (Gmail, configured
separately in the dashboard) is what's now sending it rather than Supabase's
low-quota built-in mailer. Both test accounts were deleted afterward. Full
detail in `development-logs.md`.

---

## Where things stand — 2026-08-27 (registration)

**The registration form asks two more things, and one old rule was wrong.**
University status (with semester, university and class timing for students)
is now collected so bootcamp sessions are not timetabled against a
candidate's classes. And the applicant's own identity number is now mandatory
at every age: an adult gives a CNIC, a minor gives the B-Form they hold
instead. Previously it was skippable under 18, which left those records with
no way to identify the person. `candidate_profiles.id_document_type` records
which document the number is, derived server-side from the date of birth.

**Both candidate emails were rewritten.** The registration confirmation
greets by full name, carries a red callout warning that a missed interview
ends the application, and lists the seven documents needed at later stages
with a separate block for under-18 applicants. It is framed as informational:
nothing is collected at that stage.

**The signup email is a Supabase template, not application code.** GoTrue
sends it, so it cannot be changed from this repository. It has since been
applied — see the entry above.

Migration `20260827054856_university_and_id_document.sql` is **applied** via
`supabase db push --linked`, which now works again since the migration ledger
was reconciled.

---

## Where things stand — 2026-08-24 (third merge)

**Login and signup were rebuilt on a split-pane layout** — form on the left,
a rotating alumni quote over an original inline-SVG illustration on the
right, both restyled from theme tokens rather than new hardcoded colours.
Google/Apple buttons show a "coming soon" toast; no OAuth is wired. The
alumni quotes reuse the copy already on the public Success Stories page but
attribute it by programme and cohort instead of by employer, since the
original data pairs invented names with real companies (Careem, Telenor,
etc.) — accurate for the quotes, not for who is saying them.

Caught two bugs building it: `bg-primary` inverts for dark mode, which is
right for a button and wrong for a full-height panel — glared badly next to
the near-black form pane, fixed with a dedicated `--auth-pane` token that
stays deep in both themes. And the auth pages were never actually
route-split despite a comment above them claiming otherwise, adding roughly
27 kB gzip to the landing page's chunk for a page most visitors never open;
`GuestRoute` was missing the `Suspense` boundary it needed. Both pages are
lazy-loaded now.

Merged cleanly with `waqas`'s next batch below — no conflicts.

**The registration flow is complete and in real use.** Three applications
exist in the live database, created through the browser, with candidate
profiles populated: `B07-004`, `B08-002`, `B08-003`. Codes mint sequentially
per intake, confirmation email is queued without blocking the response, and
the account page shows the submitted details, the profile picture, and the
candidate code.

**The registration window is now enforced in the UI as well as the API.** A
closed intake shows a compact notice instead of mounting a form with no track
to select. The header button reads **View application** for anyone who has
already applied, pointing at the tracker rather than back into a form that
would 409.

**One frontend bug class was found and swept.** A guard added for the closed
window watched the wrong loading flag and unmounted the registration form on
its own success refetch, destroying the modal that shows the candidate code.
`useMyApplication` now distinguishes `initialLoading` (first settle) from
`loading` (any fetch); mount-gates use the former. Three other components had
the same defect, including `RequiresApplication`, which would have discarded
an in-progress document upload on any refetch.

**Verified on the merged tree**, which the previous status entry listed as
outstanding: 185 backend tests pass, frontend typecheck, production build and
`oxlint` all clean.

Still outstanding before this is production-ready: the Privacy Policy and
Terms of Service dialogs carry **placeholder text**, clearly marked as such on
screen, and need real legal wording from the project owner.

---

## Where things stand — 2026-08-22 update (second merge)

**`waqas` moved 19 commits past the first merge and was merged in again.**
Registration now actually submits — `POST /applications` writes both halves
(`candidate_profiles` and `applications`) in one transaction, returns the
candidate code, and queues a confirmation email that never blocks the
response on failure. Candidates can upload a profile picture to a second
private Storage bucket (`candidate-pictures`) ahead of or during
registration, read back with a short-lived signed URL. A new `/profile`
router carries the picture endpoints; `/auth/me` now returns the candidate's
full profile instead of a placeholder.

Two conflicts were real design collisions, not just textual overlap:

- **`app/integrations/supabase_storage.py`** — both branches independently
  created a module at this exact path, one for documents, one for pictures.
  Combined into one file; the picture side's `signed_url`/`BUCKET`/
  `MAX_BYTES`/`ALLOWED_TYPES` were renamed to `picture_signed_url`/
  `PICTURE_BUCKET`/`PICTURE_MAX_BYTES`/`PICTURE_ALLOWED_TYPES` since the
  document side already held the unprefixed names and the two intentionally
  behave differently — a failed document sign is a real error (raises); a
  failed picture sign degrades to a missing avatar (returns `None`).
- **`app/schemas/user.py`** and **`frontend/src/lib/types.ts`** — both branches
  added a `CandidateProfileOut`/`CandidateProfile` type. waqas's fuller one
  (with `picture_path`, `father_cnic`, etc.) now sits on the base
  `ProfileOut`/`Profile`, so `/auth/me` returns everything. Huzaifa's narrower
  admin-directory one (just `cnic`/`date_of_birth`/`city`/`education`) was
  renamed to `CandidateProfileSummary` on both sides so the two do not
  collide. On the frontend this also required switching `UserDetail` from
  `extends Profile` to `Omit<Profile, 'candidate_profile'> & {...}` —
  TypeScript does not allow a subtype to narrow an inherited property, which
  the old code was unknowingly relying on being absent.

Verified after resolving: 185/185 backend tests, clean production build, 0
lint errors, server boots against the live database with `/profile/picture`
registered.

**`waqas` is merged into `huzaifa`.** The admin/super-admin build and the
candidate-portal build happened in parallel on separate branches and are now
one tree: the whole portal — marketing site, auth, candidate portal, admin
portal, super-admin portal — runs on real data. `lib/mock-data.ts` is deleted.

**The candidate registration form now persists.** `applications` gained
`is_selected` plus nine registration-detail columns (course history, laptop
ownership, campus, declarations); `candidate_profiles` gained nine more
(father's name/CNIC, gender, phone, address, Saylani roll number). Two stage
values were renamed for clarity: `ASSESSMENT` → `PHYSICAL_INTERVIEW`,
`FORM_PENDING` → `FORM`. Both migrations were already applied directly against
the live database; only the migration ledger was missing the two entries,
which is now corrected — see *Resolved* below.

**Candidate document uploads are built and verified** — a private Supabase
Storage bucket, indexed by a new `documents` table, with admin review.

**Two real auth bugs were found by end-to-end testing** and fixed:

1. **Clock skew caused spurious 401s immediately after login.** GoTrue stamps
   `iat` from Supabase's clock, which runs ahead of ours, so a freshly issued
   token was "not yet valid" for its first seconds. Fixed with 60s of leeway.
2. **A JWKS outage was reported as a bad token** (401 instead of 502) — the
   split `security.md` already described was not actually implemented.

**A Base UI menu crash was taking down every portal page.**
`DropdownMenuLabel` was rendered outside a `DropdownMenuGroup` in three
places, including the account menu in `portal-layout.tsx`. Fixed by wrapping
each in a real group, and a route `errorElement` now contains any future
error of that class.

Still open: the Gmail OAuth Production flip and the Resend/SendGrid migration.

---

## Where things stand — the merge in detail

**Phase 1 is complete and verified against the live Supabase project.** The
database schema is applied, and the full authentication round trip works:
signup provisioning, login, `/auth/me`, token refresh, and logout.

**Phase 2 registration is built and verified end to end**: a super admin can
create an intake, assign an admin, open and close registration against a
deadline, and candidates can apply and receive a candidate code. Candidates
can now also complete the full registration form — course history, laptop
ownership, declarations — and it persists to `applications` and
`candidate_profiles`.

**The admin portal is built and wired to the real API.** All five admin
screens (Dashboard, Candidates, Interviews, Phases, Emails) and all four
super-admin screens (Dashboard, Bootcamps, Administrators, Analytics) run on
live data against your Supabase project, not fixtures. A working
`SUPER_ADMIN` account exists (`admin@sita2o.com`) with a real bootcamp (07) to
exercise the flow.

**Both email systems are live and verified with real sends:** Supabase SMTP
for auth emails, and a Gmail API integration for the backend's own emails
(interview invites, results, onboarding links), wired into the admin Emails
screen with per-recipient delivery logging.

**The candidate portal is fully wired to real data.** Overview, registration
form, application tracker, own-interview view, and documents all call the
live API. The journey stepper shows five visible steps
(Application → Interview → Physical Interview → Form → Onboarded) over the
seven stages actually stored, since `INTERVIEW_SCHEDULED` and `INTERVIEWED`
collapse into one visible node — the distinction only matters to admin
batching. Application-scoped pages (`/dashboard/application`,
`/dashboard/interview`, `/dashboard/documents`) stay locked behind
`RequiresApplication` until a candidate has actually registered.

---

## Known issue from the merge — two enum sources of truth

`frontend/src/lib/types.ts` (admin/super-admin side) and
`frontend/src/lib/stages.ts` (candidate side) each declare their own
`ApplicationStage` and `STAGE_LABEL`, built independently on the two branches
before they diverged. The merge already caused one real drift — `types.ts`
still had the pre-rename `ASSESSMENT`/`FORM_PENDING` values after `stages.ts`
and the backend had moved to `PHYSICAL_INTERVIEW`/`FORM`, which would have
shown blank stage badges on every admin candidate list. Fixed as part of the
merge, but the underlying duplication remains: the two files must be kept in
sync by hand until one imports from the other. Recommend unifying them onto
`lib/stages.ts` next, since it is the one with journey-stepper semantics
(`STEP_INDEX`, `completedSteps`) the candidate portal depends on.

---

## Done

### Backend

| Item | Notes |
|------|-------|
| Layered FastAPI structure | `routes → services → models`, versioned at `/api/v1` |
| Settings with fail-fast validation | Missing env vars stop boot, not first request |
| Supabase token verification | ES256 via JWKS **and** HS256 via shared secret |
| GoTrue integration | signup, login, refresh, logout, with error-code mapping |
| GoTrue admin API | create/update/delete auth users directly — powers staff provisioning |
| Role gates | `require_roles`, `require_admin`, `require_super_admin` |
| Error hierarchy + 3 handlers | Single response envelope everywhere |
| Lazy database engine | App boots and serves `/health` without `DATABASE_URL` |
| Gmail API email integration | Real send verified, message id returned, now logged per recipient |
| Phase 2 registration pipeline | Bootcamps, phases, programs, applications |
| **Admin portal surface** | Users, interviews, email log, audit trail, dashboard stats |
| **Candidate registration** | Full form persisted across `applications` + `candidate_profiles` |
| Deadline enforcement | Service-layer; flag **and** clock, so an expired deadline closes a phase |
| Bootcamp scope enforcement | `assert_can_manage()` — an admin cannot reach another intake's candidates. **Unit-tested**, not just documented |
| Atomic candidate codes | SQL `mint_candidate_code()`; verified race-safe under 24 concurrent mints |
| Audit trail | Every privileged write (`bootcamp.*`, `phase.*`, `application.*`, `profile.*`, `interview.*`, `email.*`) logged with actor, before/after diff, and a summary |
| Editable package install | `pip install -e .` registers `app`, so `uvicorn app.main:app` resolves from any directory |

**59+ endpoints live**, across 9 route modules: `health`, `auth`, `programs`,
`bootcamps`, `applications`, `interviews`, `emails`, `users`, `audit`. Full
list via `/docs` (disabled in production) or `/openapi.json`.

Highlights beyond Phase 2:

```
# users — reads open to any admin, writes super-admin only
GET/POST   /api/v1/users                          # directory / provision staff
GET/PATCH  /api/v1/users/{id}                      # detail / edit profile
POST       /api/v1/users/{id}/role|active|password
DELETE     /api/v1/users/{id}
GET        /api/v1/users/{id}/audit

# interviews — scoped through the application's bootcamp
GET/POST   /api/v1/bootcamps/{id}/interviews[/batch]
PATCH/DELETE /api/v1/interviews/{id}
POST       /api/v1/interviews/{id}/cancel
GET        /api/v1/me/interviews                  # candidate's own schedule

# email — addressed by application id, never a raw address
GET        /api/v1/bootcamps/{id}/emails
POST       /api/v1/bootcamps/{id}/emails/send|broadcast

# oversight
GET        /api/v1/audit                          # platform-wide, super-admin
GET        /api/v1/stats                           # cross-intake totals
GET        /api/v1/bootcamps/{id}/stats|audit      # per-intake

# reference data, now fully editable
POST/PATCH/DELETE /api/v1/programs[/{id}]
GET        /api/v1/programs/manage                 # incl. inactive, with usage counts

# bootcamps — extended
DELETE     /api/v1/bootcamps/{id}                  # refused once anyone applied
GET/POST/DELETE /api/v1/bootcamps/{id}/admins[/{profile_id}]

# applications — extended
PATCH/DELETE /api/v1/applications/{id}
POST       /api/v1/applications/{id}/reinstate      # undo a rejection
GET        /api/v1/applications/{id}/admin          # full record incl. contact info
```

### Bugs found and fixed during the admin-portal build

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | `PATCH` on a phase window assigned both `opens_at` and `deadline_at` unconditionally — editing only the open date silently wiped the deadline, leaving registration open indefinitely | High | `exclude_unset=True`; 6 tests pin omitted-vs-explicit-null semantics. Verified against the live DB: a deadline survives a partial PATCH |
| 2 | Two simultaneous duplicate-application submissions could both pass the pre-check and hit the DB's unique constraint, surfacing as a raw `500` | Medium | Catch the `IntegrityError` by constraint name, translate to `409` |
| 3 | A `REJECTED` application had no path back — permanently locked, and the error returned (`403`) didn't match the equivalent "already at this stage" case (`409`) | Medium | Added `POST /applications/{id}/reinstate`; corrected the status code |

### Database — applied

**All six migrations applied**, recorded in `supabase_migrations.schema_migrations`:

1. `20260819120000_init_auth_profiles.sql` — `profiles`, `candidate_profiles`,
   `user_role` enum, provisioning trigger, RLS.
2. `20260820120000_phase2_registration.sql` — `programs`, `bootcamps`,
   `bootcamp_programs`, `bootcamp_admins`, `bootcamp_phases`, `applications`,
   `stage_transitions`, four enums, `mint_candidate_code()`. RLS enabled
   deny-by-default; 5 programs seeded.
3. `20260820140000_admin_portal.sql` — `interviews`, `email_log`,
   `audit_logs`, three enums (`interview_mode`, `interview_status`,
   `email_status`). RLS deny-by-default; `email_log` and `audit_logs` carry
   no policies at all — staff-only, readable exclusively through the API.
4. `20260820160000_candidate_documents.sql` — `documents` table, two enums
   (`document_type`, `document_status`).
5. `20260820180000_candidate_journey.sql` — renames `ASSESSMENT` →
   `PHYSICAL_INTERVIEW` and `FORM_PENDING` → `FORM` on `application_stage`;
   adds `applications.is_selected`.
6. `20260822055446_registration_details.sql` — nine registration columns on
   `candidate_profiles`, nine on `applications` (course, laptop, campus,
   declarations).

### Frontend

| Item | Notes |
|------|-------|
| Vite 8 + React 19 + TypeScript | `strict` and `noUncheckedIndexedAccess` on |
| Tailwind v4 + shadcn/ui | Full light/dark token ramps, green primary |
| Auth pages | Signup (live password checklist, confirm password, role selector), Login (show/hide password) |
| Auth validation | Single source of truth in `features/auth/password-rules.ts` — drives both zod schema and UI checklist |
| Marketing site | Home, Programs, Program detail, Admissions, About, Success Stories, FAQ, Contact |
| **Admin portal — wired to the real API** | Dashboard, Candidates, Interviews, Phases, Emails |
| **Super-admin portal — wired to the real API** | Dashboard, Bootcamps, Administrators, Analytics, Programs |
| **Candidate portal — wired to the real API** | Overview, Track application, Registration form, Application, Interview, Documents |
| `features/admin/api.ts` | Typed wrapper over the admin/super-admin endpoints |
| `features/admin/bootcamp-context.tsx` | The selected intake, shared across all 5 admin screens, persisted in `localStorage` |
| `features/applications/application-context.tsx` | The candidate's own application state, shared across the candidate portal |
| `hooks/use-async.ts` | Minimal fetch/mutation hook (no react-query dependency added) |
| Batch interview scheduling | Spaces slots evenly from a start time, all-or-nothing, advances stage automatically |
| Email compose | 4 starting templates, `$candidate_name`-style merge fields, broadcast by stage filter |
| Candidate detail sheet | Stage moves, reinstate, interview history, full timeline, contact info |
| Phase controls | Open/close, date windows, warns when a flag is on but the deadline has passed |
| **Registration form** | 4 sections, progressive field unlocking, page-fold transition, 19 IT courses, bootcamp-specific declarations — persists to the API |
| **Journey stepper** | One component, two modes: `demo` plays once per mount, `real` reflects actual stage |
| **User vs Candidate gating** | `ApplicationProvider` holds one answer portal-wide; `RequiresApplication` guards the routes that describe a submitted application |
| Charts | Recharts, lazily loaded per-dashboard, theme-aware |
| Motion primitives | Reveal, Stagger, Counter, Marquee, PageTransition, Typewriter, Countdown |
| Code splitting | Admin/super-admin charts split from the candidate bundle |
| Production build | Clean — see *Verification pending* below |

### Admin account

| | |
|---|---|
| Email | `admin@sita2o.com` |
| Role | `SUPER_ADMIN` |
| Provisioned via | `backend/scripts/create_super_admin.py` — reusable, idempotent, reads credentials from env vars only |

Every further staff account should go through `POST /api/v1/users`
(`create_staff`) instead, so it lands in the audit trail with a named actor.
The bootstrap script exists only because the very first super admin has
nobody to authorise them.

### Verified end to end, not assumed

Beyond the Phase 1 table (still holds): a live `TestClient` smoke run against
the real database confirmed login → `SUPER_ADMIN` role, global reads,
Bootcamp 07 creation with all 5 tracks, the partial-PATCH deadline fix,
registration open/close, per-bootcamp stats/interviews/emails/audit reads,
and every self-demotion/self-deactivation guardrail returning `409`. Every
response shape was diffed field-for-field against the frontend TypeScript
types — zero mismatches across 7 representative endpoints. Also: 31/31 on the
create-intake → deadlines → create-admin → assign → scope flow, and 16/16 on
the document upload/review pipeline.

**Not yet re-run after the merge** — backend test count, frontend build, and
lint need a fresh pass now that both branches' code shares one tree. See
*Verification pending*.

---

## Blocked

Nothing blocks development. The candidate-journey migration that previously
blocked `/applications/mine` was, in fact, already applied directly against
the live database — only its ledger entry was missing, which is now fixed
(see *Resolved* below). No further database action is required.

### Resolved — migration ledger corrected

`20260820180000_candidate_journey.sql` and
`20260822055446_registration_details.sql` had both been run against the live
Supabase project, but neither was recorded in
`supabase_migrations.schema_migrations`. Confirmed by inspecting the live
schema directly: `application_stage` already carries `PHYSICAL_INTERVIEW` and
`FORM`, `applications.is_selected` exists, and both new column sets are
present. Added the two missing ledger rows so the record matches reality —
no schema change was made, only the bookkeeping.

### Resolved — Gmail OAuth consent screen published

The consent screen was moved from Testing to **Production** on 2026-08-20,
which removes the 7-day refresh token expiry that applies to unverified apps.
Publishing does not revoke existing tokens: the token issued during Testing was
re-tested after publishing and sent successfully, so no re-authorisation was
needed.

Google verification is still not required, because the app has a single
authorised user and requests only the `gmail.send` scope.

**Known limitation, not yet a blocker:** personal Gmail caps at 500 emails/day
and is not built for bulk/automated sending — a real risk of throttling once
batch interview invites (125+ emails in one click) run at actual bootcamp
volume. **Must move to Resend or SendGrid before the first real intake goes
live.**

---

## Awaiting decisions

Choices made provisionally, each reversible, flagged for confirmation:

| # | Decision | Taken | Reversal cost |
|---|----------|-------|---------------|
| 1 | Role source | `profiles` lookup per request | Low |
| 2 | RLS | Deny-by-default, select-own (or none, for staff-only tables) | Low — one migration |
| 3 | Provisioning trigger | Auto-create profile, role `CANDIDATE` | Low |
| 4 | Auth traffic | Through FastAPI, not browser-to-GoTrue | Medium |
| 5 | Token storage | `localStorage` | Medium — one file, plus backend cookie work |
| 6 | Primary colour | Green, matching Saylani | Trivial — two CSS variables |
| 7 | `ADMIN` stays bootcamp-scoped | `SUPER_ADMIN` is the only global role; requested by project owner over making `ADMIN` itself global, to keep multi-admin isolation viable | Medium — touches `assert_can_manage` and its tests |
| 8 | ~~Register button after registering~~ | **Decided 2026-08-24** — relabels to *View application*, pointing at the tracker | Done |

Item 8 is settled and built. The button is not hidden when an application
exists: applications are unique per `(bootcamp, profile)`, so a candidate may
legitimately apply to a second concurrent intake, and a vanished button would
block that. It relabels instead, and `/dashboard/register` is guarded
separately because the URL stays typeable.

Unanswered questions carried forward:

- Who provisions the *next* super admin after this one, day to day? (`POST
  /users` now exists and works — this is a process question, not a technical one)
- What is the AI Interviewer — automated scoring, or a real conversation?
- Is the 300 → 50/50/25 batch split fixed or per-bootcamp configurable? (The
  batch scheduler supports arbitrary sizes today; nothing hardcodes 50/50/25)
- Does the system schedule physical assessments, or only record outcomes?
- Exact onboarding form fields beyond IBAN and CNIC?
- Agilytic: API integration or manual export?
- Deployment target?

---

## Next

1. **Supply the real Privacy Policy and Terms of Service text** — the
   dialogs shown at registration are placeholders and say so; this is the one
   item that blocks a public launch rather than merely improving it
2. **Unify the two `ApplicationStage` sources** — `lib/types.ts` and
   `lib/stages.ts` — onto one definition; see *Known issue* above
3. **Check back around 2026-09-03** on whether the Gmail refresh token
   generated 2026-08-27 has survived past 7 days — see today's entry above.
   If it has, the open question is settled and this item can go. If it has
   not, Production publishing does not actually prevent the 7-day expiry for
   this app and a different fix is needed
4. Seed real bootcamp admins so per-bootcamp scoping can be exercised through
   the UI, not just the API
5. **Approve the registration field list against Agilytic's requirements**,
   if not already done — the form is live and storing data now, so a field
   change is a migration, not a design tweak
6. Build the Application summary view + Print/PDF for a submitted registration
7. Add CAPTCHA to the registration form (deliberately omitted so far, no stub)
8. Phase 3: interview batching is built (arbitrary slot counts, evenly
   spaced); the AI screening hook is still blocked on deciding what the AI
   Interviewer actually is
9. **Decide how a thumbprint is captured digitally** — the Half Nama form's
   two thumbprint areas are reserved layout space only, deliberately
   non-functional, pending this decision
10. Wire the three onboarding forms to a real backend once the selection
    phase exists: a draft-persistence endpoint (`saveDraft()` is already
    stubbed for this), a submission endpoint, and the eventual
    candidate-facing route — none of which exist yet, by design, since
    admin-preview was the explicit scope so far

## Running it

```bash
# backend
cd backend
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload   # http://localhost:8000
./.venv/Scripts/python.exe -m pytest -q

# frontend
cd frontend
npm run dev                                                    # http://localhost:5173
npm run build

# provision another super admin (bootstrap only — prefer POST /api/v1/users after the first)
cd backend
SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... ./.venv/Scripts/python.exe scripts/create_super_admin.py
```
