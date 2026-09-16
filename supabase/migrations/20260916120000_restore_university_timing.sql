-- Restores `applications.university_timing`, which the backend model,
-- schema, service, and the frontend registration form all still depend on,
-- but which is missing from this database. `university_timing_from` and
-- `university_timing_to` (time-of-day columns) exist instead, unreferenced
-- by any application code anywhere in the repo, and are left untouched here
-- pending a decision on whether that redesign is the intended direction —
-- see the conversation this migration came from for the full history.
--
-- Every query joining onto `applications` (HR Assessment among them) was
-- failing outright with `UndefinedColumn: university_timing does not exist`
-- until this ran, so this restores exactly what the original migration
-- (20260827054856_university_and_id_document.sql) added.

alter table public.applications
    add column if not exists university_timing text;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'applications_university_timing_check'
    ) then
        alter table public.applications
            add constraint applications_university_timing_check
            check (university_timing is null
                   or university_timing in ('Morning', 'Evening', 'Weekend'));
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'applications_university_details_complete'
    ) then
        alter table public.applications
            add constraint applications_university_details_complete
            check (
                is_university_student is not true
                or (university_name is not null
                    and university_semester is not null
                    and university_timing is not null)
            );
    end if;
end
$$;
