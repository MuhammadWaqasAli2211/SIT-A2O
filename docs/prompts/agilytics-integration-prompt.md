# Task: Agilytics API Integration + HR Assessment Page

Branch: `agilytics-api-testing` (already created by me — work there).

## Context

The `PORTAL_AGILYTICS_SECRET` is already in the backend `.env`. The API spec
(pasted in full above) describes **three endpoints on Agilytics's side**,
reachable at base URL **`https://agilytics-preview.vercel.app`** (this
looks like a preview/staging deployment — confirm with me before treating
it as the permanent production endpoint; add it to the backend `.env` as
its own variable, e.g. `AGILYTICS_API_BASE_URL`, rather than hardcoding it
inline anywhere it's called from):

- `POST https://agilytics-preview.vercel.app/api/v1/external/workspaces` —
  provision a workspace (tracks, leads, students) in one call.
- `GET https://agilytics-preview.vercel.app/api/v1/external/workspaces/{id}/onboarding-status[?email=]` —
  workspace-wide or single-member onboarding progress.
- `POST https://agilytics-preview.vercel.app/api/v1/external/workspaces/{id}/bulk-invite` —
  stage invite tokens for all pending members, 7-day expiry.

Every request **we** send to Agilytics must be HMAC-SHA256 signed
(`x-portal-signature` + `x-portal-timestamp` headers, ≤5 minute clock
drift, POST signs the raw JSON body, GET signs the sorted/encoded query
string). This resolves the long-open "Agilytic: API integration or manual
export?" question from earlier in the project — it's API integration, this
is the real spec.

**Security baseline, same standard as the AI Interviewer integration**:
`PORTAL_AGILYTICS_SECRET` lives only in the backend, is never sent to or
computable by the frontend, and every signed request is built and sent
server-side.

---

## Step 0 — Prove the signing works before building anything on top (mandatory, gating)

Signature-scheme bugs fail silently as a bare `403` with no useful detail,
so verify this in isolation first:

1. Write the HMAC-signing utility exactly to spec: raw-body HMAC for
   POST/PUT, sorted-and-URL-encoded-query-string HMAC for GET, timestamp as
   `Date.now()` milliseconds, secret from `PORTAL_AGILYTICS_SECRET`.
2. Unit test the signing function itself against a fixed, known
   input/secret pair so the algorithm's correctness doesn't depend on a
   live network call to verify.
3. Then make one real, live, authenticated call against the actual
   Agilytics API (start with something low-risk/idempotent — the
   onboarding-status GET on a real or throwaway workspace id — not the
   provisioning POST, since that creates real data) and confirm you get a
   real `200`, not a `403`.
4. **Report back to me what you found** — confirmed working end to end,
   or stuck on something — before building the HR Assessment page UI on
   top of an unverified integration.

If step 0 fails and you can't get a real request to succeed, stop and tell
me rather than building the rest of this on a guess that the signing is
probably right.

---

## Step 1 — HR Assessment page (admin + super admin)

A new page in both portals:
- **Admin**: scoped to their own bootcamp, same as every other admin
  screen.
- **Super admin**: platform-wide, filterable by bootcamp — same pattern as
  the other super-admin/admin screen pairs already built.

**Table UI**: match the existing table pages exactly (Candidates,
Completed Interviews) — same list/search/filter conventions, same
component library, not a new table implementation.

### Two special columns, beyond the standard candidate columns

1. **Onboarding form** — a button that opens a **modal** showing that
   specific candidate's onboarding submission, with the **same tabs the
   real onboarding page already has**. Don't rebuild the onboarding form's
   content a second time for this modal — extract/reuse whatever component
   already renders it on the candidate-facing onboarding page, and render
   that same component inside the modal (read-only here — confirm the
   exact permission model below).
2. **Interview results** — a button that opens the **existing Evidence &
   Breakdown modal** already built (large modal, left-rail sections: score,
   question breakdown, evidence). Wire this button to that existing
   component for the given candidate — do not build a second version of
   that modal.

Both modals should only fetch their data when actually opened, matching
the lazy-fetch discipline already established for the evidence modal —
don't preload either modal's data for every row in the table.

### Ask before deciding

- **Permission model for the onboarding-form modal**: is it read-only for
  admin the same way interview evidence is (admin reads, super admin can
  act), or does admin need some action capability here (e.g. approve/
  reject an onboarding submission)? Don't assume either way.
- **The rest of the column set** — beyond the two special buttons, what
  standard columns belong on this page (candidate name/code, bootcamp,
  current stage, something else)? Propose one, but confirm before building.
- **What "HR Assessment" actually rolls up** — is this a new view over the
  same candidate data already shown elsewhere (just recombined with these
  two action columns), or does it represent something distinct? I want to
  make sure this isn't quietly duplicating an existing screen with a new
  name.
- **When does Agilytics provisioning/invite actually trigger** — manually
  from an admin action on this page, or automatically once a candidate
  reaches the onboarded stage? This is a real workflow decision, not a UI
  detail — don't default it silently.
- **Does Agilytics's own onboarding-status become part of our audit
  trail**, or stay a separate external read — same category of question we
  already asked and answered for the AI Interviewer's `audit:read`; decide
  it the same way for consistency, but confirm explicitly since it's a
  different external system.

---

## Animation

Enhanced, professional, smooth, consistent with the rest of the app —
reuse the existing motion primitives (`Reveal`, `Stagger`, `Counter`, etc.)
for table row entrances and modal open/close transitions. Respect
`prefers-reduced-motion` throughout, as established everywhere else.

## Ideas — for you to decide on, not built without sign-off

- A status indicator per row (e.g. "Agilytics: Not started / Invited /
  Provisioned") once the integration is live, so admins can see onboarding
  progress at a glance without opening either modal.
- Surfacing the `bulk-invite` endpoint as a real bulk action from this
  page (invite all pending members for a workspace in one click) once the
  core integration is proven — this maps naturally onto the page's purpose.

## Hard constraints

- **Step 0 is a real gate** — confirm the signing actually works against
  the live API before building the page on top of it.
- No large/structural decision made silently — ask first (see the list
  above, and anything else that comes up).
- **Do not `git commit` or `git push` anything** until I explicitly say so.
- Keep the test suite green; clean production build (0 type errors, 0
  lint errors) before calling anything done.
- Complete this workflow properly end to end — signing verified, both
  portal pages built, both modals wired to existing components, not a
  partial version.

Do your best on this.
