-- University status, and naming the identity document a candidate supplied.
--
-- Two unrelated additions that share a migration because they come from the
-- same pass over the registration form.

-- --------------------------------------------------- identity document ----
--
-- `candidate_profiles.cnic` holds the applicant's own identity number. Until
-- now that was always a CNIC, and was skippable for anyone under 18 — which
-- left a minor's record with no identity number at all.
--
-- It is now always required, but a minor supplies a B-Form instead. Both are
-- 13 digits and both go in the same column, so this records *which* document
-- the number came from. Without it the column would be ambiguous the moment a
-- candidate turns 18 and the age can no longer be inferred from it.

alter table public.candidate_profiles
    add column if not exists id_document_type text;

alter table public.candidate_profiles
    add constraint candidate_profiles_id_document_type_check
    check (id_document_type is null or id_document_type in ('CNIC', 'B_FORM'));

comment on column public.candidate_profiles.id_document_type is
    'Which document `cnic` holds: CNIC for applicants 18 and over, B_FORM for '
    'minors. Nullable only for rows written before this column existed.';

-- ------------------------------------------------------ university status ----
--
-- On `applications` rather than `candidate_profiles`: a semester advances
-- between intakes, so this describes the applicant at the moment they applied,
-- not a durable fact about them. It also sits in the same form section as
-- `computer_proficiency` and `last_qualification`, which are already here.
--
-- Asked so that bootcamp sessions are not timetabled against a candidate's
-- classes.

alter table public.applications
    add column if not exists is_university_student boolean,
    add column if not exists university_name       text,
    add column if not exists university_semester   text,
    add column if not exists university_timing     text;

alter table public.applications
    add constraint applications_university_timing_check
    check (university_timing is null
           or university_timing in ('Morning', 'Evening', 'Weekend'));

-- The three detail columns are meaningless unless the answer was yes, and all
-- three are asked together, so a partially answered block is a bug rather than
-- a state worth representing.
alter table public.applications
    add constraint applications_university_details_complete
    check (
        is_university_student is not true
        or (university_name is not null
            and university_semester is not null
            and university_timing is not null)
    );

comment on column public.applications.is_university_student is
    'Whether the applicant was enrolled at a university when they applied. '
    'The three university_* columns are populated only when this is true.';
