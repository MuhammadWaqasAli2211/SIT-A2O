-- Candidate document uploads.
--
-- Files live in a private Supabase Storage bucket; this table is the index
-- over them. The row is the source of truth for *what* was uploaded and
-- whether an admin has accepted it — the object in storage is just bytes.
--
-- Deliberately metadata-only: no base64 column. Postgres would happily store
-- the file, but then every listing query drags megabytes through the API.

-- ---------------------------------------------------------------- enums ----
-- The document set Phase 4 onboarding actually asks for. OTHER exists so an
-- admin can request something one-off without a migration.
create type public.document_type as enum (
    'CNIC_FRONT', 'CNIC_BACK', 'PHOTO', 'QUALIFICATION', 'BANK_LETTER', 'OTHER'
);

-- PENDING is the state on upload. An admin moves it on; REJECTED carries a
-- reason so the candidate knows what to re-upload.
create type public.document_status as enum ('PENDING', 'ACCEPTED', 'REJECTED');

-- ------------------------------------------------------------ documents ----
create table public.documents (
    id             uuid primary key default gen_random_uuid(),

    -- Scoped to an application, not just a profile: a candidate in two intakes
    -- may be asked for different papers, and one intake's rejection must not
    -- invalidate the other's.
    application_id uuid not null references public.applications (id) on delete cascade,

    doc_type       public.document_type not null,

    -- Path within the private bucket, e.g. applications/<uuid>/<uuid>.pdf.
    -- Unique so two rows can never point at the same object and disagree
    -- about its status.
    storage_path   text not null unique,

    file_name      text not null,
    content_type   text not null,
    size_bytes     int  not null check (size_bytes > 0),

    status         public.document_status not null default 'PENDING',
    -- Required when REJECTED, meaningless otherwise.
    review_note    text,
    reviewed_by    uuid references public.profiles (id) on delete set null,
    reviewed_at    timestamptz,

    uploaded_by    uuid references public.profiles (id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    constraint document_rejection_has_reason check (
        status <> 'REJECTED' or review_note is not null
    ),
    constraint document_review_is_recorded check (
        status = 'PENDING' or reviewed_at is not null
    )
);

-- One live document per type per application. A re-upload replaces the row
-- rather than accumulating, so "the candidate's CNIC front" is never
-- ambiguous. History of *reviews* lives in audit_logs.
create unique index documents_one_per_type_idx
    on public.documents (application_id, doc_type);

create index documents_status_idx on public.documents (status, created_at desc);

-- ------------------------------------------------------ updated_at sync ----
create trigger documents_touch_updated_at
    before update on public.documents
    for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ RLS ----
-- Same posture as everything else: deny by default, API bypasses with the
-- service_role key, the policy exists so a leaked anon key is useless.
alter table public.documents enable row level security;

-- A candidate may see the index of their own uploads. Reading the file itself
-- still requires a signed URL the API mints, so this grants metadata only.
create policy documents_select_own
    on public.documents for select
    to authenticated
    using (
        exists (
            select 1 from public.applications a
            where a.id = documents.application_id
              and a.profile_id = (select auth.uid())
        )
    );
