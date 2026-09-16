-- A Physical Interview rejection must carry a reason.
--
-- The existing constraint, `physical_interview_rejection_note_only_on_reject`,
-- only enforced one direction: a note may not exist on a row that is not
-- REJECTED. It said nothing about a REJECTED row having one, so a rejection
-- with no reason at all was accepted by the database, by the service and by
-- the API — everything except the admin dialog, whose own `MIN_NOTE` was the
-- only thing requiring it. Any caller that was not that dialog could reject a
-- candidate and leave nothing behind explaining why. Verified against the live
-- constraint 2026-09-15.
--
-- Both directions are now one constraint, replacing the old half of the rule:
--
--   REJECTED        -> a note of at least 4 non-blank characters
--   anything else   -> no note at all
--
-- Four characters matches MIN_REJECTION_NOTE in physical_interview_service and
-- MIN_NOTE in the frontend dialog. Long enough to be a reason rather than a
-- stray keystroke; the point is not the length but that something was written.
--
-- `btrim` so a note of spaces does not pass — that is a blank reason wearing a
-- length. Safe to apply: no existing REJECTED row violates it (checked against
-- production before writing this; there are no rejected rows at all yet).

alter table public.physical_interview_invites
    drop constraint if exists physical_interview_rejection_note_only_on_reject;

alter table public.physical_interview_invites
    add constraint physical_interview_rejection_note_matches_result
    check (
        case
            when result = 'REJECTED'::physical_interview_result
                then rejection_note is not null and length(btrim(rejection_note)) >= 4
            else rejection_note is null
        end
    );

comment on constraint physical_interview_rejection_note_matches_result
    on public.physical_interview_invites is
    'A rejection carries a reason of at least 4 non-blank characters; any '
    'other result carries none. Enforced again in '
    'physical_interview_service.record_result, which fails before any stage '
    'move so the caller gets a readable error rather than an integrity one.';
