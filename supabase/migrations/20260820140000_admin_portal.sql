-- Admin portal: interview scheduling, outbound email history, and an audit trail.
--
-- These three tables are what the admin screens were previously faking with
-- fixtures. Each one records something that cannot be reconstructed later:
-- when an interview was held and how it went, what was emailed to whom, and
-- which administrator changed what.

-- ---------------------------------------------------------------- enums ----
create type public.interview_mode as enum ('ONLINE', 'ONSITE');

-- NO_SHOW is distinct from CANCELLED on purpose: one is the candidate's doing
-- and should count against them, the other is the institute's and should not.
create type public.interview_status as enum (
    'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
);

create type public.email_status as enum ('SENT', 'FAILED');

-- ----------------------------------------------------------- interviews ----
-- Deliberately many-per-application rather than one: a candidate who is
-- rescheduled or re-interviewed keeps the earlier row, so the history of
-- attempts survives. `applications.stage` remains the single source of truth
-- for where the candidate actually is in the pipeline.
create table public.interviews (
    id             uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications (id) on delete cascade,

    scheduled_at     timestamptz not null,
    duration_minutes int         not null default 30 check (duration_minutes between 5 and 480),
    mode             public.interview_mode   not null default 'ONSITE',

    -- Room number when ONSITE, meeting URL when ONLINE. One column because the
    -- two are never both meaningful at once.
    location       text,

    interviewer_id uuid references public.profiles (id) on delete set null,
    status         public.interview_status not null default 'SCHEDULED',

    -- Null until the interview is actually conducted; 0-100 to match how the
    -- assessment sheet is scored.
    score          int check (score is null or score between 0 and 100),
    notes          text,

    -- Free text ("Batch 1", "Morning slot") rather than an enum: the 50/50/25
    -- split is still an open question and may end up per-bootcamp configurable.
    batch_label    text,

    created_by     uuid references public.profiles (id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    -- A completed interview must carry its outcome; a scheduled one must not
    -- pretend to have one.
    constraint interview_score_requires_completion check (
        score is null or status = 'COMPLETED'
    )
);

create index interviews_application_idx on public.interviews (application_id, scheduled_at desc);
create index interviews_schedule_idx    on public.interviews (scheduled_at) where status = 'SCHEDULED';
create index interviews_interviewer_idx on public.interviews (interviewer_id);

-- ------------------------------------------------------------ email log ----
-- Written by the API on every send attempt, successful or not. Exists so an
-- admin can answer "did this candidate actually get the invite?" without
-- access to the sending mailbox.
create table public.email_log (
    id              uuid primary key default gen_random_uuid(),

    -- Both nullable: a broadcast is tied to an intake but not one application,
    -- and an ad-hoc email may be tied to neither. Set null rather than cascade
    -- so deleting an intake never erases proof that mail was sent.
    bootcamp_id     uuid references public.bootcamps (id) on delete set null,
    application_id  uuid references public.applications (id) on delete set null,

    recipient_email text not null,
    subject         text not null,

    -- Template key, not an enum: adding a template should not need a migration.
    template        text,
    body_html       text,

    status              public.email_status not null,
    provider_message_id text,
    error               text,

    sent_by         uuid references public.profiles (id) on delete set null,
    created_at      timestamptz not null default now(),

    -- A failure has no provider id; a success has no error.
    constraint email_outcome_consistent check (
        (status = 'SENT'   and provider_message_id is not null and error is null) or
        (status = 'FAILED' and error is not null)
    )
);

create index email_log_bootcamp_idx    on public.email_log (bootcamp_id, created_at desc);
create index email_log_application_idx on public.email_log (application_id, created_at desc);
create index email_log_recipient_idx   on public.email_log (lower(recipient_email));

-- ---------------------------------------------------------- audit trail ----
-- Every privileged write goes through here. Kept generic (entity_type +
-- entity_id) rather than one table per entity so a new admin action needs a
-- service call, not a schema change.
create table public.audit_logs (
    id          uuid primary key default gen_random_uuid(),
    actor_id    uuid references public.profiles (id) on delete set null,

    -- Dotted verb, e.g. 'bootcamp.update', 'profile.role_change'.
    action      text not null,
    entity_type text not null,
    entity_id   uuid,

    -- Human-readable one-liner for the activity feed, so rendering a log entry
    -- never requires re-fetching the entity it refers to (which may be gone).
    summary     text,

    -- Before/after values, request context. jsonb so it stays queryable.
    metadata    jsonb not null default '{}'::jsonb,

    created_at  timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx  on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx   on public.audit_logs (actor_id, created_at desc);

-- ------------------------------------------------------ updated_at sync ----
create trigger interviews_touch_updated_at
    before update on public.interviews
    for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ RLS ----
-- Same posture as the earlier migrations: deny by default, API bypasses via the
-- service_role key, policies exist so a leaked anon key is useless.
alter table public.interviews enable row level security;
alter table public.email_log  enable row level security;
alter table public.audit_logs enable row level security;

-- A candidate may see their own interview schedule, and nothing else about it.
create policy interviews_select_own
    on public.interviews for select
    to authenticated
    using (
        exists (
            select 1 from public.applications a
            where a.id = interviews.application_id
              and a.profile_id = (select auth.uid())
        )
    );

-- email_log and audit_logs intentionally carry no policies at all: they are
-- staff-only records, readable exclusively through the API's role gates.
