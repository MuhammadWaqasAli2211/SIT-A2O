-- Physical Interview: bulk invites (venue/date/time, admin-set deadline) and
-- per-candidate results (selected/rejected), for the stage after AI
-- Interview passes and before Onboarding Forms.
--
-- Deliberately not the existing `interviews` table: that one already serves
-- a different, earlier round in practice — its bulk scheduler pulls from
-- APPLIED and advances to INTERVIEW_SCHEDULED, and its "no second
-- concurrent SCHEDULED interview" guard would collide with re-inviting a
-- candidate who missed this round's window. Same two-table split as
-- interview_invite_batches/interview_invites (the AI Interview invite
-- pattern) for the same reason: the send covers many candidates in one
-- action, so the batch is what carries venue/date/time/deadline and the
-- invite is the per-candidate record an admin actually reads and decides.
--
-- "Missed" is deliberately not a stored value, same as
-- interview_invite_batches.deadline_at / is_expired: a batch's deadline_at
-- is a snapshot, and "missed" is derived at read time (now() > deadline_at
-- with no result recorded) rather than written by a scheduler — this
-- project has none.

-- ---------------------------------------------------------------- enums ----
create type public.physical_interview_result as enum ('SELECTED', 'REJECTED');

-- --------------------------------------------------------------- batches ----
create table public.physical_interview_batches (
    id              uuid primary key default gen_random_uuid(),
    bootcamp_id     uuid not null references public.bootcamps (id) on delete cascade,

    venue           text not null,
    interview_date  date not null,
    -- Optional: a batch may cover a whole day rather than one start time.
    start_time      time,

    -- Deadline for recording a result. Snapshotted at send time, the same
    -- way interview_invite_batches.deadline_at is — not read live from any
    -- governing phase, since there is no PHYSICAL_INTERVIEW phase.
    deadline_at     timestamptz not null,

    subject         text not null,
    message         text,

    created_by      uuid references public.profiles (id) on delete set null,
    created_at      timestamptz not null default now()
);

create index physical_interview_batches_bootcamp_idx
    on public.physical_interview_batches (bootcamp_id, created_at desc);

-- -------------------------------------------------------------- invites ----
create table public.physical_interview_invites (
    id             uuid primary key default gen_random_uuid(),
    batch_id       uuid not null references public.physical_interview_batches (id) on delete cascade,
    application_id uuid not null references public.applications (id) on delete cascade,

    sent_at        timestamptz,
    send_failed    boolean not null default false,

    -- Null until an admin records an in-person outcome. "Missed" is not a
    -- value here — see the file header.
    result         public.physical_interview_result,

    -- Admin's own record only, never shown to the candidate. Only
    -- meaningful alongside a REJECTED result.
    rejection_note text,

    decided_at     timestamptz,
    decided_by     uuid references public.profiles (id) on delete set null,

    created_at     timestamptz not null default now(),

    -- Scoped to the batch, not globally per application, so a candidate who
    -- misses one batch's window can be invited again in a later one.
    unique (batch_id, application_id),

    constraint physical_interview_rejection_note_only_on_reject check (
        rejection_note is null or result = 'REJECTED'
    )
);

create index physical_interview_invites_batch_idx
    on public.physical_interview_invites (batch_id);
create index physical_interview_invites_application_idx
    on public.physical_interview_invites (application_id);

-- ------------------------------------------------------------------ RLS ----
-- Deny by default, matching every other table. The API connects with the
-- service_role key and bypasses RLS; these policies exist so a leaked anon
-- key cannot read invite data directly through PostgREST. No select-own
-- policy: the candidate-facing status is served through the API, not a
-- direct read of this table.
alter table public.physical_interview_batches enable row level security;
alter table public.physical_interview_invites enable row level security;
