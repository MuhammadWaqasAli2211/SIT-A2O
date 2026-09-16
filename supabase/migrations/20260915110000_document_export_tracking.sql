-- When this candidate's documents were last sent to an HOD.
--
-- Overwritten on every successful export rather than appended to: the
-- question the Onboarding screen asks is "has this one been sent yet",
-- not "how many times". A per-send history would be a second table and
-- nothing currently reads it, so this is one nullable column.
--
-- Null means never exported, which is what the export modal's "Not yet
-- sent" tab filters on. Set only after the ZIP has been built, uploaded and
-- the email accepted — a failed export leaves it null so the candidate is
-- still offered next time.

alter table public.applications
    add column if not exists documents_exported_at timestamptz;

comment on column public.applications.documents_exported_at is
    'When this candidate''s onboarding documents were last included in a '
    'successful bulk export to an HOD. Null means never sent. Overwritten '
    'per export; no history is kept.';

-- The modal's "Not yet sent" tab scans one intake for null values, which is
-- the only access path this column has.
create index if not exists applications_documents_exported_idx
    on public.applications (bootcamp_id, documents_exported_at);
