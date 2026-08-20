-- Phase 2: the recruitment pipeline.
--
-- `applications` is the spine: one row per person per bootcamp, carrying a
-- candidate code from submission through to onboarding. Everything else either
-- describes the intake (bootcamps, phases, programs) or records what happened
-- to an application (stage_transitions).

-- ---------------------------------------------------------------- enums ----
create type public.bootcamp_status as enum (
    'DRAFT', 'REG_OPEN', 'REG_CLOSED', 'INTERVIEWING',
    'ASSESSING', 'ONBOARDING', 'COMPLETED', 'ARCHIVED'
);

create type public.phase_type as enum (
    'REGISTRATION', 'INTERVIEW', 'FORM', 'ONBOARDING'
);

-- Values mirror ApplicationStage in frontend/src/lib/mock-data.ts exactly,
-- so no translation layer is needed at the API boundary.
create type public.application_stage as enum (
    'APPLIED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED',
    'ASSESSMENT', 'FORM_PENDING', 'ONBOARDED', 'REJECTED'
);

create type public.application_status as enum ('ACTIVE', 'REJECTED', 'WITHDRAWN');

-- ------------------------------------------------------------- programs ----
-- Reference data. Marketing copy (skills, outcomes, curriculum) and the icon
-- deliberately stay in the frontend: icons are React components, and that
-- content changes with the website rather than with the recruitment data.
create table public.programs (
    id          uuid primary key default gen_random_uuid(),
    slug        text        not null unique,
    title       text        not null,
    tagline     text        not null,
    description text,
    duration    text,
    mode        text,
    level       text,
    is_active   boolean     not null default true,
    sort_order  int         not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index programs_active_idx on public.programs (is_active, sort_order);

-- ------------------------------------------------------------ bootcamps ----
create table public.bootcamps (
    id              uuid primary key default gen_random_uuid(),
    bootcamp_number int         not null unique check (bootcamp_number between 1 and 99),
    name            text        not null,
    description     text,
    status          public.bootcamp_status not null default 'DRAFT',
    starts_at       date,

    -- Next sequence number to hand out. Incremented atomically by
    -- mint_candidate_code(); never computed from count(*), which would race.
    next_candidate_seq int      not null default 1 check (next_candidate_seq >= 1),

    created_by      uuid references public.profiles (id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on column public.bootcamps.bootcamp_number is
    'Drives the candidate code prefix: 7 produces B07-001. Capped at 99 because '
    'the code format zero-pads to two digits.';

create index bootcamps_status_idx on public.bootcamps (status);

-- Which tracks this intake offers. No seats column yet — capacity limits were
-- deferred; adding `seats int` here later is additive and safe, whereas
-- backfilling which programs an old intake offered would not be.
create table public.bootcamp_programs (
    bootcamp_id uuid not null references public.bootcamps (id) on delete cascade,
    program_id  uuid not null references public.programs (id) on delete restrict,
    created_at  timestamptz not null default now(),
    primary key (bootcamp_id, program_id)
);

-- A join table rather than an FK on bootcamps: an intake can have co-admins,
-- and an admin can run several intakes. Survives handovers without data loss.
create table public.bootcamp_admins (
    bootcamp_id uuid not null references public.bootcamps (id) on delete cascade,
    profile_id  uuid not null references public.profiles (id) on delete cascade,
    assigned_by uuid references public.profiles (id) on delete set null,
    assigned_at timestamptz not null default now(),
    primary key (bootcamp_id, profile_id)
);

create index bootcamp_admins_profile_idx on public.bootcamp_admins (profile_id);

-- --------------------------------------------------------------- phases ----
create table public.bootcamp_phases (
    id          uuid primary key default gen_random_uuid(),
    bootcamp_id uuid not null references public.bootcamps (id) on delete cascade,
    phase       public.phase_type not null,
    opens_at    timestamptz,
    deadline_at timestamptz,
    is_open     boolean     not null default false,
    closed_by   uuid references public.profiles (id) on delete set null,
    closed_at   timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (bootcamp_id, phase),
    constraint phase_window_ordered check (
        opens_at is null or deadline_at is null or deadline_at > opens_at
    )
);

-- ---------------------------------------------------------- applications ----
create table public.applications (
    id             uuid primary key default gen_random_uuid(),
    bootcamp_id    uuid not null references public.bootcamps (id) on delete cascade,
    profile_id     uuid not null references public.profiles (id) on delete cascade,
    program_id     uuid not null references public.programs (id) on delete restrict,

    candidate_code text not null unique,

    stage          public.application_stage  not null default 'APPLIED',
    status         public.application_status not null default 'ACTIVE',
    statement      text,

    applied_at     timestamptz not null default now(),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    -- One application per person per intake. Applying to a *different*
    -- concurrent bootcamp stays allowed.
    unique (bootcamp_id, profile_id)
);

create index applications_bootcamp_stage_idx on public.applications (bootcamp_id, stage);
create index applications_profile_idx on public.applications (profile_id);
create index applications_program_idx on public.applications (program_id);

comment on column public.applications.candidate_code is
    'Format B07-001. Minted once at insert and never changed: it appears in '
    'emails, on ID cards, and in Agilytic.';

-- Audit trail. Created from day one because stage history cannot be
-- reconstructed after the fact.
create table public.stage_transitions (
    id             uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications (id) on delete cascade,
    from_stage     public.application_stage,
    to_stage       public.application_stage not null,
    actor_id       uuid references public.profiles (id) on delete set null,
    reason         text,
    created_at     timestamptz not null default now()
);

create index stage_transitions_application_idx
    on public.stage_transitions (application_id, created_at desc);

-- ------------------------------------------------- candidate code minting ----
-- Atomic: the UPDATE takes a row lock on the bootcamp, so two applications
-- submitted at the same instant cannot both receive B07-001.
create or replace function public.mint_candidate_code(p_bootcamp_id uuid)
returns text
language plpgsql
as $$
declare
    v_seq    int;
    v_number int;
begin
    update public.bootcamps
       set next_candidate_seq = next_candidate_seq + 1
     where id = p_bootcamp_id
    returning next_candidate_seq - 1, bootcamp_number into v_seq, v_number;

    if v_seq is null then
        raise exception 'Bootcamp % not found', p_bootcamp_id
            using errcode = 'no_data_found';
    end if;

    return 'B' || lpad(v_number::text, 2, '0') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- ------------------------------------------------------ updated_at sync ----
create trigger programs_touch_updated_at
    before update on public.programs
    for each row execute function public.touch_updated_at();

create trigger bootcamps_touch_updated_at
    before update on public.bootcamps
    for each row execute function public.touch_updated_at();

create trigger bootcamp_phases_touch_updated_at
    before update on public.bootcamp_phases
    for each row execute function public.touch_updated_at();

create trigger applications_touch_updated_at
    before update on public.applications
    for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ RLS ----
-- Deny by default, matching the Phase 1 pattern. The API connects with the
-- service_role key and bypasses RLS entirely; these policies exist so a leaked
-- anon key cannot read the tables directly through PostgREST.
--
-- Read-only for end users. All writes go through the API, which enforces
-- deadlines and role scope.
alter table public.programs enable row level security;
alter table public.bootcamps enable row level security;
alter table public.bootcamp_programs enable row level security;
alter table public.bootcamp_admins enable row level security;
alter table public.bootcamp_phases enable row level security;
alter table public.applications enable row level security;
alter table public.stage_transitions enable row level security;

create policy applications_select_own
    on public.applications for select
    to authenticated
    using ((select auth.uid()) = profile_id);

create policy stage_transitions_select_own
    on public.stage_transitions for select
    to authenticated
    using (
        exists (
            select 1 from public.applications a
            where a.id = stage_transitions.application_id
              and a.profile_id = (select auth.uid())
        )
    );

-- ----------------------------------------------------------------- seed ----
-- Mirrors frontend/src/lib/site-data.ts. Slugs are the contract between the
-- two: the frontend maps slug to icon, accent, and curriculum copy.
insert into public.programs (slug, title, tagline, duration, mode, level, sort_order) values
    ('web-development',   'Web & App Development', 'Build production-grade web applications with the MERN stack', '6 months', 'On-campus + Online', 'Beginner friendly',   1),
    ('mobile-development','Mobile Development',    'Ship cross-platform apps for Android and iOS',                 '5 months', 'On-campus',           'Some coding helpful', 2),
    ('data-science',      'Data Science & AI',     'Turn raw data into decisions with Python and machine learning','6 months', 'On-campus + Online', 'Maths basics required',3),
    ('cloud-devops',      'Cloud & DevOps',        'Automate delivery and run infrastructure that scales',         '4 months', 'Online',              'Intermediate',        4),
    ('ui-ux-design',      'UI/UX Design',          'Design products people can actually use',                      '4 months', 'On-campus',           'Beginner friendly',   5);
