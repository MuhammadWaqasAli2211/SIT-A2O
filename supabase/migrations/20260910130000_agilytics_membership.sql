-- Per-candidate Agilytics membership: when we invited them, and when they
-- actually joined.
--
-- Columns on `applications` rather than a table of their own, unlike
-- `interview_invites` and `physical_interview_invites`. Those are tables
-- because those invites carry real per-invite payload — venue, date,
-- deadline, subject, message, result, rejection note — and one candidate can
-- belong to several distinct batches over time, so the invite is a thing in
-- its own right with its own history.
--
-- An Agilytics invite is none of that. Their `bulk-invite` endpoint takes no
-- arguments, returns no per-candidate result, and there is exactly one
-- workspace per intake. A table whose only columns would be `application_id`
-- and a timestamp is a column. It is also read on every folder card on the
-- Onboarding screen, where a column avoids a join per card.
--
-- Both nullable, and null is meaningful in both cases.

alter table public.applications
    add column if not exists agilytics_invited_at timestamptz,
    add column if not exists agilytics_joined_at timestamptz;

-- Null means "not invited, and still eligible to be". Set only after their
-- per-member lookup confirms the address really is a member of the workspace
-- — `bulk-invite` reports a single aggregate count and never says who, so a
-- stamp written on the strength of that count alone would mark people
-- invited who are not in the workspace at all. Anyone who reached onboarding
-- after the workspace was provisioned is exactly that case: their API has no
-- add-member endpoint, so those candidates 404 on the lookup, stay unstamped,
-- and stay retryable.
comment on column public.applications.agilytics_invited_at is
    'When an Agilytics invite was confirmed for this candidate. Null means '
    'not yet invited and still eligible. Written only after their per-member '
    'onboarding-status lookup confirms membership, never from bulk-invite''s '
    'aggregate count alone.';

-- Null means "has not joined yet". Mirrors their `joinedAt` for a member
-- whose status has reached APPROVED, cached here so the check is made once:
-- students are not enumerated in their workspace-wide response, so learning
-- that one candidate has joined costs one HTTP request, and a stamped row is
-- never asked about again.
comment on column public.applications.agilytics_joined_at is
    'Mirrors Agilytics joinedAt once a member reaches status APPROVED. Null '
    'means not joined yet. Cached because their workspace-wide response '
    'reports students as counts, so each join check is a per-member request.';

-- The invite modal and the join reconciler both scan for "invited, not yet
-- joined" within one intake, which is the only access path either has.
create index if not exists applications_agilytics_membership_idx
    on public.applications (bootcamp_id, agilytics_invited_at, agilytics_joined_at);
