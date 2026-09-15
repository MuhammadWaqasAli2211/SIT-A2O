-- Agilytics moved from invite-and-wait to onboard-immediately, and the
-- schema follows.
--
-- The previous model had two timestamps because their API had two events:
-- `bulk-invite` staged a token, the candidate accepted it some time later,
-- and we polled their per-member lookup to notice. `agilytics_invited_at`
-- recorded the first, `agilytics_joined_at` the second, and the gap between
-- them was a real state a candidate could sit in for days.
--
-- Their current API has no such gap. `POST /workspaces/{id}/onboard` makes a
-- student an APPROVED member in the same call, with no token and no
-- acceptance step, so "invited" and "joined" collapse into one event with
-- one timestamp. Nothing is lost in the collapse: there is no longer any
-- moment at which those two facts could differ.
--
-- Safe as a rename rather than an add-and-backfill because nothing was ever
-- stamped in production — the one candidate used to verify duplicate
-- prevention (B07-008, 2026-09-11) was rolled back, and both columns are
-- confirmed empty. A rename also keeps the column's identity for anything
-- holding a reference to it.

-- Drops with the column it covers, so it goes first and explicitly rather
-- than silently as a side effect of the drop below.
drop index if exists public.applications_agilytics_membership_idx;

alter table public.applications
    drop column if exists agilytics_joined_at;

-- Guarded rather than a bare `rename`: re-running a migration is ordinary
-- (this ledger has needed repair before), and `rename column` has no
-- `if exists` form that tolerates the already-renamed case.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'applications'
          and column_name = 'agilytics_invited_at'
    ) then
        alter table public.applications
            rename column agilytics_invited_at to agilytics_onboarded_at;
    end if;
end $$;

-- Covers the case where neither column was ever present.
alter table public.applications
    add column if not exists agilytics_onboarded_at timestamptz;

comment on column public.applications.agilytics_onboarded_at is
    'When this candidate was made an APPROVED member of their intake''s '
    'Agilytics workspace, via POST /workspaces/{id}/onboard. Null means not '
    'yet onboarded. There is no separate "joined" state: their onboard call '
    'creates the membership outright.';

-- The one access path: "who in this intake still needs onboarding", scanned
-- by the onboarding screen and the invite modal.
create index if not exists applications_agilytics_onboarded_idx
    on public.applications (bootcamp_id, agilytics_onboarded_at);


-- Track mapping.
--
-- Their `onboard` call takes a `trackName` string per student and resolves
-- it against tracks that must already exist in the workspace — provisioning
-- no longer creates them. A name matching nothing resolves to a null track
-- *without erroring*, so a mapping that is wholesale wrong looks exactly
-- like success.
--
-- Our program titles are not their track names and there is no reason they
-- should be: ours are marketing copy ("Web & App Development"), theirs are
-- whatever their workspace was configured with ("Web Dev" in their own
-- examples). Guessing a transformation between the two would be a rule that
-- silently rots the first time either side renames anything.
--
-- So it is stored, per program, set by an admin who can see both systems.
-- Null means "send no track" — the student is onboarded ungrouped, which is
-- the honest outcome when nobody has told us what to map to.
alter table public.programs
    add column if not exists agilytics_track_name text;

comment on column public.programs.agilytics_track_name is
    'This program''s track name in Agilytics, sent as trackName when '
    'onboarding students. Null sends no track. Deliberately not derived '
    'from title: an unmatched name is silently ignored by their API, so the '
    'mapping is set explicitly by an admin rather than guessed.';
