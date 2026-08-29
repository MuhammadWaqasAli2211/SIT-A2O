-- Candidate notifications: one row per stage-transition outcome a candidate
-- should be told about (passed a stage / rejected). Addressed by profile_id
-- rather than application_id, matching every other candidate-facing surface
-- (a person may hold more than one application across intakes).

create table public.notifications (
    id          uuid primary key default gen_random_uuid(),
    profile_id  uuid not null references public.profiles (id) on delete cascade,

    -- Kept for context (e.g. deep-linking to the tracker) but nullable: an
    -- application can be deleted without taking the notification history
    -- with it.
    application_id uuid references public.applications (id) on delete set null,

    title       text not null,
    body        text not null,

    read_at     timestamptz,
    created_at  timestamptz not null default now()
);

create index notifications_profile_idx
    on public.notifications (profile_id, created_at desc);

-- ------------------------------------------------------------------ RLS ----
-- Deny by default, matching every other table. The API connects with the
-- service_role key and bypasses RLS; this exists so a leaked anon key
-- cannot read another candidate's notifications directly through PostgREST.
alter table public.notifications enable row level security;
