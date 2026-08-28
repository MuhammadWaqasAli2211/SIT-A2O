-- AI interview invites, sent through the InterviewerAI service.
--
-- This is the Phase 2 screening step: a candidate who has applied is invited
-- to a self-service AI interview (no admin-picked time, the candidate takes
-- it whenever). It is deliberately not an `interviews` row — that table
-- means a real scheduled slot, and this has none. `interviews` stays for the
-- Phase 3 physical/HR round instead.
--
-- Two tables because the send is a single API call covering many candidates
-- at once: the batch is what InterviewerAI tracks and what a status poll
-- refreshes, the invite is the per-candidate record an admin actually reads.

-- ---------------------------------------------------------------- enums ----
create type public.invite_batch_status as enum (
    'PENDING', 'SENDING', 'COMPLETED', 'FAILED'
);

-- No result API exists yet (see docs/project-status.md). SENT means the
-- request to InterviewerAI succeeded for this row; it says nothing about
-- whether the candidate went on to take or pass the interview.
create type public.invite_status as enum ('PENDING', 'SENT', 'FAILED');

-- --------------------------------------------------------------- batches ----
create table public.interview_invite_batches (
    id                 uuid primary key default gen_random_uuid(),
    bootcamp_id        uuid not null references public.bootcamps (id) on delete cascade,

    -- InterviewerAI's own id for this batch, from POST /bulk-invites. Used to
    -- poll GET /bulk-invites/{id} for the send-progress refresh.
    external_batch_id  bigint,

    subject            text not null,
    batch_name         text,
    status             public.invite_batch_status not null default 'PENDING',

    total_count        int not null default 0,
    sent_count         int not null default 0,
    failed_count       int not null default 0,

    created_by         uuid references public.profiles (id) on delete set null,
    created_at         timestamptz not null default now(),
    -- Set each time the status poll runs, so the UI can show how fresh the
    -- counts are without a caller having to guess.
    last_polled_at     timestamptz
);

create index interview_invite_batches_bootcamp_idx
    on public.interview_invite_batches (bootcamp_id, created_at desc);

-- -------------------------------------------------------------- invites ----
create table public.interview_invites (
    id             uuid primary key default gen_random_uuid(),
    batch_id       uuid not null references public.interview_invite_batches (id) on delete cascade,

    -- Nullable: a row added by CSV/manual entry for someone outside our own
    -- applicant data (an Instructor, most likely) has no application to point
    -- at.
    application_id uuid references public.applications (id) on delete set null,

    -- Position in the `rows` array sent to InterviewerAI. Their response
    -- reports failures by array index, not by any id of ours, so this is
    -- what a status poll uses to match a failure back to the right row.
    row_index      int not null,

    full_name      text not null,
    email          text not null,
    cnic           text not null,
    category       text not null,
    course_status  text,

    status         public.invite_status not null default 'PENDING',
    error          text,

    created_at     timestamptz not null default now(),

    unique (batch_id, row_index)
);

create index interview_invites_batch_idx on public.interview_invites (batch_id);
create index interview_invites_application_idx on public.interview_invites (application_id);

-- ------------------------------------------------------------------ RLS ----
-- Deny by default, matching every other table. The API connects with the
-- service_role key and bypasses RLS; these policies exist so a leaked anon
-- key cannot read invite data — CNICs among it — directly through PostgREST.
-- No select-own policy: unlike an application, a candidate does not have a
-- product surface that shows them their own invite row today.
alter table public.interview_invite_batches enable row level security;
alter table public.interview_invites enable row level security;
