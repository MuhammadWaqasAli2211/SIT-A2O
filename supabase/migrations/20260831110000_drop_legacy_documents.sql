-- Retires the pre-onboarding document checklist (CNIC front/back, Photo,
-- Qualification, Bank Letter) — fully superseded by the Documents Hub
-- (onboarding_documents / onboarding_document_type), which asks for a
-- different, more complete set. Confirmed zero rows in `documents` in
-- production before this ran, so nothing real is lost.
--
-- document_status is NOT dropped: onboarding_documents still uses it for
-- its PENDING/ACCEPTED/REJECTED review states.

drop table if exists public.documents;
drop type if exists public.document_type;
