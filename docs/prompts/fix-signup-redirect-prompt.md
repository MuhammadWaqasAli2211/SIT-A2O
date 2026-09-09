# URGENT: Fix signup verification email redirect

## Context

Branch is `huzaifa` (a bug was spotted, work shifted back here). The bug:
when a user signs up, the verification email's confirmation button redirects
to `localhost:3000` instead of the actual frontend dev server
(`localhost:5173`, Vite's default). I already went into the Supabase Auth
URL configuration and changed it to `5173`, but the email still points to
`3000` — same wrong redirect keeps happening.

**Priority: fix this now.** This blocks every new signup, which blocks
testing everything downstream of auth.

---

## Likely root causes — check all of these, in this order, don't stop at the
## first one that looks plausible

1. **Two different settings exist in Supabase, and only one may have been
   changed.** Supabase Auth has a single **Site URL** field *and* a
   separate **Redirect URLs** allow-list. The confirmation email template
   uses the `{{ .SiteURL }}` variable by default — updating the
   Redirect URLs list alone does **not** change what the email link points
   to; the Site URL field specifically has to be `localhost:5173` too.
   Check both, in Supabase Dashboard → Authentication → URL Configuration.

2. **The signup call itself may hardcode a redirect.** Search the codebase
   for `emailRedirectTo` (the `supabase-js` `signUp()` option) — if it's
   set explicitly to `localhost:3000` anywhere in our own code, that
   overrides whatever the dashboard says, dashboard changes would look like
   they're "not working" because they're being silently overridden.

3. **Wrong Supabase project.** Confirm the `.env` values the backend/frontend
   are actually using (`SUPABASE_URL` and the anon key) point to the **same**
   Supabase project whose dashboard settings were just edited. If there's
   more than one Supabase project (e.g. a stale/duplicate one from earlier
   setup), the fix could have been applied to the wrong one.

4. **Custom email template with a hardcoded URL.** If the confirmation
   email template itself was customized (Authentication → Email Templates)
   and someone pasted a literal `http://localhost:3000/...` link instead of
   using the `{{ .ConfirmationURL }}` template variable, no dashboard
   Site-URL change will ever fix it — the template itself needs editing.

5. **Stale test email.** If testing with an email that was already sent
   *before* the Site URL was changed, that link was generated with the old
   value and will always point to `3000` — this isn't a bug, it just needs
   a fresh signup with a new email to test against. Rule this out
   explicitly (trigger a brand-new signup, don't reuse an old email) before
   concluding the fix didn't work.

---

## Also build: a custom signup verification page

Right now the confirmation link presumably lands on a bare/default page (or
directly mid-flow with no dedicated screen). Build a **real, custom
verification landing page** for it instead:

- Fully custom UI, matching the rest of the app's visual language — reuse
  existing theme tokens and the motion primitives already in the codebase
  (`Reveal`, `Stagger`, `Counter`, etc.), not a plain unstyled confirmation
  message.
- Handle all the real states, not just the happy path:
  - **Verifying** — a brief loading/processing state while the token is
    checked (this can be genuinely fast, but should still feel intentional,
    not a flash of blank page).
  - **Success** — clear confirmation the account is verified, with an
    obvious next action (e.g. continue to login, or straight into the
    candidate/admin portal if the session is already established).
  - **Expired/invalid token** — a clear explanation, not a generic error
    screen, plus a way to request a new verification email without having
    to sign up again from scratch.
  - **Already verified** (someone clicks an old link twice) — handle
    gracefully, don't show an error for something that isn't actually wrong.
- This page needs to work for **both roles that go through signup**
  (candidate and any admin accounts provisioned this way) — confirm with me
  if the two should look different or if one shared page is correct.
- Route it properly (a real named route, not a redirect straight into an
  arbitrary existing page) and make sure it's reachable directly from the
  email link once the redirect bug above is actually fixed — verify this
  page as part of the same end-to-end signup test in the constraints below.



If the actual fix requires access only I have — e.g. the Supabase dashboard
itself (if you don't have login access to it), or confirming which of
multiple Supabase projects is the real one — **just say the one thing you
need from me** and I'll do it immediately. Don't guess and route around it
silently if you're blocked on something only I can unblock.

---

## Constraints (standing, same as always)

- No large/structural decision made silently — ask first if this turns out
  to be bigger than a config fix (e.g. if it points to a deeper auth
  misconfiguration).
- **Do not `git commit` or `git push`** anything until I explicitly say so.
- Once fixed, verify with an actual fresh signup end to end — confirmation
  email arrives, link points to the correct running frontend, lands on the
  new custom verification page, and each state (verifying/success/expired/
  already-verified) actually renders correctly, not just "the setting now
  says 5173."

Do your best, and treat this as blocking priority #1 right now.
