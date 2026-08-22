-- Registration form data.
--
-- The form collects two different kinds of thing, and they belong in two
-- different places:
--
--   * Facts about the *person* — name, parentage, CNIC, contact, address.
--     True regardless of which intake they apply to, and the same facts a
--     second application would ask for again. These extend candidate_profiles,
--     which is why registering can populate the candidate's profile at all.
--
--   * Facts about *this application* — the Saylani course they finished
--     before applying, their proficiency, whether they own a laptop, which
--     declarations they accepted. All specific to one intake and one moment.
--     These go on applications.
--
-- Putting everything on applications would mean a candidate re-entering their
-- father's CNIC for every intake, and leave the profile permanently empty.
-- Putting everything on the profile would lose which intake the answers were
-- given for.
--
-- Two things this migration deliberately does NOT add, because they already
-- exist and work:
--
--   * Candidate code generation. mint_candidate_code() already allocates
--     B07-001 style codes with an UPDATE ... RETURNING row lock, verified
--     race-safe under concurrent load. No sequence or counter table needed.
--
--   * Duplicate prevention. applications already carries
--     unique (bootcamp_id, profile_id), so a second registration for the same
--     intake cannot be inserted. Applying to a *different* concurrent intake
--     stays allowed, which is intended.

-- ----------------------------------------------------- person-level ----
-- candidate_profiles already holds cnic, date_of_birth, city and education.

alter table public.candidate_profiles
    add column if not exists full_name           text,
    add column if not exists father_name         text,
    add column if not exists gender              text,
    add column if not exists phone               text,
    add column if not exists father_phone        text,
    add column if not exists father_cnic         text,
    add column if not exists address             text,
    add column if not exists saylani_roll_number text,
    add column if not exists picture_path        text;

comment on column public.candidate_profiles.father_cnic is
    'Required at registration. The applicant''s own cnic is nullable because '
    'candidates under 18 may not hold one yet; a guardian always does.';

comment on column public.candidate_profiles.picture_path is
    'Object path in storage, not the image itself. Nothing writes this yet — '
    'the upload target is still to be decided.';

alter table public.candidate_profiles
    add constraint candidate_profiles_gender_check
    check (gender is null or gender in ('Male', 'Female'));

alter table public.candidate_profiles
    add constraint candidate_profiles_address_length
    check (address is null or char_length(address) <= 220);

alter table public.candidate_profiles
    add constraint candidate_profiles_roll_number_numeric
    check (saylani_roll_number is null or saylani_roll_number ~ '^\d+$');

-- ------------------------------------------------ application-level ----

alter table public.applications
    add column if not exists prior_course         text,
    add column if not exists prior_course_status  text,
    add column if not exists campus               text,
    add column if not exists computer_proficiency text,
    add column if not exists last_qualification   text,
    add column if not exists referral_source      text,
    add column if not exists has_laptop           boolean,
    add column if not exists terms_accepted_at    timestamptz,
    add column if not exists terms_version        text;

comment on column public.applications.prior_course is
    'The Saylani course the applicant completed before applying. Free text '
    'rather than an FK to programs: these are the public course catalogue, a '
    'different and longer list than the bootcamp tracks in programs.';

-- A deviation from "store a single confirmation flag", and worth the one
-- extra column. A bare timestamp records *that* somebody agreed but not to
-- WHAT — and the declaration text has already been rewritten once. Storing
-- the version keeps the record defensible after the next rewrite.
comment on column public.applications.terms_version is
    'Identifier of the declaration set accepted, e.g. 2026-08-22. Without it '
    'terms_accepted_at cannot say which wording was shown.';

alter table public.applications
    add constraint applications_course_status_check
    check (prior_course_status is null
           or prior_course_status in ('Completed', 'In Progress'));

alter table public.applications
    add constraint applications_proficiency_check
    check (computer_proficiency is null
           or computer_proficiency in ('Beginner', 'Intermediate', 'Advanced'));

-- Accepting the terms is what makes a submission a submission, so the two
-- halves must not drift apart.
alter table public.applications
    add constraint applications_terms_paired
    check ((terms_accepted_at is null) = (terms_version is null));
