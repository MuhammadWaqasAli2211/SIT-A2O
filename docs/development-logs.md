> **Branch:** `waqas` — last updated 2026-08-31

# Development Logs

Chronological record of what was built, when, and why. Newest first.

---

## 2026-08-31 — Student's Folder: onboarding forms + Documents Hub go live

**Branch:** `waqas`

Turned the 3 admin-preview-only form replicas into a real candidate flow,
added a 4th (Bank & Payment Details, a plain web form, not a PDF replica),
built the age-reactive 7-tab Documents Hub, and the full admin review side —
bootcamp-scoped candidate folders, per-document approve/reject with a
required rejection reason, and "reopen for correction" on a submitted form.

### Schema, proposed and approved before writing a line of backend code

Two new tables (`onboarding_form_submissions`, `onboarding_documents`), not
folded into the existing `documents` table: Educational Documents and
Experience Letters need to hold several files at once, which that table's
one-row-per-type replace semantics doesn't support. Storage reuses the
existing `candidate-documents` bucket under a new `onboarding/` prefix
rather than a new bucket — no new credential surface.

Two decisions made explicit and agreed before implementation: onboarding
forms are viewable, not approve/reject (there's nothing on a candidate's own
filled paperwork for an admin to accept or reject the way a blurry CNIC scan
can be), and the "download PDF" stays the same client-side `window.print()`
approach already verified for A4 fidelity rather than adding a server-side
headless-browser dependency to produce a stored file — the submitted JSONB
is the source of truth, the PDF is always regenerated fresh from it.

### The sequential-lock / reopen mechanism

The 4-form order is enforced both ways: `assert_in_order` blocks a
later-form submit until every predecessor is `SUBMITTED`, and
`unlocked_map`/`hub_unlocked` derive what the candidate can currently reach
from that same predecessor check — nothing stored beyond each row's own
`status`. The interesting part is that a `REOPENED` predecessor is treated
identically to "not submitted yet" by both functions, which is the entire
mechanism behind "reopening one form re-locks everything after it, and the
Documents Hub too" — no extra bookkeeping needed once the order check
already existed for the forward direction.

### Old checklist removed, not left dangling

Mid-build, realised the candidate sidebar slot being repurposed
("Documents" → "Student's Folder") already pointed at a working, different,
narrower document checklist (CNIC front/back, Photo, Qualification, Bank
Letter) with its own admin review page. Asked before touching it. Confirmed
zero rows existed in `documents` live, grepped the whole codebase for every
dependent, then removed: the table, `document_type` enum, `document_service.py`,
both pages, both routes, and the now-stale integration tests — rewriting
them to hit the new onboarding routes instead of deleting coverage.
`document_status` (PENDING/ACCEPTED/REJECTED) survived — the new
`onboarding_documents` table reuses it.

### Shared age logic, finally actually shared

`isEighteenOrOlder`/`isAdult` had been deliberately duplicated three times
already (registration's schema layer, registration's field-unlock layer, and
now this) for layering reasons. Extracted to `frontend/src/lib/age.ts` and
`backend/app/core/age.py` — both leaf modules with no dependents of their
own, which is what made importing them from every layer safe where importing
across those layers directly was not.

### Verification, and a real bug it surfaced

Backend: 305/305 tests pass (45 new — order enforcement, reopen/re-lock,
age-conditional validation, multi-file vs. supersede). Frontend: build and
`oxlint` clean. Two migrations applied and confirmed live via direct schema
queries, not just the ledger.

Full browser click-through as a real candidate wasn't possible: the live
database has exactly one real application row, and reading it 500s. Traced
to a schema drift unrelated to this work — the live `application_stage`
enum has `AI-INTERVIEWED` where every migration file and both codebases say
`INTERVIEWED`, changed directly against the database outside the migration
system at some point. Reported before doing anything about it; told to
leave it and verify a different way. Did two things instead: a real-DB,
real-Storage integration pass using a temporary, additive-only application
for the real account (never touching the broken row), exercising every
service function for real — 18/18 checks, everything cleaned up after,
storage objects included; and a real-HTTP pass via `TestClient` with only
the token-verification step bypassed (no password available), confirming
`GET /bootcamps/{id}/onboarding/candidates` returns a correct, empty list
for both bootcamps without ever touching the broken row, and confirming by
direct traceback that the 500 lives in pre-existing `application_service.my_applications`,
not anything from this round.

---

## 2026-08-28 — A4 pagination fixed and measured, not guessed; mobile layout fixed; huzaifa merged

**Branch:** `waqas`

### The PDF page count bug, and how it was actually found

Reported: a 2-page form was downloading as 3. Reproduced with real tooling
before touching any code — headless Edge (`--print-to-pdf`) plus `pypdf` to
count and measure the actual output, not a guess:

| Form | Page size before | Pages before | Pages after |
|---|---|---|---|
| Background Verification | US Letter (612x792pt) | 3 | **1** |
| Employment Application | US Letter | 5 | **2** |
| Half Nama | US Letter | 3 | **2** |

Worse than reported on every form, and for a reason the bug report didn't
name: no `@page` CSS rule existed anywhere in the codebase, so every
`window.print()` fell back to the browser's own default page size — not A4 —
and content laid out for a ~1152px desktop canvas had no compaction for a
physical page at all.

Fixed with `@page { size: A4; margin: 10mm }` (once, global) plus a `zoom`
factor on each form's print wrapper, tuned per form and verified against
real measured page counts until each hit its target exactly. `zoom` rather
than `transform: scale()`: transform does not affect the layout box
Chromium's print engine paginates against, so it looks right on screen and
still overflows when printed. `break-inside: avoid` was added to every table
row and field cell via `data-slot` markers on the shared primitives, so nothing
gets sliced across a page boundary.

**Verified, not assumed:** extracted the actual text from each generated PDF
page. Employment Application's page 1 ends exactly at the Professional
Courses table; page 2 opens exactly with "EMPLOYMENT HISTORY" — the source
PDF's own split point, confirmed in the real output, not inferred from the
DOM structure alone.

### The mobile bug, and three iterations to find the real fix

`flex-nowrap`, added during the Background Verification Form's earlier
review round specifically to stop CNIC boxes wrapping on desktop, had no
mobile fallback — on a 375px screen it did exactly what it says, so CNIC
boxes and sibling fields ran off the edge of the viewport with no way to
see the rest.

The fix took three real iterations, verified against actual screenshots
each time rather than reasoned about in the abstract:

1. `flex-wrap sm:flex-nowrap` — fixed the field that was overflowing, but
   its sibling cell in the same row started getting cut instead of dropping
   to its own line.
2. Adding `min-w-0` — made it worse in a different way: flex items could now
   shrink indefinitely instead of wrapping, so the row never wrapped at all;
   it just squeezed both cells until the (unshrinkable) segmented digit-boxes
   overflowed their own now-too-narrow container.
3. The actual fix: two-cell field rows switched from flex to
   `grid grid-cols-1 sm:grid-cols-2` (or `[2fr_1fr]` where CNIC needs more
   room), which has none of flex's shrink-vs-wrap ambiguity. Section bars
   and salary-bar headers switched from "wrap if it doesn't fit" to an
   unconditional stack-on-mobile / row-from-`sm:` pattern, since the
   combined English+Urdu title was borderline-width and flex-wrap wasn't
   reliably triggering for it either. Every `<table>` wrapped in
   `overflow-x-auto`, so tables that genuinely can't be stacked (Employment
   History's nested Period/From/To header) scroll horizontally instead of
   overflowing the page.

Verified at 375px (mobile) and 768px (tablet) via real screenshots, not
just code review, for all three forms.

### huzaifa merged into waqas

`origin/huzaifa` merged in clean, fast-forward, zero conflicts — its history
already contained `waqas`'s via two prior merges on huzaifa's side. Brings
in the AI Interview Invites feature (bulk-invite service with eligibility
gates, `InterviewerAI` integration, admin dialog, `interview_invite_batches`
/`interview_invites` tables). Verified post-merge: 202 backend tests pass,
frontend build and `oxlint` clean, new routes reachable.

One false alarm worth recording plainly: initially reported the migration's
tables as missing from the live database. That was checking the wrong table
names (`invite_batches`/`invites` instead of the migration's actual
`interview_invite_batches`/`interview_invites`) — re-checked with the
correct names and every column, index, and RLS setting matches the
migration exactly. Nothing was wrong with the database; the mistake was
mine, corrected before anything was changed.

### Verified

- Backend: 202 tests pass
- Frontend: production build and `oxlint` clean, project-wide
- PDF page counts re-verified after every responsiveness change — held at
  1/2/2 throughout, no regression
- Migration `20260827120000_interview_invites.sql` confirmed fully and
  correctly applied: both tables, both enum types, both indexes, the unique
  constraint, and RLS all present exactly as written

---

## 2026-08-28 — Three onboarding forms, admin preview only

**Branch:** `waqas`

Built ahead of the phase that uses them: candidates reach these only after
selection, a stage this project hasn't built yet. Everything here is
UI-only — no backend route, no database table, no candidate-facing URL.
Each form lives behind the existing admin role gate at
`/admin/onboarding-preview/<form>`, purely so the layout can be reviewed
against the source PDF before any of it is wired to real data.

### Shared infrastructure, built once and reused three times

`frontend/src/features/onboarding/form-primitives.tsx` carries everything
common to a "digital twin of a Saylani paper form": `BilingualLabel`,
`SectionBar` (the heavy black section bar), `FieldCell`/`FieldRow`,
`YesNoGroup`, the bordered `TEXT_INPUT_CLASS` family, `OnboardingToolbar`
(the auto-save indicator, Clear, and Download-as-PDF button), row-array
helpers for addable tables, and `InlineBlank` for a fillable word embedded
mid-sentence rather than pulled into a labelled field.

Also shared: `segmented-digit-input.tsx` (one box per digit, for CNIC and
date fields), `signature-pad.tsx` (a hand-drawn canvas signature, no
library), and `use-draft-autosave.ts` (localStorage autosave with a
debounced write, restore-on-mount, and a stubbed `saveDraft()` for a future
backend endpoint).

Two new UI primitives needed adding for these forms specifically:
`components/ui/checkbox.tsx` and `components/ui/radio-group.tsx`, thin
Tailwind wrappers over `@base-ui/react` (already a project dependency, so
no new package) following the same pattern `select.tsx` already used.
Their checked-state colour is scoped to onboarding usage only — brand green
stays the default for anything else that adopts them later.

`Download as PDF` is `window.print()` with a print stylesheet, not a
rendering library: the on-screen form already is the pixel-perfect replica,
so printing it (with the admin sidebar/header/toolbar hidden via
`print:hidden`, added to `portal-layout.tsx`) produces a PDF that matches
the screen by construction rather than a second layout to keep in sync.

Row state for the addable tables (Professional Courses, Employment History,
Family Details) went through one design correction before shipping: an
earlier `useTableRows` hook kept its own `useState`, which would have put
every added row outside the one object `useDraftAutosave` watches — rows
would have vanished on reload, defeating the feature. Replaced with plain
array functions (`addTableRow`/`removeTableRow`/`updateTableRow`) that
compose with the form's own state instead.

### Background Verification Form (SWIT-IHR-FAF-11)

Built first, then revised after a side-by-side comparison against the PDF
surfaced seven fidelity issues in one pass: a missing logo asset, cramped
padding, an intro line that wrapped instead of staying on one line, CNIC
digit-boxes wrapping onto a second line for lack of width, checkboxes too
small and too low-contrast to read at a glance, and phone number fields
that were plain text instead of segmented like the CNIC fields. All seven
fixed; the checked-state colour was deliberately made black-ink rather than
brand green here, matching a printed form rather than the app's usual
chrome.

### Employment Application Form (SWIT-IHR-FAF-03), 2 pages

