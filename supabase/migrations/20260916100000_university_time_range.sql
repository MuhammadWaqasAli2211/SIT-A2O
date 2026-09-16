-- University class timing: a real time range instead of half-a-day.
--
-- The original column was a three-way choice (Morning/Evening/Weekend). The
-- reason the question is asked at all is to avoid timetabling a bootcamp
-- session against a candidate's classes, and real timetables are 9-2, 2-7,
-- 9-5 — none of which a binary answers honestly.
--
-- Two `time` columns rather than one free-text string: the original comment
-- rejected free text because "9-2", "9 AM - 2 PM" and "morning shift" are a
-- dozen unqueryable spellings of the same thing. Proper times keep the
-- overlap query possible while removing the false choice.
--
-- No backfill: there are no university students on record, so nothing is
-- lost by dropping the old column outright.
alter table applications
  drop constraint if exists applications_university_timing_check,
  drop constraint if exists applications_university_details_complete,
  drop column if exists university_timing,
  add column university_timing_from time,
  add column university_timing_to   time;

-- All four university fields together, or none. Mirrors the model validator.
alter table applications
  add constraint applications_university_details_complete check (
    is_university_student is not true
    or (
      university_name is not null
      and university_semester is not null
      and university_timing_from is not null
      and university_timing_to is not null
    )
  );

comment on column applications.university_timing_from is
  'Start of the candidate''s daily university classes. Paired with '
  'university_timing_to; both null unless is_university_student.';
