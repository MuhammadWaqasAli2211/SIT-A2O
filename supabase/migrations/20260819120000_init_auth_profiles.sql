-- Phase 1: identity layer.
-- Supabase's auth.users owns credentials; these tables own application identity.

-- ---------------------------------------------------------------- enums ----
create type public.user_role as enum ('SUPER_ADMIN', 'ADMIN', 'CANDIDATE');

-- --------------------------------------------------------------- tables ----
create table public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    email       text        not null unique,
    full_name   text,
    phone       text,
    role        public.user_role not null default 'CANDIDATE',
    is_active   boolean     not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.profiles is
    'Application identity for each auth.users row. Role lives here, not in the JWT, '
    'so demotion and deactivation take effect immediately.';

create index profiles_role_idx on public.profiles (role);

create table public.candidate_profiles (
    profile_id     uuid primary key references public.profiles (id) on delete cascade,
    cnic           text unique,
    date_of_birth  date,
    city           text,
    education      text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------ updated_at sync ----
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_touch_updated_at
    before update on public.profiles
    for each row execute function public.touch_updated_at();

create trigger candidate_profiles_touch_updated_at
    before update on public.candidate_profiles
    for each row execute function public.touch_updated_at();

-- --------------------------------------------------- user provisioning ----
-- Every new auth.users row gets a profile. Without this, OAuth sign-ins (Google,
-- planned) would authenticate successfully but have no role and no profile.
-- Self-service signup can only ever produce CANDIDATE; elevated roles are
-- assigned deliberately, never derived from client-supplied metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email, full_name, phone, role)
    values (
        new.id,
        new.email,
        nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
        nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
        'CANDIDATE'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ RLS ----
-- Deny by default. The API connects with the service_role key and bypasses RLS
-- entirely; these policies exist so that a leaked anon key cannot read the
-- tables directly through PostgREST.
--
-- Read-only on purpose: no INSERT/UPDATE/DELETE policy is granted to end users.
-- A self-update policy on profiles would let any candidate set their own
-- role to SUPER_ADMIN. All writes go through the API.
alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;

create policy profiles_select_own
    on public.profiles for select
    to authenticated
    using ((select auth.uid()) = id);

create policy candidate_profiles_select_own
    on public.candidate_profiles for select
    to authenticated
    using ((select auth.uid()) = profile_id);
