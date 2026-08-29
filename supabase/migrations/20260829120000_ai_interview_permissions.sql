-- AI Interviewer integration: per-admin write permissions, and the
-- correlation key back to the external service's own candidate records.
--
-- Only *write* scopes live here. Read access to the AI Interviewer API is
-- granted to every ADMIN by default (bootcamp-scoped like everything else),
-- so there is nothing to store for it — a row in this table always means
-- "this admin may perform this write", never "this admin may look".
--
-- SUPER_ADMIN is not represented here either: it holds every scope
-- unconditionally, and writing rows to say so would create a second source
-- of truth that could disagree with the role.

-- ---------------------------------------------------------------- enums ----
-- The four write scopes on the external key that a super admin can delegate.
-- Deliberately a native enum rather than free text: adding a fifth grantable
-- power should be a reviewed migration, not a string someone can insert.
--
-- Labels are our own uppercase form, not the external `candidates:write`
-- spelling — app/models/enums.py maps between the two.
create type public.ai_scope as enum (
    'CANDIDATES_WRITE',
    'INTERVIEWS_DELETE',
    'INVITES_SEND',
    'REINTERVIEW_DECIDE'
);

-- ---------------------------------------------------- admin permissions ----
create table public.admin_permissions (
    id          uuid primary key default gen_random_uuid(),
    profile_id  uuid not null references public.profiles (id) on delete cascade,
    scope       public.ai_scope not null,

    -- Who granted it. Nullable so removing a departed super admin's profile
    -- does not cascade away the grants they made, which would silently strip
    -- permissions from admins who are still working.
    granted_by  uuid references public.profiles (id) on delete set null,
    granted_at  timestamptz not null default now(),

    -- One row per (admin, scope): granting twice is a no-op, not a duplicate.
    unique (profile_id, scope)
);

create index admin_permissions_profile_idx on public.admin_permissions (profile_id);

-- ------------------------------------------------- external correlation ----
-- InterviewerAI's own candidate id, captured when an invite is sent so their
-- interviews/reports can be matched back to our application without relying
-- on email alone (an address edited on either side would otherwise break the
-- link silently). Nullable: rows sent before this column existed have none,
-- and the service falls back to an email match for those.
alter table public.interview_invites
    add column external_candidate_id bigint;

create index interview_invites_external_candidate_idx
    on public.interview_invites (external_candidate_id);

-- ------------------------------------------------------------------ RLS ----
-- Deny by default, matching every other table. The API connects with the
-- service_role key and bypasses RLS; this exists so a leaked anon key cannot
-- read or, worse, insert permission grants through PostgREST.
alter table public.admin_permissions enable row level security;
