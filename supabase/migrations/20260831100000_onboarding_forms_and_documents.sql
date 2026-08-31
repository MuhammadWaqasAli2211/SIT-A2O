-- Onboarding Form submissions and the Documents Hub uploads.
--
-- Both sit behind the same gate: a candidate reaches them only once their
-- application clears the Physical Interview stage (application_stage moves
-- to FORM). Kept as their own tables rather than folded into `documents`,
-- because Educational Documents and Experience Letters hold several files at
-- once, which `documents`' one-row-per-type replace semantics does not
-- support, and because this is a distinct pipeline stage with its own rules.

-- ------------------------------------------------------ onboarding forms ----

create type public.onboarding_form_type as enum (
    'BACKGROUND_VERIFICATION', 'EMPLOYMENT_APPLICATION', 'HALF_NAMA', 'BANK_PAYMENT_DETAILS'
);

-- SUBMITTED is the resting state. REOPENED is an admin sending one form back
-- for correction, which re-locks every form after it in the fixed sequence
-- until the candidate resubmits.
create type public.onboarding_form_status as enum ('SUBMITTED', 'REOPENED');

create table public.onboarding_form_submissions (
    id             uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications (id) on delete cascade,
    form_type      public.onboarding_form_type not null,

    -- The submitted answers. Shape differs per form_type, validated by a
    -- dedicated schema per type in the API before this is ever written.
    submitted_data jsonb not null,

    status         public.onboarding_form_status not null default 'SUBMITTED',

    submitted_at   timestamptz not null default now(),
    submitted_by   uuid references public.profiles (id) on delete set null,

    -- Not cleared on resubmission — kept as a record of the last correction
    -- request. `status` alone says whether one is currently in effect.
    reopened_at    timestamptz,
    reopened_by    uuid references public.profiles (id) on delete set null,
    reopen_note    text,

    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    constraint onboarding_form_reopen_is_recorded check (
        status <> 'REOPENED' or reopened_at is not null
    )
);

-- One submission per form per application. Resubmitting overwrites the row
-- rather than accumulating a history of edits.
create unique index onboarding_form_submissions_one_per_type_idx
    on public.onboarding_form_submissions (application_id, form_type);

create trigger onboarding_form_submissions_touch_updated_at
    before update on public.onboarding_form_submissions
    for each row execute function public.touch_updated_at();

alter table public.onboarding_form_submissions enable row level security;

create policy onboarding_form_submissions_select_own
    on public.onboarding_form_submissions for select
    to authenticated
    using (
        exists (
            select 1 from public.applications a
            where a.id = onboarding_form_submissions.application_id
              and a.profile_id = (select auth.uid())
        )
    );

-- --------------------------------------------------- onboarding documents ----

create type public.onboarding_document_type as enum (
    'PERSONAL_ID_CNIC', 'PERSONAL_ID_BFORM', 'FATHER_CNIC', 'MOTHER_CNIC', 'CV',
    'EDUCATIONAL_CERT', 'EXPERIENCE_LETTER', 'BANK_PROOF', 'EASYPAISA_PROOF'
);

create table public.onboarding_documents (
    id             uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications (id) on delete cascade,
    doc_type       public.onboarding_document_type not null,

    -- Lives in the existing candidate-documents bucket, under an onboarding/
    -- prefix distinct from the earlier pipeline stage's applications/ prefix.
    storage_path   text not null unique,
    file_name      text not null,
    content_type   text not null,
    size_bytes     int  not null check (size_bytes > 0),

    -- Reuses the existing document_status enum: identical PENDING/ACCEPTED/
    -- REJECTED semantics, no reason to mint a duplicate type.
    status         public.document_status not null default 'PENDING',
    review_note    text,
    reviewed_by    uuid references public.profiles (id) on delete set null,
    reviewed_at    timestamptz,

    uploaded_by    uuid references public.profiles (id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    constraint onboarding_document_rejection_has_reason check (
        status <> 'REJECTED' or review_note is not null
    )
);

-- No unique-per-type index, deliberately: EDUCATIONAL_CERT and
-- EXPERIENCE_LETTER hold multiple concurrent rows ("+ Add" / "- Remove" in
-- the UI). The single-file types enforce "one active file per type" at the
-- service layer instead, the same supersede-on-reupload pattern
-- document_service.upload already uses — a DB constraint here would block
-- the multi-file types from ever holding a second row.
create index onboarding_documents_app_type_idx
    on public.onboarding_documents (application_id, doc_type);

create index onboarding_documents_status_idx
    on public.onboarding_documents (status, created_at desc);

create trigger onboarding_documents_touch_updated_at
    before update on public.onboarding_documents
    for each row execute function public.touch_updated_at();

alter table public.onboarding_documents enable row level security;

create policy onboarding_documents_select_own
    on public.onboarding_documents for select
    to authenticated
    using (
        exists (
            select 1 from public.applications a
            where a.id = onboarding_documents.application_id
              and a.profile_id = (select auth.uid())
        )
    );