Second form, reusing everything above rather than rebuilding it. Three
places where the source disagreed with the brief describing it, caught by
reading the PDF directly rather than the brief: Chronic Disease is a plain
blank here, not a Yes/No pair like the first form; Passport # is
alphanumeric and was kept as free text rather than forced into the
digit-only segmented input; and Question 3 in the declarations ("What do
you know about Saylani?") carries a Yes/No column in the source despite
reading as open-ended — replicated as printed rather than corrected.

### Half Nama / Oath Form (pure Urdu, RTL), 2 pages

Third form, and structurally different from the first two: almost entirely
flowing prose with inline blanks rather than a field grid, so
`BilingualLabel`/`FieldRow`/`SectionBar` see little use here — `InlineBlank`
was added specifically for this shape. Native `dir="rtl"` handles direction,
the bidi algorithm, and RTL table-column mirroring without any new library.

This PDF's Urdu text layer extracts cleanly, unlike the first two forms', so
the oath paragraph and the 10-row policy table are transcribed directly from
the source rather than reconstructed from standard vocabulary. Two
discrepancies from the brief, caught by reading the actual sentence
structure: page 1's second inline blank is the father's name ("بن" — "son
of"), not an organisation code as the brief assumed; and page 2's opening
sentence has five inline blanks, not three, since Department and
Designation are named separately. Page 2 also has no Date field, matching
the source exactly rather than assuming symmetry with page 1.

The two thumbprint areas on page 2 are reserved, correctly proportioned
layout space only — no input, no state, no click handler — pending a
decision from Saylani's side on how a thumbprint should be captured
digitally.

### Verified

- Frontend production build and `oxlint` clean across every new and touched
  file, 0 errors
- Full sweep of the whole project's `oxlint` output confirms nothing new
  outside the touched files

**Not verified:** an actual rendered screenshot or print preview of any of
the three forms — no browser-automation tool is available in this
environment, and reaching the admin-gated routes would have required
fabricating an admin session, which is outside what this task asked for.
All three were instead reviewed by the project owner directly in a browser
against the source PDFs, and the Background Verification Form's Round 1
fixes above came directly from that review.

---

## 2026-08-27 — Cached settings outlived the fix, and a raw address as sender

**Branch:** `waqas`

### The token worked in isolation and still failed for real

The rotated Gmail refresh token (previous entry) passed an isolated exchange
test, and a registration submitted through this session's own test server
sent successfully. A real registration through the actual running dev server
still produced no email, with no error visible to the candidate — the same
symptom as the original bug, from a completely different cause.

Traced to `@lru_cache` on `get_settings()` in `app/core/config.py`: the
`Settings` object — including `GMAIL_REFRESH_TOKEN` — is read from `.env`
once, on a process's first call, and reused for that process's entire
lifetime. `.env`'s timestamp (12:59) postdated every backend process still
running (all started 12:32 or earlier), confirmed via `Get-Process` start
times cross-checked against `netstat`. No code watches `.env` for changes;
only editing a `.py` file triggers `--reload`. The fix was a process
restart, not a code change — flagging this here because it will recur for
any future `.env`-only edit made while the server keeps running.

### The sender showed a raw address, not a name

Registration confirmation mail displayed `thewaqasali59` as the sender,
while the signup email (Supabase SMTP, a separate system) already showed
"Saylani IT - A2O" via its own sender-name field. `gmail_api.py` was setting
`message["From"]` to the bare address.

Fixed with `email.utils.formataddr()` rather than string-formatting the
header by hand — it produces correctly quoted RFC 2822 output rather than
something that merely looks right for this one name. The display name is a
module constant, not a new environment variable: every other piece of copy
this integration sends (subjects, bodies) is already a constant in
`email_service.py`, and a brand name is the same kind of thing, not
per-environment configuration. It's a single choke point
(`_build_raw_message`), so this covers every email the Gmail integration
sends now and later — interview invitations and onboarding mail included,
once those are built.

### Verified

- Decoded the actual MIME message `_build_raw_message()` produces:
  `From: Saylani IT - A2O <thewaqasali59@gmail.com>`
- **192 backend tests pass**
- A real registration through the real `POST /applications` endpoint
  (candidate + admin-confirm + login + submit, no mocks) produced
  `candidate_code = B08-010` and a `200` from
  `gmail.googleapis.com/.../messages/send`
- Test account deleted afterward; `auth.users`, `profiles`, and
  `applications` confirmed at 0 rows for that id

**Not verifiable from here:** reading the delivered message back through
Gmail's API to double-check the header survived intact — the integration
holds `gmail.send` only, deliberately, and cannot read mail. The visual
check is the inbox itself.

**Still open, unaffected by anything in this entry:** whether the rotated
token itself survives past 7 days. See the previous entry. Check back
**2026-09-03**.

---

## 2026-08-27 — The registration confirmation email stopped sending, and why is still open

**Branch:** `waqas`

### The report, and what it wasn't

Reported as "the confirmation email with the candidate code has stopped
arriving," with the DB write and the success modal both confirmed working —
which correctly pointed away from `application_service.submit()` and toward
the fire-and-forget `BackgroundTask` that follows it.

A separate report bundled with it — sign-in broken after signup — turned out
to be user error (retrying against an email that already had an account, not
a bug) and needed no fix. Recorded here only so the earlier investigation of
it in this log is not mistaken for an unresolved issue.

### Root cause, reproduced directly

Called `email_service.send_registration_confirmation()` — the exact function
`POST /applications` schedules as a background task — with placeholder
arguments, and captured the real failure rather than inferring it:

```
POST https://oauth2.googleapis.com/token "HTTP/1.1 400 Bad Request"
UpstreamError: Failed to refresh the Gmail access token.
details: {"error": "invalid_grant", "error_description": "Token has been
           expired or revoked."}
```

The Gmail refresh token was dead. The application write, the candidate code,
and the modal were all fine, exactly as reported, because the whole design
point of running this as a `BackgroundTask` is that a mail failure must never
surface as a failed registration.

### A wrong diagnosis, caught and corrected

First explanation offered: the OAuth consent screen was still in Testing
status, where Google expires refresh tokens after 7 days. This was wrong,
and checkable as wrong from files already in this repository — `security.md`
and this file's own earlier entry both record the consent screen moving to
**Production on 2026-08-20**, a full week before this investigation. The
"Next" list in `project-status.md` had not been updated to match its own
"Resolved" section a few hundred lines above it, which is what produced the
wrong lead.

### What actually explains a Production app's token expiring

Not settled with certainty — this section states what is verified separately
from what is inferred.

**Verified:**
- The consent screen has been in Production since 2026-08-20 (two files,
  consistent, plus `git log` shows the commit recording it)
- `backend/.env`'s filesystem timestamp is 2026-08-20, 13:02, unchanged since
- 2026-08-27 (today) is exactly 7 days after that timestamp
- Six months of disuse is ruled out by the timeline alone
- No working-tree changes to `gmail_api.py` or `core/config.py` from the
  unrelated Supabase/SMTP work done earlier this week — the two systems use
  entirely separate credentials and neither code path touches the other

**Inferred, not proven:** the token that just failed was minted earlier on
2026-08-20, while the app was still in Testing, hours before that same day's
flip to Production. The doc's original claim that "existing tokens survive
the transition" was checked with a same-day re-test — which shows the token
wasn't immediately revoked by publishing, not that its expiry policy
changed. A token's lifetime plausibly gets fixed at the moment it is issued,
based on the app's status *then* — in which case publishing later that day
would not have rescued a token already stamped for 7-day expiry.

No API available here can confirm or rule this out: a Cloud project's OAuth
consent-screen history isn't reachable through the Gmail API's `gmail.send`
scope or anything else this backend holds a credential for.

### New token, tested for real, not assumed

A new refresh token was generated 2026-08-27 — after Production had already
been active for a full week — and placed in `.env` directly, not by hand
here.

Verified in two steps, both against the live Google/Gmail APIs:

1. **Isolated token exchange** — `gmail_api._get_access_token()` called on
   its own: succeeded, fresh access token returned.
2. **A real registration, through the real endpoint** — a candidate account
   was created, admin-confirmed (`email_confirm: true`, no inbox click
   needed), logged in for a real access token, and used to `POST
   /applications` against the live "Bootcamp 8" intake with a full,
   schema-valid 27-field payload. Produced `candidate_code = B08-007`, `201`.
   The backend log for that request shows:

   ```
   POST https://oauth2.googleapis.com/token         "HTTP/1.1 200 OK"
   POST https://gmail.googleapis.com/.../messages/send "HTTP/1.1 200 OK"
   INFO app.services.email_service: Registration confirmation sent
   ```

That confirms the new token works **today**. It does not confirm the
"why" above — only time will. **The open question — does a token minted
after Production survive past 7 days — is deliberately left open here.**
Check back around **2026-09-03**. If sending is still working then, the
mechanism above is confirmed and this can be closed. If it has failed again
on the same 7-day cycle, Production publishing is not what protects this
integration and the real fix is elsewhere — most likely accelerating the
already-planned move off personal-Gmail OAuth to Resend or SendGrid.

### A structural gap noticed along the way, not fixed

Registration-confirmation failures write only a Python log line — never a
row in `email_log`. That table is only ever written by the separate,
admin-triggered bulk-send path (`send_to_applications` → `_send_and_log` in
`email_service.py`). There was no database trail to check for the original
failure; it was only found by re-triggering the send directly. Not addressed
here — flagged for whoever picks up `email_log` coverage next.

### Verified

- New refresh token authenticates in isolation (`_get_access_token()`
  succeeds)
- A real, end-to-end registration through `POST /applications` produces a
  real `200` from `gmail.googleapis.com` and a real Gmail message send —
  not mocked, not assumed
- The test candidate account and its application were deleted afterward via
  the admin API; `auth.users`, `profiles`, and `applications` all confirmed
  at 0 rows for that id post-delete

**Not verified, and cannot be from inside this repository:** the Google
Cloud OAuth consent-screen status itself, the cause of the *previous*
token's death beyond the circumstantial timing evidence above, and whether
this new token actually survives past 7 days — that last one is the whole
reason 2026-09-03 is called out explicitly, above and in `project-status.md`.

---

## 2026-08-27 — Signup confirmation could not be recovered from, and could not be verified

**Branch:** `waqas`

### Two bugs, reported together, that turned out to be independent

A signed-up account could not sign in: GoTrue rejects the password grant
with `email_not_confirmed` until the address is confirmed, which is correct
and present since the first backend commit, not a regression. But nothing in
the product could re-send that confirmation email if the first one was
missed, which meant an account could be permanently stuck with no self-service
way out. Separately, the confirmation email itself was still Supabase's
unstyled default, because the rewritten template committed at
`docs/email-templates/signup-confirmation.html` had never been applied
anywhere outside the repository — writing a file does not configure a
project.

### A resend endpoint, deliberately unable to say what it did

`POST /auth/resend-confirmation` wraps GoTrue's own `/resend`, using the anon
key rather than service_role so GoTrue's per-address and per-project send
limits still apply — a resend button is exactly the kind of thing that
invites abuse if it can bypass them.

The endpoint returns the identical message for an unknown address, an
already-confirmed one, and a genuinely resent one:

```
"If that address has an unconfirmed account, a new confirmation email
 is on its way. Remember to check your spam folder."
```

It is reachable without authentication, because the caller cannot sign in
yet — that is the whole reason they are here — and a truthful answer would
turn the endpoint into a way to test which addresses have accounts. Rate-limit
and upstream failures are the exception: both need the caller to act, and
neither reveals anything about a specific address.

On the frontend, the login page now reads the error *code* rather than only
its message (`toErrorCode()`, added to `lib/api-client.ts`, next to the
existing `toErrorMessage()`), because `email_not_verified` is the one failure
with something to offer beyond an error string: a **Resend confirmation
email** button, shown only on that code.

### Why the fix was not `supabase config push`

The templates now live at `supabase/templates/confirmation.html`, matching
Supabase's config-as-code layout, and there is a `supabase config push`
command that reads `config.toml` and applies it. It was not used: generating
a default `config.toml` locally to check it showed `enable_confirmations =
false` and `site_url = "http://127.0.0.1:3000"` as the values it would send
for anything not explicitly set — pushing it would have disabled the email
confirmation this project depends on and pointed every confirmation link at
localhost, as a side effect of deploying a template.

The Supabase Management API's `PATCH /v1/projects/{ref}/config/auth` does not
have this problem: its request schema has 234 fields, and confirmed directly
against the OpenAPI spec, every one of them is optional, so a request naming
only `mailer_templates_confirmation_content` and `mailer_subjects_confirmation`
changes only those two. `supabase/scripts/push_email_templates.py` does this,
diffing live against `supabase/templates/*.html` and only writing with
`--apply`. It was written and is committed but **has not been run** — the
template was applied by hand in the Supabase dashboard instead, so the script
is currently reference/backup for the next template change, not the deploy
path this one took.

One Management API field was checked and does not exist: there is no
`smtp_pass` in that schema, so the SMTP password itself cannot be set through
this API and Custom SMTP has to be configured once, by hand, in
Authentication → Emails → SMTP Settings. It already was, independently of
this work.

### Verified against the live project, not assumed

- **A genuinely new, unconfirmed signup** (`confirmation_sent_at` populated,
  `email_confirmed_at` null) was created and used for every test below,
  rather than reusing an already-confirmed account, which would have let a
  broken resend look like it worked.
- **The resend endpoint returns byte-identical `200` responses** for an
  address with an unconfirmed account and one with no account at all —
  checked side by side against the same running server.
- **A resend against the fresh account was rejected `429` twice** before it
  was accepted: first by GoTrue's per-address cooldown (`x-sb-error-code:
  over_email_send_rate_limit`, `"...after 27 seconds"`, read directly off a
  raw GoTrue call since the endpoint deliberately does not pass that detail
  through), then once more a few seconds later, apparently reset by that same
  diagnostic call. `confirmation_sent_at` was read after each `429` and
  confirmed unchanged — the rejection was clean, not a silent duplicate send.
- **The real success path**, only reachable once the cooldown cleared:
  `confirmation_sent_at` moved from `07:19:07` to `07:20:19` on the third
  attempt, a genuine second dispatch through Gmail's now-configured SMTP.
- **192 backend tests pass** (185 before this work), including 7 new ones in
  `tests/unit/test_resend_confirmation.py` covering the masking behaviour,
  the two failure types that must still surface, and that the call goes out
  on the anon key rather than service_role.
- Frontend production build and `oxlint` clean on the touched files.
- Both test accounts created for this work
  (`...+e2e1787814167@...`, `...+smtp1787815146@...`) were deleted afterward
  via the admin API; each owned one `profiles` row and no application, and
  both tables confirmed empty post-delete.

**Not verified by this work:** the actual rendered appearance of either email
in an inbox — that was confirmed separately, by eye, outside this repository.

---

## 2026-08-27 — University status, B-Form for minors, and both emails rewritten

**Branch:** `waqas`

### A minor with no identity number at all

The previous rule made the applicant's own CNIC optional under 18, on the
reasoning that a minor may not hold one. That was half right: they hold a
**B-Form** instead, and making the field skippable left those records with no
way to identify the person at all.

One field, two documents, both mandatory:

| Age | Label | Validation |
|---|---|---|
| 18 and over | Your CNIC | 13 digits |
| Under 18 | Your B-Form number | 13 digits |

The label, the hint and the schema all swap on the date of birth entered in
the previous step. Nothing is skippable either way.

Because both numbers share one column, `candidate_profiles.id_document_type`
now records which document it is. Without it the column is ambiguous the
moment the applicant turns 18 and the age can no longer be inferred from the
row. It is **derived server-side** from `date_of_birth` rather than sent by
the client: a client-supplied answer could disagree with the date beside it,
and the date is the one that can be checked.

### University status

Four fields in the education section, the last three revealed only for a
university student: semester, university name, and class timing.

Class timing is a fixed set (Morning / Evening / Weekend) rather than free
text. The question exists so a bootcamp session is not timetabled against a
candidate's classes, which is a question about which half of the day is taken
— free text answers that in a dozen unqueryable spellings.

They live on `applications`, not `candidate_profiles`: a semester advances
between intakes, so this describes the applicant at the moment they applied
rather than a durable fact about them.

**The same rule is stated in three places, deliberately**, because each guards
a different failure:

1. `registrationSchema.superRefine` rejects a partial block at submit
2. `ApplicationCreate` re-checks it, turning a database CHECK violation into a
   422 that names the missing field
3. `applications_university_details_complete` is the CHECK itself, so nothing
   that bypasses the API can write a half-answered block

### A gate that would have let students through

Caught while reasoning about the unlock logic, not by a failing test.

The three university fields are `.optional()` in the section schema, because
they genuinely are optional for most applicants. The first version of the gate
passed `undefined` as its override when the answer *was* yes, which fell
through to that optional schema and advanced past three empty fields, failing
only at submit.

Both branches are now stated explicitly: required for a student, optional for
everybody else. Verified by simulating the gate over the field order.

```
student, university blank  -> blocked at semester
student, university filled -> reaches picture
non-student, blank         -> reaches picture, block skipped
```

### The registration email

Rewritten. The old closing line said nothing was required until interview
scheduling, which was reassuring and wrong: a missed interview ends the
application. It is replaced by a red callout carrying the exact wording the
project owner supplied.

Added a documents section covering the seven items needed at later stages,
numbered with a hint under each rather than as a bare list, plus a separate
amber block for applicants under 18 (B-Form in place of CNIC, Easypaisa or
JazzCash in place of a bank account).

Framed as informational throughout. A list of required paperwork with no
context reads as a demand and generates support mail, so the section opens by
saying nothing needs sending yet.

The greeting now uses the full name as submitted. Every em-dash and en-dash
was removed from both the HTML and plain-text parts, and both parts carry the
same content rather than the text half being a summary.

### The signup email is not ours to change

Worth recording, because it is not obvious from the code: **the backend sends
no signup email.** Supabase Auth (GoTrue) sends it from a template stored in
the Supabase dashboard, so it cannot be edited from this repository.

The rewritten markup was version-controlled at
`docs/email-templates/signup-confirmation.html` (superseded — see the entry
above; the deployable copy now lives at `supabase/templates/confirmation.html`)
and had to be pasted into Supabase → Authentication → Emails → Confirm signup
by hand. It is matched to the registration email's font stack, green accent,
greeting form and footer rule, and kept deliberately shorter: it has one job,
and text around a button lowers the chance the button is pressed.

The on-screen notice after signup now names the address the mail went to and
mentions the spam folder, those being the two most common reasons a
confirmation never arrives.

### Verified

- **185 backend tests pass**, unchanged from before this work
- Registration email rendered and asserted against **20 content checks**:
  full-name greeting, the old line gone, the callout wording and its styling,
  all seven documents, the mandatory note, the under-18 block, and the same
  content in the plain-text part
- Identity logic exercised directly: born 2000 gives `CNIC`, born 2012 gives
  `B_FORM`, and an empty number is rejected for a minor where it used to pass
- Full write path against the live database inside a rolled-back transaction:
  a minor university student produced `B08-005` with all four university
  columns and `id_document_type = B_FORM`
- All three new CHECK constraints rejected bad values by name
- Frontend typecheck, production build and `oxlint` clean, 0 errors

**Not verified:** neither email was actually sent to an inbox, and the form
was not click-tested in a browser. There is no frontend test runner, and
sending live mail was not requested.

---

## 2026-08-24 (night) — A success modal that rendered for zero frames

**Branch:** `waqas`

Reported as "the form just submitted with no visible confirmation at all".
The registration had in fact succeeded — `B08-003` was in the database with
the candidate profile written — so the fault was entirely in the frontend.

### Cause

Introduced by the registration-window guard added earlier the same day. On a
successful submit:

```
setResult(created)   // the child would now render <RegistrationSuccess>
reload()             // -> setLoading(true)
```

React batches both into one render pass, and **the parent renders before the
child**. The parent was the new guard:

```tsx
if (loading) return <Skeleton />   // RegistrationForm unmounts here
```

Unmounting the form destroyed the `result` state holding the candidate's code.
When the refetch settled the guard mounted a *fresh* form, back at step one.
The modal existed for no frames at all.

Two individually correct pieces, broken at the seam: `reload()` deliberately
raises a flag, and the guard deliberately watches it.

### Fix: one flag was doing two jobs

`useMyApplication` now returns both:

| Flag | True when | Use for |
|---|---|---|
| `initialLoading` | until the first settle, never re-raised | **gating what mounts** |
| `loading` | any fetch, refetches included | spinners |

Guarding a mount on "we are fetching" is the bug in general form — a refetch
throws away whatever the guard wraps. Guarding on "we do not know yet" cannot.
The distinction already existed in `useAsync` on the admin side; this brings
the candidate hook into line.

`reload()` also moved out of the submit path into the modal's dismiss, firing
on all three exits. Nothing behind the modal needs unlocking while the modal
covers it, and deferring it removes the race rather than merely surviving it.

### Three more instances of the same defect

Found by sweeping every consumer, not by waiting for the next report:

| File | Consequence of the old `loading` gate |
|---|---|
| `routes/guards.tsx` | **Unmounted the entire gated page** on any refetch — an in-progress document upload would have been discarded |
| `dashboard-page.tsx` | Live dashboard flashed back to a skeleton |
| `track-page.tsx` | Same |

The `guards.tsx` one was the worse bug, waiting on a different trigger.

`NavRow` deliberately still uses `loading`: a small "refreshing" dot there
unmounts nothing, which is exactly what that flag is for.

---

## 2026-08-24 (evening) — Registration window enforced before the form loads

**Branch:** `waqas`

With registration closed, the Register button still opened the full form — it
simply had no track to select. Five steps a candidate could walk through and
never submit.

### Source of truth, not a new check

`is_phase_open()` weighs the registration flag **and** the clock against
`opens_at`/`deadline_at`. It already backed both `open_for_registration()`
(behind `/bootcamps/open`) and `assert_phase_open()` (enforced on submit), so
the frontend gate reads the same answer a submission would get. Nothing new
was introduced to decide "closed".

Verified in both directions against the live database inside rolled-back
transactions: closing the phase emptied `open_for_registration()`, reopening
it returned Bootcamp 07 with its five programs.

### Gated twice, deliberately

The button checks before navigating, so nobody watches a page load only to be
turned away. The route checks too, because a URL stays typeable. Only the
button case is a `<button>` — the two navigating cases render through `Link`
so middle-click and "open in new tab" keep working.

`RegistrationClosedDialog` is compact, red, and **not** framed as an error: a
closed intake is the normal state for most of the year. The icon scales in on
a spring via Motion, already installed.

### The button now has three states

| State | Label | Destination |
|---|---|---|
| First load | Register *(disabled)* | — |
| Has an application | **View application** | `/dashboard/track` |
| No application, window shut | Register | Closed dialog |
| No application, window open | Register | `/dashboard/register` |

Pointing an existing applicant back at the form would only walk them into the
409 that `unique (bootcamp_id, profile_id)` already produces.

Extracted as `RegisterAction`, so the dialog's state lives beside the thing
that opens it rather than in the layout.

---

## 2026-08-24 (afternoon) — Registration form, round two

**Branch:** `waqas`

Nine fixes from a review pass. Two were the same symptom with different
causes, which is why they were diagnosed before either was touched.

### The dropdown showing a UUID

Only the *track* dropdown. Its value is a `program.id`, and Base UI's
`SelectValue` renders the raw value rather than the item's children — every
other select uses the label *as* the value, so they worked by accident.

Fixed by removing the second code path rather than patching it: `SelectField`
now takes either plain strings or `{value, label}` pairs and passes `items` to
`Select.Root`. The track field had its own hand-rolled `Controller`; it now
uses the shared component, so a value-unequal-label select cannot display raw
again.

### The dropdown feeling broken

`alignItemWithTrigger` defaults to `true` in Base UI — the macOS behaviour of
overlaying the trigger and shifting the popup so the *selected* item lands on
it. With 19 courses the popup jumps position depending on selection, and the
flag suppresses the open animation outright
(`data-[align-trigger=true]:animate-none`). Hence "unpolished" rather than
obviously broken. Now `false` in the shared wrapper, which changes every
select in the app including the admin screens — no call site overrides it.

### Input limits that are limits

Roll number and phone numbers are **transformed on every keystroke**, not
validated after the fact. The seventh roll-number digit and the twelfth phone
digit are dropped before reaching form state, so there is nothing to show an
error about.

A first attempt at the phone formatter turned a pasted `+92 300 123 4567` into
`9230-0123456` — caught by testing the function rather than trusting the
comment above it. It now rewrites a `92` country code to the local `0` form,
guarded on the following `3` so a local number starting "92" is left alone.

### CNIC required from eighteen

The rule spans two sections — date of birth in step two, CNIC in step three —
so it cannot live in either section's schema. It is applied in three places
from one calendar-correct `isAdult()`:

1. `registrationSchema.superRefine` with `path: ['cnic']` — submit-time
2. `unlockedCount()` gained a per-field schema override — so the unlock gate
   agrees with the submit rule, instead of letting an adult past an empty CNIC
   only to reject them at the last step
3. `optional={!cnicRequired}` — the asterisk appears and disappears on its own

### Declarations and policies

Three one-line declarations, no headings, and the dress code rewritten
gender-neutral: *"I agree to maintain formal attire while attending classes
and any on-campus session."* `TERMS_VERSION` bumped to `2026-08-22b` — which
is what that column exists for, so anyone who accepted the earlier wording has
that recorded rather than the new one.

Privacy Policy and Terms of Service open in a dialog rather than navigating:
nothing is saved until submit, so leaving the page would cost five steps of
answers. **The text is placeholder** and says so on screen. Real legal wording
has to come from the project owner.

Email is filled from the session and read-only — it is the account's address,
not a new value to enter.

---

## 2026-08-24 (morning) — Registration writes to the database

**Branch:** `waqas`

The form stopped being a demo. One transaction now creates the application,
mints the candidate code, and writes the person-level answers to the profile.

### Two destinations, one payload

Person-level answers (name, parentage, contact, CNIC, address) go to
`candidate_profiles`; intake-specific ones (prior course, proficiency, laptop,
declarations) go to `applications`. Splitting the *request* would let half a
registration succeed; splitting the *storage* stops a candidate retyping their
father's CNIC for every intake, and is what lets registration populate a
profile at all.

`profiles.full_name` and `profiles.phone` are synced too, so the portal header
stops showing a blank name the moment somebody registers.

### What was already right

Checked before building, not assumed:

- `mint_candidate_code()` was already race-safe — `UPDATE ... RETURNING` takes
  a row lock, previously load-tested at 24 concurrent mints with zero
  duplicates. No sequence or counter table was needed.
- `unique (bootcamp_id, profile_id)` already prevented duplicate registration.

So the migration only added columns. It also added `terms_version` alongside
`terms_accepted_at`, a deliberate deviation from "store a flag": a bare
timestamp records *that* somebody agreed but not to what, and the wording has
since been rewritten once already.

### Email cannot fail a registration

Queued through FastAPI's `BackgroundTasks`, which run *after* the session
dependency commits — so the registration is durable before the send is
attempted — and `send_registration_confirmation()` catches everything and logs
the candidate code for a manual resend. A Gmail outage cannot turn a
successful registration into a 500.

### Pictures

Uploaded browser → FastAPI → Supabase Storage with the service role. The
bucket is private with **no client-facing policies at all**, which is stricter
than the RLS-per-user alternative and keeps the project's rule that the
frontend never talks to Supabase directly. Reads are 1-hour signed URLs;
filenames are random, since user-supplied ones carry path separators and
surprise extensions.

The upload happens on file selection, and the form field is only set once it
succeeds — so the unlock gate doubles as proof the picture is stored.

Round-trip verified against the real bucket: upload, sign, fetch back 200,
ownership check correctly rejecting another user's path. Test object deleted.

### The account page caught up

`/account` rendered five of the fourteen profile fields, because it was built
against the original four-column `candidate_profiles`. It now shows the
registration answers read-only, the profile picture, and the candidate code
(fetched from `/applications/mine`, since the code lives on the application,
not the profile).

Wiring that surfaced a **deliberate privacy boundary**: `UserDetail` is shared
by `/auth/me/detail` and the admin user directory, and its
`CandidateProfileSummary` is narrowed so an admin cannot see a candidate's
father's CNIC or picture path. Widening it would have leaked those to every
admin. The wide shape is fetched from `/auth/me` instead, which is only ever
about the caller.

### Verified

Service-level, against the live database inside a rolled-back transaction:

```
CODE MINTED     : B07-001
PROFILE WRITTEN : Test Candidate | Test Father | Karachi | cnic None
profiles synced : Test Candidate | 0300-1234567
ROLLED BACK
```

Later confirmed by real use: `B08-002` and `B08-003` were created through the
browser with profiles populated.

---

## 2026-08-22 (later) — Fix: Register button never left the frozen state

**Branch:** `waqas`

The registration form shipped reachable at `/dashboard/register`, but the
Register button in the portal header still ran the placeholder from the auth
task — a toast reading "Registration opens soon" and no navigation. The form
was only findable by typing the URL.

The freeze was correct when it was written: there was no form to open. It
simply outlived its reason, and nothing connected the two facts.

```
- <Button size="sm" onClick={() => toast('Registration opens soon', ...)}>
+ <Button render={<Link to="/dashboard/register" />} size="sm">
```

`Link` rather than an `onClick` calling `navigate()`. Both route client-side,
but only the anchor supports middle-click, ctrl-click and "open in new tab",
and only the anchor is announced as a link. The `render` prop is how this
codebase composes Base UI buttons with router links — the "Website" button two
lines below already does exactly this.

The `toast` import became dead and was removed with it.

### Left alone, pending a decision

The button behaves identically for somebody who has already registered. That
case has not been agreed yet, so it was not changed — the recommendation is
recorded in `project-status.md` under *Awaiting decisions*.

Worth noting the backend already refuses a duplicate: `application_service.
submit()` raises `ConflictError` with the existing candidate code, and the
`unique (bootcamp_id, profile_id)` constraint backs it. The gap is only that
the UI still invites the attempt.

### Verified

- Typecheck, production build and `oxlint` clean
- Route path confirmed from the router config rather than assumed
- **Not** click-tested in a browser — no frontend test runner is configured.
  The pattern is the one already shipping on the adjacent "Website" button.

---

## 2026-08-22 — Multi-step bootcamp registration form

**Branch:** `waqas`

The form behind the Register button: four sections, one on screen at a time,
each field unlocking only after the one above it validates. UI and local state
only — **no database work**, by instruction. The field list was approved before
any code was written.

### Not the general enrolment form

Adapted from Saylani's public enrolment form rather than copied. The
differences are the point:

| Change | Why |
|---|---|
| Class Preference removed | Bootcamp intake has no class options |
| Course Status added | Replaces it; only meaningful once a course is named, so it is not rendered before then |
| Saylani Roll Number added | Bootcamp applicants are existing students |
| Country locked to Pakistan | One country runs bootcamps |
| Campus locked to Zaitoon Ashraf IT Park | One campus runs bootcamps |
| Course list filtered to 19 IT tracks | Six non-IT vocational courses on the public list are not preparation for an IT bootcamp |
| Laptop callout added | A personal machine is mandatory; worth saying out loud, not burying in a Yes/No |
| CAPTCHA omitted | Deferred to a later task. No stub either — a fake "not a robot" box implies protection that does not exist |

**Only the applicant's CNIC is optional.** An applicant under 18 may not hold
one yet; a guardian always does, so `father_cnic` is required. An earlier draft
had both optional and was corrected.

### Declarations written for this platform

The reference form's declarations were not reused. A bootcamp applicant is
entering a competitive, deadline-gated process with an interview, a physical
interview and a capacity limit — none of which apply to open enrolment, and all
of which they should be told about before agreeing to anything. Five
declarations now cover accuracy, conduct, attendance and commitment, project
completion, and the dress code, plus a separate policy consent.

Each is its own checkbox. Bundling them into one "I agree to everything" makes
consent unfalsifiable and leaves no record of which term was actually shown.

### Progressive unlocking is derived, never stored

`unlockedCount()` walks a section's field order and returns the index of the
first field that does not parse against its own schema. Field `i` is enabled
when `i <= unlockedCount`. Clearing a field re-locks everything after it for
free, with no state to keep in step and no way for the gate to disagree with
validation.

This is why the schemas are split per section rather than kept as one flat
object: the gate needs each field's schema reachable through `.shape`.

### A separate stepper, on purpose

`JourneyStepper` was not reused. It is typed to recruitment concepts —
`ApplicationStage`, stage-to-step mapping, timestamps, a halted flag — none of
which mean anything to a form, and its demo mode advances on a timer, which is
exactly wrong for something that must move only when the user says so. Sharing
it would have meant a third mode and a generic step type, making a component
that does one job well do two badly.

The *design language* is shared: node sizing, checkmark on completion, rotating
ring on the active node, connectors filled by transform. A third consumer would
be the moment to extract a primitive; two is not.

Completed steps are clickable to go back. Forward jumps are not, because that
would skip the validation each Next enforces.

### Page fold

CSS 3D transforms driven by Motion, no new dependency. The outgoing section
pivots on its Y axis about the leading edge while a gradient darkens across it
— the light-catch is what makes it read as paper rather than a rotating
rectangle. The incoming section settles in from a shallower angle.

Only `transform` and `opacity` animate, so it stays on the compositor.
`AnimatePresence mode="wait"` sequences the two: overlapping them needs
absolute positioning and a measured container height, which fights sections of
different lengths. Reduced motion gets a plain crossfade.

### Two bugs found while building

**Base UI Select treats `''` as a selected value**, not as empty, which
suppresses the placeholder. The controller now passes `null` for empty while
form state keeps `''`, so the zod enums still report "required" rather than
"expected string, received null".

**Object URLs leak.** The picture preview revokes the previous URL on every
re-pick and on unmount; without that, each change would strand an image for the
life of the page.

### No new libraries

`react-hook-form`, `@hookform/resolvers`, `zod` and `motion` were all already
installed. The project has no checkbox primitive, so the declaration checkboxes
are buttons with `role="checkbox"` and `aria-checked` — real buttons, so
keyboard operation comes free and the whole row is the hit target.

### Not wired to the Register button

The button in the portal header stays frozen, as previously instructed, and
submitting persists nothing. The form is reachable at `/dashboard/register` for
review. Activating the button is a one-line change once the database layer
exists.

### Verified

- Typecheck (`tsc -b --force`), production build, and `oxlint` all clean
- Register page code-splits to its own 54 kB chunk, so the rest of the portal
  does not pay for it
- Base UI Select and SelectValue props confirmed against their type
  definitions rather than assumed
- **Not** click-tested in a browser — no frontend test runner is configured,
  and adding one would be a new dependency

---

## 2026-08-22 — Fixtures removed, documents built, two real auth bugs found

**Branch:** `huzaifa`

Brief: remove every mock fixture, fix routing, make each bootcamp's dashboard
properly scoped, and fix a Base UI menu crash. Three decisions were taken
first: build real document uploads (Supabase Storage + a `documents` table)
rather than hiding the page, add `PATCH /auth/me` so candidates can edit their
own profile, and keep interview scores hidden from candidates.

### The menu crash, and what it really was

```
Base UI: MenuGroupContext is missing.
```

`DropdownMenuLabel` renders `MenuPrimitive.GroupLabel`, which Base UI requires
to sit inside a `Menu.Group`. Three call sites rendered one loose — including
`portal-layout.tsx`, which is on **every** portal page, so the account menu
took the whole app down whenever it opened. Fixed by wrapping each in
`DropdownMenuGroup`, not by suppressing the error.

A `RouteErrorBoundary` is now attached as `errorElement` on every top-level
branch, so the next error of this class degrades to one section instead of a
white screen.

### Two auth bugs, found by end-to-end testing rather than review

**1. Clock skew — spurious 401s right after login (the serious one).**

The scope test kept failing: a freshly created admin's token was rejected on
every call while the super admin's worked. Three hypotheses were wrong (JWKS
rotation, an empty key set, upstream rate limiting) before unwrapping the real
exception:

```
ImmatureSignatureError: The token is not yet valid (iat)
```

GoTrue stamps `iat` from **its** clock. Supabase's runs a second or two ahead
of this machine, so a token is "not yet valid" for the first moments of its
life. The super admin's token only worked because it had been minted seconds
earlier and local time had caught up — which is exactly why this looked
intermittent rather than systematic.

In production this reads as *users randomly getting 401s immediately after
signing in successfully*. Fixed with a 60-second `leeway` on decode, with
tests covering drift up to 59s, rejection at an hour, and confirmation that
expiry, audience, subject, and signature checks all still hold.

**2. A JWKS outage was reported as a bad token.**

Found while chasing the above. `security.md` claimed an unreachable JWKS
endpoint returns 502 and an unknown `kid` returns 401, but any
`PyJWKClientError` whose message contained "Unable to find" produced a 401 —
including a key set that came back empty. Telling every signed-in user their
token is invalid, for a fault none of them can fix, is the wrong answer.

Now: a connection error or an unreadable/empty key set is a 502; a readable
key set that genuinely lacks the `kid` is a 401. An unknown `kid` also
refetches once before giving up, so genuine key rotation resolves instead of
locking everyone out.

### Documents — migration `20260820160000_candidate_documents.sql`

A `documents` table indexing objects in a **private** Supabase Storage bucket,
plus `document_type` and `document_status` enums. Metadata only — no base64
column, or every listing query would drag megabytes through the API.

The browser never holds a storage credential: uploads pass through the API
(the only place size and content-type limits can be enforced), and reads are
served by a signed URL valid for 120 seconds. Content types are restricted to
PDF/JPEG/PNG/WebP — SVG is excluded deliberately, being an image that can
carry script.

One live document per `(application, doc_type)`: a re-upload replaces the row,
so "the candidate's CNIC front" is never ambiguous. A rejection must carry a
reason, enforced by a CHECK constraint *and* at the service boundary so the
admin gets a usable message instead of an integrity error. Accepted documents
cannot be replaced or deleted by the candidate.

### Everything else wired to real data

`lib/mock-data.ts` is **deleted**. Every fixture it exported had reached zero
consumers first, verified per-symbol rather than by deleting and seeing what
broke.

- **Super admin**: Bootcamps (create/edit/delete, assign admins, programme
  sets), Administrators (provision staff, roles, activation, password reset),
  Analytics (funnel, tracks, cities, 30-day trend), Overview.
- **Programs**: full CRUD screen — the backend had it since the last sprint
  with no UI.
- **Candidate**: dashboard, application *and* the apply flow, interview
  schedule, documents.
- **Account**: one `/account` screen for every role, replacing a
  candidate-only profile page that the topbar linked staff to — they were
  bounced straight back out by the role gate.

`PlatformStats` gained `by_city`, `applications_over_time`, and per-intake
summaries so the super-admin screens need one call rather than N+1.

### Scoping proven, not assumed

The provider now wraps both staff branches, so a super admin uses the same
per-bootcamp tools without a parallel mechanism. A live end-to-end run —
create intake → set deadlines → create admin → assign → sign in as them —
confirms an admin sees exactly one intake and gets **403** on another's
detail, applicants, interviews, documents, emails, and stats, plus platform
stats, global audit, bootcamp creation, and staff creation. 31/31 checks pass.

A second run covers documents end to end against live Supabase: apply →
checklist → upload → signed-URL download (bytes match) → executable refused →
reject without reason refused → reject with reason → candidate sees it →
re-upload → accept → deletion refused. 16/16 pass.

### Verified

| Check | Result |
|-------|--------|
| Backend tests | 185 pass, up from 120 |
| Frontend typecheck | Clean |
| Production build | Clean |
| Frontend lint | 0 errors |
| Fixture imports outside tests | None — the module is gone |
| Live scope/flow run | 31/31 |
| Live documents run | 16/16 |

Lint warnings dropped from a mix including purity, immutability, and
ref-during-render to only fast-refresh notices plus three `set-state-in-effect`
in files this sprint did not touch.

### Not done

The Gmail OAuth Production flip and the Resend/SendGrid migration remain open,
as does the AI Interviewer and Agilytic — all explicitly out of scope.

---

## 2026-08-20 (night) — Admin portal: full backend surface, frontend wired to it

**Branch:** `huzaifa`

Brief: build out full admin functionality — every feature an admin should
have, wired to real data, plus a working `SUPER_ADMIN` account
(`admin@sita2o.com`). Preceded by a codebase-wide analysis pass (branches
confirmed: `main`, `development`, `waqas`, `huzaifa` all present) that
surfaced three real bugs, folded into this work rather than fixed separately.

Four decisions confirmed before building: `SUPER_ADMIN` stays the only truly
global role rather than flattening `ADMIN` to global too, three new tables
(`interviews`, `email_log`, `audit_logs`) get built rather than left as mock
UI, the password was supplied directly rather than generated, and the build
went page-by-page (Dashboard → Candidates → Phases/Interviews → Emails) rather
than backend-then-frontend in two passes.

### Schema — migration `20260820140000_admin_portal.sql`

Three new tables, three new enums (`interview_mode`, `interview_status`,
`email_status`). Applied over the pooler connection — the Supabase CLI is
still not on this machine's PATH — and recorded in the ledger.

`email_log` and `audit_logs` carry **no RLS policies at all**, a deliberate
departure from every earlier table: both are staff-only with no "select own
row" case for a candidate, so the safest policy is none rather than a
partial one someone might extend incorrectly later.

`interviews` is many-per-application by design: a reschedule adds a row
instead of overwriting one, so the history of attempts survives.
`Application.stage` remains the single source of truth for pipeline position
— interview rows never drive routing decisions on their own.

### Backend: 21 → 59 endpoints

Nine route modules (four new: `interviews`, `emails`, `users`, `audit`), nine
matching services, plus `audit_service.py` as the one call site every mutating
service goes through — `record()` joins the caller's transaction rather than
committing separately, so a failed action never leaves an audit row claiming
it succeeded.

**Staff provisioning answers the open question from `security.md`.** `POST
/users` (`create_staff`) calls GoTrue's admin API with `email_confirm=True`,
rejects `role=CANDIDATE` outright, and is gated `require_super_admin`. The
first super admin has nobody to authorise them, so
`scripts/create_super_admin.py` exists as a one-time, idempotent bootstrap
reading credentials from env vars only.

**Guardrails added, not just documented:** a super admin cannot demote,
deactivate, or delete their own account, or the last active super admin —
checked server-side, both return `409` since the caller could resolve the
conflict (promote someone else first), which is not what `403` means.

### Three real bugs found and fixed

Found during an initial full-codebase review (requested separately, before
this build started), then fixed as part of it rather than deferred:

1. **HIGH — `PATCH` on a phase window silently wiped the deadline.**
   `update_phase_window` assigned `opens_at` and `deadline_at`
   unconditionally; sending only one field nulled the other, leaving
   registration open indefinitely with no error. `PhaseUpdate` schema and
   service now use `model_dump(exclude_unset=True)`, matching the pattern
   `update_bootcamp` already used correctly. Six unit tests pin the
   omitted-vs-explicit-null distinction; verified against the *live* database
   in a smoke test, not just the fixture.
2. **MEDIUM — duplicate-application race surfaced as a raw 500.** The
   pre-insert `SELECT` is not a lock; two simultaneous submissions could both
   pass it and collide on the DB's unique constraint. Now caught by
   constraint name and translated to the same `409` the non-racing path
   already returned.
3. **MEDIUM — rejection was permanently terminal.** `advance_stage` raised
   `403 permission_denied` for any non-`ACTIVE` application, with no route
   back — and no way to reapply either, since `(bootcamp_id, profile_id)` is
   unique. Added `POST /applications/{id}/reinstate`; corrected the status
   code to `409` to match the identical "already at this stage" case two
   lines above it in the same function.

### Frontend: admin portal wired to the real API

`lib/types.ts` is now the canonical mirror of every backend schema, not just
the enums — `lib/mock-data.ts` re-exports `ApplicationStage` from it instead
of redeclaring it, closing a drift risk that existed even before this session.

**No react-query added.** `hooks/use-async.ts` covers loading/error/refetch
and stale-response cancellation in ~80 lines — judged lighter than a query
library for five screens.

**`BootcampProvider` is a layout route**, not a per-page hook: the selected
intake has to survive navigation between Candidates, Interviews, Phases, and
Emails, so it sits above all five as `routes/admin-layout.tsx` and persists
the choice to `localStorage`.

**Batch interview scheduling** spaces slots evenly from a chosen start time
and duration, is all-or-nothing server-side, and advances each candidate to
`INTERVIEW_SCHEDULED` automatically. Built for the 50/50/25 split the docs
describe, but nothing hardcodes those numbers — batch size is a plain input.

**Email compose** renders four starting templates through the backend's
`$candidate_name`-style merge fields (`string.Template.safe_substitute`,
chosen specifically because an admin's typo in a placeholder must not fail
the send — it must render literally and stay visible in the sent mail).

Two `set-state-in-effect` lint warnings introduced during the build were
removed before finishing, not left for later: one intake-selection default
moved from an effect into a `useMemo` (it was being derived correctly every
render already; writing it back bought nothing), and one phase-edit form's
sync-with-server-props effect was replaced with a remount key built from the
server's own field values.

### Verified end to end against the live database, not assumed

Real login as `admin@sita2o.com` → confirmed `SUPER_ADMIN` from both the
login response and `/auth/me`. Real Bootcamp 07 created with all 5 tracks.
The phase-window fix specifically verified live: a deadline set, then a
follow-up PATCH touching only `opens_at`, then confirmed the deadline was
still present — the exact failure mode of bug #1, reproduced and disproven
against production data, not a mock.

Every self-guardrail exercised for real: self-demotion `409`, self-deactivation
`409`, no-token `401`. Response shapes for all 7 representative endpoints
diffed key-for-key against the TypeScript types — zero missing, zero extra
fields.

| Check | Result |
|-------|--------|
| Backend tests | 120/120 pass, up from 38 |
| Frontend typecheck | Clean |
| Frontend production build | Clean |
| Frontend lint | 0 errors (34 pre-existing-style warnings, same count as before minus the 2 introduced-then-fixed) |
| OpenAPI schema generation | 44 paths, 67 models, no errors |
| Live smoke test | Login, stats, Bootcamp 07 lifecycle, phase-window regression, all guardrails — all pass |

### Not yet wired

Super-admin pages (`/super-admin/*` — Bootcamps, Administrators, Analytics)
and the whole candidate portal still render `lib/mock-data.ts` fixtures. The
backend every one of them needs already exists and is covered by the same
`features/admin/api.ts` wrapper — `bootcampApi`, `userApi`, `platformApi`,
and `GET /me/interviews` are ready to call.

---

## 2026-08-20 (night, later still) — Correction: signing up is not registering

**Branch:** `waqas`

The dashboard had been built as though every signed-in user was a candidate.
They are not, and the distinction is the whole shape of the product:

- **Sign up / log in** creates a **User**. That is all it does. The person now
  has an account.
- **Register** — a separate, deliberate action — creates an **Application**.
  Only now is the person a candidate.

Everything downstream (candidate code, interview, physical interview, form,
onboarding, the tracker) belongs to the Application, not the User. None of it
should be reachable, populated, or implied before that second action.

### Two things named alike, doing different jobs

Worth writing down because the names invite confusion:

| | What it is |
|---|---|
| **"Register"** button, portal header | The entry point to the actual application *form*. Frozen for now — fires a toast, navigates nowhere. Untouched by this change. |
| **"Application"** sidebar item | Not a form. A read-only *summary* of what was submitted, plus Print/PDF. Nothing to summarise until registration happens, so it stays locked. |

### What was already right

Checked before changing anything, rather than assumed:

- **Candidate codes were never minted at signup.** `mint_candidate_code()` is
  called in exactly one place — `application_service.submit()`, behind
  `POST /applications`. `auth_service.py` contains no reference to it. Signup
  cannot produce a code.
- **The data model already separates User from Application.** `profiles` is
  created by the provisioning trigger; `applications` only ever by an explicit
  submission.

So the backend needed no change and no migration. The fault was entirely in
what the frontend implied.

### Sidebar: locked, not hidden

`PortalNavItem` gains `requires?: 'application'`. Overview and Track
application stay open; Application, Interview, and Documents carry the flag.

A locked row is **not a disabled link** — it is not a link at all. Rendering an
`<a>` that goes nowhere leaves it focusable, tabbable, and openable in a new
tab, promising something it cannot deliver. Locked rows render as a plain
element with `aria-disabled`, a padlock, and a tooltip reading *"Available
after you register"*, plus the same text in `sr-only` for screen readers.

**Locked while loading, deliberately.** Unlocked-then-locked flashes doors open
that the user cannot walk through, which reads as a bug; locked-then-unlocked
just reads as settling. `hasRegistered` is therefore `false` until the fetch
resolves, never optimistic.

Hidden was rejected: a candidate who cannot see Interview at all learns nothing
about what is coming. Locked-with-a-reason teaches the process.

### One fetch, not three

Sidebar, overview, and tracker all need the same answer. `useMyApplication()`
fetches on mount, so three consumers meant three identical requests that could
disagree mid-flight. Lifted into `ApplicationProvider`, mounted in
`PortalLayout`.

It also gained an `enabled` flag: `/applications/mine` is candidate-only, and
admins share this layout, so without gating every admin page load fired a
request guaranteed to 403.

### The URL is still typeable

Locking a sidebar row does not lock a route. `RequiresApplication` guards the
three gated paths and renders an explanation rather than redirecting —
bouncing somebody who followed an emailed link to `/dashboard` with no word why
is worse than telling them what the page is and what unlocks it.

### The profile menu crash

```
Base UI: MenuGroupContext is missing.
Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.
```

`DropdownMenuLabel` is Base UI's `Menu.GroupLabel`, and it was used directly
inside `DropdownMenuContent` with no group ancestor to supply the context.

Wrapping it in a `DropdownMenuGroup` would have silenced it in one line. Not
done: that block labels no group of items — it is an account header — so an
empty labelled group would be a lie told to screen readers purely to satisfy a
context check. It is now the plain presentational div it always was.
`DropdownMenuLabel` stays exported for genuine group labels.

Checked the sibling case too: `SelectLabel` / `SelectGroup` have the identical
constraint but are not used anywhere in app code, so there is no second live
instance of this bug.

### ErrorBoundary

New `components/shared/error-boundary.tsx`, a class component because
`getDerivedStateFromError` and `componentDidCatch` have no hook equivalents.
Wrapped around the portal outlet and, separately, the account menu — the one
header control with enough moving parts to fail. The header gets a compact
inline fallback, since dropping a card into a 4rem bar would be worse than the
error.

Reset happens by `key={location.pathname}`, so the boundary remounts on
navigation and discards the error with the instance. The first attempt used
`componentDidUpdate` + a `resetKey` prop; that costs a second render on every
prop change and lint flagged it fairly.

It does not catch event-handler, `setTimeout`, or promise-rejection errors —
none of those pass through render. Async failures stay with `toErrorMessage()`.

### Track application, before registering

Was a bare *"No application to track yet"* dead end. Now renders the same
stepper in demo mode, so the page explains the process instead of looking
broken, with a secondary card saying plainly that registering is what starts it.

### Result

A newly signed-up user sees Overview and Track application working, and
Application, Interview, and Documents locked with a stated reason. No candidate
code anywhere. The Register button is untouched and still inert.

The Application *summary* view and its Print/PDF export are deliberately not
built — the registration form does not exist yet, so its fields are unknown.
Locked state only, by decision; the summary follows once the form does.

### Verified

- Frontend typecheck (`tsc -b --force`), production build, and `oxlint` all clean
- Grep confirms no `Menu.GroupLabel` usage remains outside the primitive, and
  `useMyApplication` now has exactly one caller — the provider
- 38/38 backend tests still pass; no backend change was needed

---

## 2026-08-20 (night, later) — Correction: the journey is five steps, not seven

**Branch:** `waqas`

The seven-stage journey built earlier the same evening was over-specified. The
corrected flow is five visible steps:

```
Application ──> Interview ──> Physical Interview ──> Form ──> Onboarded
```

Two changes, and they are different in kind.

### "Interview Scheduled" and "Interview Completed" become one node

Visually. Not in the database.

Collapsing them in storage as well would have been the obvious reading of the
request, and it would have broken batching. The whole interview workflow — 300
candidates split 50/50/25 across three slots — is a question about *who holds a
slot but has not yet been seen*. One value cannot answer it.

So `INTERVIEW_SCHEDULED` and `INTERVIEWED` both remain, and both map to the
single "Interview" node. `JOURNEY_STEPS` in `lib/stages.ts` now carries a
`stages: readonly ApplicationStage[]` per step, and `STEP_INDEX` is built by
flattening it, so a node can cover any number of stored stages without any page
knowing. Callers still pass an `ApplicationStage`; the mapping happens inside
the stepper.

The guidance panel stays keyed by stored stage, deliberately — "join at your
slot" and "wait for the result" are opposite instructions and cannot share one
message, even though they share one node.

### "Selected" stops being a stage

It was never really one. Clearing the interview is the *condition* for reaching
the physical interview, so the transition into `PHYSICAL_INTERVIEW` already
encodes it.

What the transition cannot encode is which gate stopped somebody, because
`REJECTED` is reachable from several places. `applications.is_selected` records
that, tri-state:

| Value | Meaning |
|---|---|
| `NULL` | Interview not decided yet |
| `true` | Through to the physical interview |
| `false` | Not selected at interview |

A two-state boolean would have made every un-interviewed candidate read as
rejected. The flag is *derived from the transition* in `advance_stage()` rather
than accepted from the caller, so it cannot disagree with the stage it
describes. Rejection from a later gate deliberately leaves `is_selected = true`
standing — they *were* selected; something else stopped them.

### The migration got smaller, not bigger

The earlier seven-stage migration had never been applied, so it was deleted
rather than corrected on top. Replacing it against the *live* schema turned out
to need only two renames:

```sql
alter type public.application_stage rename value 'ASSESSMENT'   to 'PHYSICAL_INTERVIEW';
alter type public.application_stage rename value 'FORM_PENDING' to 'FORM';
alter table public.applications add column if not exists is_selected boolean;
```

`RENAME VALUE` keeps enum positions, so sort order, the default, and the
`(bootcamp_id, stage)` index all survive untouched — none of the type-recreation
dance the seven-stage version needed.

Zero application rows exist, so no data was affected and no sign-off was
required under the standing rule.

### One trap worth recording

Adding `is_selected` to the SQLAlchemy model made it a *blocking* migration,
where the previous one was not. The earlier version changed only enum labels, so
reads kept working against the old schema. This one adds a column, and
SQLAlchemy puts it in every `SELECT` — so `/applications/mine` fails with
`UndefinedColumn` until the migration runs, and the candidate dashboard shows
its error state instead of its empty state.

Verified by querying directly rather than assuming:

```
FAIL: ProgrammingError column applications.is_selected does not exist
```

**The migration is still not applied** — three attempts were refused by the
environment's permission classifier. See *Blocked* in `project-status.md`.

### Changed

| File | Change |
|---|---|
| `supabase/migrations/20260820180000_candidate_journey.sql` | Replaces the deleted seven-stage migration |
| `backend/app/models/enums.py` | `SELECTED` dropped, `FORM_SUBMITTED` → `FORM` |
| `backend/app/models/application.py` | `is_selected` column |
| `backend/app/schemas/application.py` | `is_selected` on `ApplicationOut` |
| `backend/app/services/application_service.py` | Derives `is_selected` in `advance_stage()` |
| `frontend/src/lib/stages.ts` | `JOURNEY_STEPS` with many-to-one stage mapping; `STEP_INDEX`, `TOTAL_STEPS`, `completedSteps` |
| `frontend/src/components/shared/journey-stepper.tsx` | Keys on `step.key`; `earliestStamp()` for multi-stage nodes |
| `frontend/src/features/applications/stage-guidance.ts` | `SELECTED` removed; steps re-cast as places you stand, not events completed |
| `docs/phases.md`, `docs/architecture.md` | Five steps vs seven stages, and why they differ |

Demo mode, real mode, the ring, the connectors, success stories, the typewriter,
and the empty-state hero are all unchanged — only the step list they operate on.

### Verified

- 38/38 backend tests pass
- Frontend typecheck, `oxlint`, and production build all clean
- Repo-wide grep for `SELECTED`, `FORM_SUBMITTED`, `FORM_PENDING`, `ASSESSMENT`,
  `TOTAL_STAGES`, `STAGE_INDEX`, `completedCount` returns only the historical
  Phase 2 migration and the new migration's own rename statements

---

## 2026-08-20 (night) — Candidate dashboard: two states, one stepper

> **Superseded in part.** The seven-stage journey described below was corrected
> to five visible steps the same evening — see the entry above. The stepper,
> empty state, typewriter, countdown, and success stories all survive unchanged;
> only the step list differs.

**Branch:** `waqas`

### The schema was one stage short

The brief called for a seven-stage journey. The enum shipped in the Phase 2
migration had six, and it named two of them for something other than what they
meant:

| Journey stage | Was | Now |
|---|---|---|
| Selected | *(absent)* | `SELECTED` |
| Physical Interview | `ASSESSMENT` | `PHYSICAL_INTERVIEW` |
| Form Submitted | `FORM_PENDING` | `FORM_SUBMITTED` |

The missing value was the real problem. An admin marking a candidate as passed
and that candidate attending an in-person round are separate events days apart,
and collapsing them left the tracker unable to say which had happened.

The two renames came along because `FORM_PENDING` broke the rule every other
value follows — stages record what *happened*, not what is owed — and because
the HR round is a conversation, not a test.

`20260820180000_seven_stage_journey.sql` recreates the type rather than using
`ALTER TYPE ... ADD VALUE`, so `SELECTED` lands in pipeline position rather than
at the end. Enum sort order is declaration order and `order by stage` depends on
it. Confirmed with the user before writing; zero application rows existed, so
the rewrite carried no data risk.

**The migration is written but not applied** — see *Not done* below.

### One stepper, two modes

`components/shared/journey-stepper.tsx` is a single component. The brief asked
for one and the geometry justifies it: node sizing, the connector trick, and
the responsive axis flip are identical in both modes, and only each node's
*state* differs — a single `stepState()` call.

- **`demo`** plays the seven stages through once on mount, then settles with
  every node complete and nothing still animating. The `setInterval` lives in an
  effect whose dependencies are all stable for the life of the mount, so a
  re-render cannot restart it; a reload can, which is the requested behaviour.
- **`real`** never sequences. Progress comes from `STAGE_INDEX[currentStage]`,
  and the current node keeps a persistent rotating ring.

Three implementation notes worth keeping:

**The ring is not a masked border.** A conic-gradient disc sits *behind* an
opaque node and protrudes 3px. Rotating the whole element is a compositor-only
transform; animating a conic gradient's angle would repaint every frame.

**Connectors need no measurement.** Each is anchored at 50% of its own cell and
stretched one full cell backwards, which lands exactly on the previous node's
centre because the cells are `flex-1`. No refs, no resize observer.

**Both scale axes are pinned at both breakpoints.** The layout flips from
vertical to horizontal at `lg`, so a connector left with only `scale-y-0` would
collapse in the other orientation.

Horizontal starts at `lg`, not `md`: with a sidebar, `md` leaves roughly 100px
per node for seven of them, which is cramped. Below `lg` it stacks vertically
instead of scrolling sideways.

### Deadlines the candidate could not read

`PhaseOut` was admin-only, so a candidate had no way to know when their own
interview or form window closed — and the tracker was asked for countdowns.
`ApplicationDetail` now carries `phases`. It costs no extra query (the bootcamp
was already eager-loaded) and no extra request, and exposes only windows and an
open flag — nothing about other applicants.

### Testimonials: grid, not carousel

Each quote types itself out when it scrolls into view. A carousel breaks that:
an off-screen slide never intersects, so its typewriter either never fires or
fires unseen. A grid gives every bubble its own trigger. Reused the existing
`TESTIMONIALS` fixture rather than adding a second set, so real content swaps in
one place. Speakers are gradient initials-avatars, matching the marketing site.

### No new dependencies

Framer Motion is already present as `motion` v13 — the same library under its
current name. The typewriter, the countdown, and the bubble tail are all a few
lines each and were written rather than installed.

### Verified

- 38/38 backend tests pass
- Frontend typecheck, `oxlint`, and production build all clean; every
  `set-state-in-effect` warning in the new code was designed out rather than
  suppressed, by deriving state during render instead of assigning it
- Live server against the real database: `/api/v1/health` returns
  `database: ok`, OpenAPI reports the eight-value enum and `ApplicationDetail`
  carrying `phases`, and `/applications/mine` returns 401 unauthenticated

### Not done

**The migration has not been applied.** Both attempts to run it were refused by
the environment's permission classifier. The backend enum, the frontend types,
and the SQL file now agree on eight values; the live database still has the old
seven. Writing any application row will fail until it is applied.

Nothing committed or pushed — awaiting explicit permission.

---

## 2026-08-20 (late) — Fix: backend would not start outside one directory

**Branch:** `waqas`

Reported as two symptoms: `ModuleNotFoundError: No module named 'app'` when
running `python main.py`, and the frontend showing "Cannot reach the server"
during signup. The second was a consequence of the first — the API was never
running.

### Bug 1 — import path

`app/main.py` uses absolute imports, which require `backend/` on Python's
import path. Running `python main.py` from inside `app/` puts `backend/app/`
there instead, so `import app` finds nothing. `main.py` also had no
`__main__` guard, so it was never a working entry point at all.

Fixed structurally rather than by documenting a workaround. `pyproject.toml`
now declares the package, and `pip install -e .` registers it so `app`
resolves from any working directory. Dependencies stay in `requirements.txt`
via `dynamic = ["dependencies"]`, so the two cannot drift.

`pytest.ini` was folded into `pyproject.toml` at the same time — one less
config file.

### Bug 2 — configuration path, found while investigating

Not reported, but the same class of fault and it would have surfaced next:

```python
env_file=".env"          # resolved against the *current working directory*
```

Starting the server from anywhere but `backend/` silently loaded no settings
and failed with four `Field required` errors — an error describing a symptom
rather than the cause. Confirmed by reproducing it from the repository root.

`ENV_FILE` is now absolute, derived from `config.py`'s own location.

### Also addressed

- **`__main__` guard added**, with host and port read from the environment.
  Hardcoding 8000 meant a second instance could not start without editing
  code — which showed up immediately during testing as `WinError 10013`.
- **CORS widened to include `http://127.0.0.1:5173`.** Browsers treat that as
  a different origin from `localhost:5173`, so serving the frontend on the IP
  form would have been rejected. Applied to `.env` and `.env.example`.

### Verified

All four run commands, each from a clean slate on a free port:

| Command | From | Result |
|---------|------|--------|
| `uvicorn app.main:app --reload` | `backend/` | starts |
| `python -m app.main` | `backend/` | starts |
| `python app/main.py` | `backend/` | starts |
| `python main.py` | `backend/app/` | starts — the originally failing case |

Settings now load from `backend/`, `backend/app/`, `backend/tests/`, and the
repository root.

Live server checks: `/api/v1/health` returns `"database":"ok"`, `/docs`
returns 200, a CORS preflight from `http://localhost:5173` returns the correct
`access-control-allow-origin`, and a real `POST /api/v1/auth/signup` with a
browser `Origin` header returned 201 with the confirmation email sent and the
profile provisioned as `CANDIDATE`. Test user deleted; 38 tests pass.

### Documentation

`README.md` gained a "How to run the backend" section with the exact
directory, command, URLs, and a health-check verification step.
`error-handling.md` gained a startup-failure section mapping each misleading
symptom to its actual cause.

---

## 2026-08-20 (evening) — Phase 2: registration pipeline

**Branch:** `waqas`

Schema approved before writing the migration, per the standing validation rule.
Three decisions were settled first: programs become a seeded database table,
seat limits are deferred, and a candidate may hold one application per intake
across several concurrent intakes.

### Schema — migration `20260820120000_phase2_registration.sql`

Seven new tables: `programs`, `bootcamps`, `bootcamp_programs`,
`bootcamp_admins`, `bootcamp_phases`, `applications`, `stage_transitions`.
Four new enums, all mirroring the frontend's `ApplicationStage` exactly so no
translation layer is needed at the API boundary.

Applied via `supabase db push` — the first migration to use the CLI rather than
the manual pooler route, since the CLI now works.

**Candidate codes are minted by a SQL function, not Python.**
`mint_candidate_code()` increments `bootcamps.next_candidate_seq` inside an
`UPDATE ... RETURNING`, so the row lock guarantees uniqueness. The obvious
`count(*) + 1` approach races: two applicants submitting at the same instant
would both receive `B07-001`.

Verified with 24 concurrent mints across 12 threads, each on its own
connection: 24 unique codes, contiguous `B07-001` … `B07-024`, zero duplicates.
Two-digit intakes format correctly (`B12-001`).

**`bootcamp_programs` kept without a `seats` column.** Capacity was deferred,
but which tracks an intake offered still needs recording — adding `seats` later
is additive, whereas reconstructing that history would be impossible.

**`stage_transitions` written from day one**, including the opening `APPLIED`
entry, so a candidate's timeline starts at submission rather than at the first
admin action.

### Backend

21 endpoints total, 15 new. Models, Pydantic schemas, two services
(`bootcamp_service`, `application_service`), and three route modules.

**Deadline enforcement lives in the service layer**, not the routes, so every
future caller passes the same gate. `is_phase_open()` requires the flag *and*
the clock: an expired deadline closes a phase even if nobody clicked anything.

**Scope enforcement is real, not cosmetic.** `assert_can_manage()` checks
`bootcamp_admins` membership — an admin holding a valid token cannot reach
another intake's candidates by changing the id in the URL.

Reading someone else's application returns **404, not 403** — confirming the row
exists would leak that the id is real.

### Refactor along the way

Routes initially used `db: DbSession = None  # type: ignore` to work around
FastAPI's parameter ordering (a `Depends(...)` default forces every later
parameter to carry one too). Replaced with `AdminUser` / `SuperAdminUser` /
`CandidateUser` annotated aliases in `deps.py`, so callers declare the user as
an ordinary parameter and the placeholder defaults disappear.

### Verified end to end against the live database

Four real users (super admin, admin, two candidates), a real intake, then
deleted. Every assertion passed:

| # | Check | Result |
|---|-------|--------|
| 1 | Programs public endpoint | 5 active |
| 2 | Create bootcamp as SUPER_ADMIN | 201, 4 phases + 2 programs auto-created |
| 3 | Create bootcamp as ADMIN | 403 — super-admin only |
| 4 | Apply while registration closed | 403 `phase_closed` |
| 5 | Open registration | 200 |
| 6 | Public open-intake list | Shows the bootcamp |
| 7 | Candidate 1 applies | 201, code `B07-001`, timeline seeded |
| 8 | Candidate 2 applies | 201, code `B07-002` |
| 9 | Duplicate application | 409 |
| 10 | Program not offered by intake | 409 |
| 11 | Admin lists applicants, unassigned | 403 — scope enforced |
| 12 | Same admin after assignment | 200, both codes returned |
| 13 | Advance stage | 200, timeline grew to 2 |
| 14 | Candidate advances own stage | 403 |
| 15 | Candidate reads another's application | 404, not 403 |
| 16 | Public list after closing registration | 0 intakes |
| 17 | Cleanup | 0 applications, 0 profiles |

38 tests pass, up from 19 — added deadline-boundary tests (including the
exactly-on-the-deadline case) and route-contract tests.

### Not yet wired

The frontend still renders from `lib/mock-data.ts`. These endpoints exist and
work but nothing calls them yet.

---

## 2026-08-20 (later) — Auth UX hardening: signup, login, role foundation

**Branch:** `waqas`

Task brief asked for a full authentication system with bcrypt hashing and
FastAPI-issued JWTs. **Stopped and raised the conflict before building**, since
Phase 1 auth already runs on Supabase Auth — a decision made deliberately after
initially choosing FastAPI-native JWT.

**Outcome:** keep Supabase Auth, build every UX requirement on top. The spec's
actual security intent (never store plaintext) was already satisfied — Supabase
hashes with bcrypt server-side, which is why bcrypt is not a dependency here.
Roles stay `CANDIDATE` / `ADMIN` / `SUPER_ADMIN` rather than renaming to
`STUDENT`; the UI can display "Student" as a label without a database migration
that would touch the enum, provisioning trigger, and RLS policies.

Zero backend rework was needed. All work was frontend.

### Built

**Validation core — one source of truth**

`features/auth/password-rules.ts` defines the five password rules as a single
array. Both the zod schema (which gates submission) and the live checklist
component (which shows what is missing) are built from it, so validation and UI
cannot drift apart and disagree.

`features/auth/schemas.ts` — each name rule is a separate refinement so the user
gets a specific message rather than one catch-all:

| Input | Result |
|-------|--------|
| `Ayesha Siddiqui` | accepted |
| `Anne-Marie O'Brien` | accepted |
| `Md. Rahman Khan` | accepted |
| `Ayesha` | "Please enter both your first and last name" |
| `Ayesha123` | "Name cannot contain numbers" |
| `Ayesha @#$` | "Name cannot contain special characters" |

Name matching is unicode-aware (`\p{L}`) so non-Latin names are not rejected,
and permits the punctuation that legitimately appears in names.

**Reusable components**

- `PasswordStrength` — live checklist plus animated strength meter
- `PasswordInput` — show/hide toggle, `forwardRef` so react-hook-form's ref
  attaches (without it the field never validates). Toggle is `tabIndex={-1}` so
  keyboard users tabbing through the form reach the next field, not the toggle.
- `RoleSelector` — Student selectable, Admin visible but disabled with a
  "Coming soon" lock badge

**Pages**

- Signup: role selector, full name, email, optional phone, password with live
  checklist, confirm password. `mode: 'onChange'` so the checklist and the
  disabled submit button track input in real time. No auto-login on success —
  redirects to `/login` carrying the email so the success notice can render.
- Login: show/hide password, post-signup confirmation banner, honours the
  `from` location so a protected-route bounce returns the user where they were
  headed.
- Dashboard: `Register` button in the portal topbar, candidate-only, shows a
  "Registration opens soon" toast. Inert by design until Phase 2.

### Security note

The role selector sends **nothing** to the API. Self-service signup always
produces `CANDIDATE` server-side; accepting a role from the request body would
be a privilege-escalation hole. `SignupRequest` has no role field and the
provisioning trigger hardcodes the value — both already documented in
`security.md` and left untouched.

### Problem found and fixed

shadcn's generated `sonner.tsx` imports `useTheme` from **next-themes**, which
this project does not use — its `useTheme` would have returned undefined and
toasts would have ignored the active theme entirely. Repointed at this project's
own `ThemeProvider` and removed `next-themes` from dependencies.

### Verified, not assumed

Full round trip against the live backend, using a pre-confirmed user created via
the Admin API and deleted afterward:

| Step | Result |
|------|--------|
| Provisioning trigger | Profile created, `full_name` carried, role `CANDIDATE` |
| Login | 200, tokens plus profile |
| `GET /auth/me` | 200, correct email and role |
| Wrong password | 401 `invalid_credentials` |
| Cleanup | Profile removed by cascade, 0 rows remaining |

Password rules and name validation exercised directly against the schema (table
above). Typecheck clean, production build clean, 19/19 backend tests pass.

---

## 2026-08-20 — Gmail API integration for backend-triggered email

**Branch:** `waqas`

Built the second, separate email system: while Supabase's SMTP config (set up
the previous day) only covers Supabase Auth's own emails, the recruitment
workflow itself — interview invitations, batch results, onboarding links —
needs the backend to send arbitrary custom email. That requires the Gmail API,
not SMTP.

### Setup process, and what went wrong along the way

Walked through Google Cloud Console: create project → enable Gmail API →
configure OAuth consent screen (External, Testing, one test user) → create
OAuth client → obtain a refresh token via the OAuth Playground.

Two real errors hit during setup, both fixed without redoing prior steps:

1. **`redirect_uri_mismatch`** — the first OAuth client was created as
   "Desktop app," which uses a fixed internal redirect that does not match the
   OAuth Playground's callback URL. Fixed by creating a second client as "Web
   application" with the Playground's URL added as an authorized redirect —
   used only for the one-time authorization, not by the backend.
2. **`access_denied` — verification required** — the authorizing account was
   not yet saved to the consent screen's Test users list. Fixed by confirming
   it was added and saved on the correct project.

**Correction to earlier guidance:** initially advised that the backend should
use the *Desktop app* client's credentials for consistency with the one that
completes authorization. This turned out to be unnecessary — the client type
only affects the initial redirect handshake; once a refresh token exists, any
matching `client_id` + `client_secret` + `refresh_token` triple works
regardless of which type issued it. The Web application client's credentials,
already in hand, were used as-is. No rework needed.

### Built

- `app/integrations/gmail_api.py` — token refresh (cached in memory, ~1 hour
  TTL) and `users.messages.send`, both plain `httpx` calls rather than adding
  `google-api-python-client` as a dependency — consistent with how
  `supabase_auth.py` already talks to GoTrue, and avoids that library's heavy
  transitive dependency tree for two HTTP calls
- `app/services/email_service.py` — single choke point Phase 2's routes will
  call; templating and `email_logs` persistence land later, deliberately not
  built ahead of the schema that will drive them
- `EmailNotConfiguredError` (503) — mirrors the existing
  `DatabaseNotConfiguredError` pattern; Gmail settings are optional so the app
  still boots cleanly without them

### Verified, not assumed

Sent a real email through the full path — `email_service.send_email()` →
`gmail_api.send_email()` → live Gmail API call — and got back a real Gmail
message id (`1a01dd3d05ffda30`). Confirmed in the inbox. 19/19 backend tests
still pass.

### Known risk, not yet resolved

The OAuth consent screen is unverified (Testing status), which means Google
expires the refresh token after **7 days** unless the screen is flipped to
Production — a single toggle, not a new setup, since the app has only one
authorized test user and no verification is actually required for that.
**Not yet confirmed done.** See `security.md` for the exact fix.

---

## 2026-08-19 (evening) — Full UI build: marketing site and three portals

**Branch:** `waqas`

Brief: a full-scale professional landing page with its supporting pages and
dropdown navigation, the complete UI for all three portals and their dashboards,
and no compromise on animation.

### Delivered

**25 pages, 33 components, ~10,400 lines.**

| Area | Pages |
|------|-------|
| Marketing | Home, Programs, Program detail, Admissions, About, Success Stories, FAQ, Contact |
| Auth | Login, Signup |
| Candidate portal | Overview, Application, Interview, Documents, Profile |
| Admin portal | Dashboard, Candidates, Interviews, Phases, Emails |
| Super-admin portal | Dashboard, Bootcamps, Administrators, Analytics |

### Foundation built first

- **Design tokens** — full light/dark ramps, brand scale, chart palette, plus
  keyframes for marquee, aurora, shimmer, and float
- **Motion primitives** — `Reveal`, `Stagger`, `Counter`, `Marquee`,
  `PageTransition`; every one honours `prefers-reduced-motion`
- **Theme system** — light/dark/system with an inline pre-paint script in
  `index.html`, so a dark-mode visitor never sees a white flash
- **Portal shell** — collapsible animated sidebar with a `layoutId` active
  indicator, role-driven navigation, mobile drawer

### Animation

Scroll-reveals with directional offsets, staggered lists, count-up statistics,
seamless dual-direction marquees, an animated mega-menu, spring-driven mobile
drawers, route cross-fades, chart entrance animations, hover lift on every card,
and a pulsing live indicator on in-progress batches.

Reduced motion is honoured throughout: content still appears, it simply stops
travelling.

### Problems hit and fixed

**lucide-react no longer ships brand icons.** Facebook, Instagram, LinkedIn, and
YouTube were removed upstream, presumably for trademark reasons. Rather than add
a second icon package for four glyphs, the marks are now local inline SVG in
`components/shared/social-icons.tsx`, using `currentColor` so they inherit theme
and hover states like any other icon.

**Bundle was 1.4 MB.** Recharts alone is ~354 kB and was being downloaded by
candidates who never see a chart. Introduced route-level code splitting with
`React.lazy`, and moved `Suspense` inside the keyed transition element so a lazy
chunk's loading state belongs to the incoming route rather than blanking the
layout.

| | Before | After |
|---|--------|-------|
| Main chunk | 1,411 kB | 498 kB |
| Gzipped | 417 kB | 162 kB |

Recharts now loads only when an admin opens a dashboard.

**Marquee had a visible seam.** The first implementation rendered the children
plus a differently-wrapped duplicate, so the two copies were not the same width
and the -50% translate did not line up. Both copies now use identical wrappers.

### Verified

- Typecheck clean, production build clean
- Preview server serves 200, assets and favicon resolve, document title correct
- Backend untouched: 19/19 tests still pass

### Data

Portal screens render against fixtures in `lib/mock-data.ts`, since the Phase 2
API does not exist yet. The fixture generator uses a **fixed seed** rather than
`Math.random()`, so the candidate table does not reshuffle on every render and
the UI can actually be reviewed. Every export in that module is expected to
become a fetch.

---

## 2026-08-19 (later) — Database live, three real bugs found

**Branch:** `waqas`

### Environment repair

`backend/.env` had the pooler connection string pasted as a bare line, with
`host` / `port` / `database` / `user` following it, while `DATABASE_URL` itself
was still empty. Rewrote the file: the URI is now assigned to `DATABASE_URL` and
the loose lines are gone.

The Supabase CLI is **not reachable** — absent from PATH, and the npm fallback
reports no `win32-x64` binary. Migrations were applied directly over the pooler
connection instead, and the applied version was recorded in
`supabase_migrations.schema_migrations` so a future `supabase db push` will not
re-run it.

### Migration applied

Postgres 17.6. The `public` schema was empty and `auth.users` held zero rows, so
there was nothing to overwrite. Verified after applying: two tables, the
`user_role` enum, `handle_new_user` and `touch_updated_at`, three triggers, RLS
enabled on both tables, and two select-own policies.

### Bug 1 — access tokens are ES256, not HS256

`/auth/me` rejected a token that had just been issued by a successful login.
Decoding the header showed `alg: ES256` with a `kid`.

**This project signs user access tokens with asymmetric keys.** The legacy
`SUPABASE_JWT_SECRET` signs only the API keys (anon and service_role) — which is
exactly why those verified against it earlier and user tokens did not. The
dashboard showing a "JWT Secret" is not evidence that user tokens use it.

`app/core/security.py` now resolves the key by algorithm: JWKS public key for
ES256/RS256, shared secret for HS256, rejection for anything else. Both paths are
supported because a project can be migrated between them without a redeploy.
Added regression tests for `alg: none` and unsupported algorithms.

### Bug 2 — signup failures reported as "invalid credentials"

`_translate()` mapped every 400 and 401 to `InvalidCredentialsError`, so a signup
rejected for an invalid email address told the user their password was wrong.

Rewritten around GoTrue's `error_code`, which is stable and specific, with an
explicit table covering invalid email, weak password, duplicate account,
unconfirmed email, disabled signup, and rate limiting. The status-code fallback
now depends on which operation was called: a 400 from `/token` means bad
credentials, a 400 from `/signup` does not. Four new exception types added.

### Bug 3 — Supabase rejects `example.com`

Not a code bug, but worth recording: GoTrue returns `email_address_invalid` for
`example.com`, and `email-validator` rejects `.local` on our side. Test accounts
need a plausible domain.

### Constraint discovered: built-in email is rate limited

A second signup attempt returned `over_email_send_rate_limit` after a single
prior attempt. Supabase's built-in SMTP allows only a few messages per hour.

**This blocks Phase 2.** The workflow requires batch emails to hundreds of
candidates at every stage gate. A real SMTP provider must be configured in
Supabase before interview batching can work. Ties directly to the open question
about which email provider to use.

### Verified end to end

Created a pre-confirmed user through the Admin API — which sends no email, so it
sidesteps the rate limit — and confirmed:

| Step | Result |
|------|--------|
| `handle_new_user` trigger | Profile row created, `full_name` and `phone` carried from metadata, role `CANDIDATE` |
| Login | 200, tokens plus profile |
| `GET /auth/me` | 200, correct email and role |
| Refresh | 200, new tokens |
| Tampered token | 401 `invalid_token` |
| Wrong password | 401 `invalid_credentials` |
| Logout | 200 |
| Cleanup | User deleted; profile removed by cascade, verified |

19 tests pass. The test user was removed; `auth.users` and `public.profiles` are
both empty again.

---

## 2026-08-19 — Phase 1: authentication and application shell

**Branch:** `waqas`

### Planning

Reviewed the recruitment workflow, confirmed the role hierarchy, and proposed a
folder structure and database schema for validation. Four decisions were settled
before any code was written:

| Decision | Outcome |
|----------|---------|
| Auth strategy | Initially FastAPI-native JWT; **reversed to Supabase Auth** to get password reset and Google OAuth without building them |
| Frontend language | TypeScript |
| Docs location | `/docs` |
| Candidate model | One account, many applications |

The auth reversal has a consequence worth recording: **bcrypt, listed in the
original stack, is now unused.** Supabase hashes passwords.

### Credential verification

The first JWT secret supplied was the default example token from jwt.io —
decoded to `{"sub": "1234567890", "name": "John Doe", "admin": true}`, signed
with the publicly documented secret `a-string-secret-at-least-256-bits-long`.
Rejected before use. Two problems: it is a token rather than a signing key, and
its secret is public.

Real Supabase credentials were then supplied and verified rather than assumed:

- Both keys carry project ref `cfffgnynzqmdzcgljuhx` and the expected roles
- Both signatures validate against the supplied JWT secret
- The secret works as a **raw UTF-8 string**, not base64-decoded, despite the
  trailing `==`. Tested both ways; recorded in `security.md` because this
  detail costs hours when guessed wrong.

The project URL supplied was the REST endpoint
(`.../rest/v1/`) rather than the project base. Rather than only correcting it,
`Settings` now strips `/rest/v1`, `/auth/v1`, and `/storage/v1` suffixes, so the
same mistake cannot break a future deployment.

### Built

**Order:** `.gitignore` first, before any file containing a credential existed,
and verified with `git check-ignore`.

- Backend: layered FastAPI, config, error hierarchy, JWT verification, GoTrue
  client, auth service, role gates, six endpoints
- Migration: `profiles`, `candidate_profiles`, `user_role`, provisioning trigger,
  RLS policies
- Frontend: Vite 8 / React 19 / TypeScript, Tailwind v4, shadcn/ui, router with
  three guard types, auth context, API client, login and signup pages, role
  dashboards
- Tests: 16, covering config normalisation, token verification, and the route
  contract

### Problems hit and fixed

**Invalid token returned 503 instead of 401.** FastAPI resolves all dependencies
before the function body runs, so the database session was constructed — and
failed, since `DATABASE_URL` is unset — before the token was ever decoded. An
auth failure was being masked by an infrastructure failure. Fixed by extracting
`get_token_claims` as its own dependency, declared ahead of the session, so
verification happens first. Caught by a smoke test, not by review.

**shadcn init failed on path aliases.** It reads `tsconfig.json`, which the Vite
template leaves as a bare solution file with no `compilerOptions`. Added
`baseUrl` and `paths` there.

**shadcn omitted theme tokens and `lib/utils`.** The generated components import
`cn` and reference `bg-background`, `text-muted-foreground`, and similar, none of
which existed. Wrote `lib/utils.ts` and a full Tailwind v4 token set — `:root`,
`.dark`, and `@theme inline` — and installed the missing `@base-ui/react` peer.

**`asChild` does not exist on the new shadcn Button.** The `base-nova` style is
built on Base UI, which uses a `render` prop instead. Two call sites updated.

**`baseUrl` is deprecated in TypeScript 6+.** Removed from `tsconfig.app.json`;
`paths` resolves relative to the config file. Kept in `tsconfig.json` because
shadcn's CLI still reads it.

**Vite 8 warned on `__dirname`.** Switched to `import.meta.dirname`.

### Verified

- 16/16 tests pass
- Typecheck clean, production build clean with no warnings
- Live GoTrue call correctly returns and translates `invalid_credentials`
- No `service_role` reference anywhere under `frontend/`

### Not done

Nothing committed or pushed — awaiting explicit permission.

Migration written but **not applied**: `DATABASE_URL` is still outstanding and
the Supabase CLI is not yet installed.

### Deferred, flagged for confirmation

`localStorage` token storage, role-lookup strategy, RLS policy set, the
provisioning trigger, auth traffic routed through FastAPI, and the green primary
colour. All are listed with reversal costs in `project-status.md`.
