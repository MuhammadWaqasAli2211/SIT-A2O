-- Question difficulty and the covering-email body on an invite batch.
--
-- `question_difficulty` is InterviewerAI's own `questionDifficulty`, verified
-- 2026-09-01 against their live API: it is undocumented on /bulk-invites (only
-- on /candidates/{id}/invite) but the shared background worker does honour it
-- per row — a probe row sent with MEDIUM_TO_HARD came back with
-- `question_difficulty_range: "MEDIUM_TO_HARD"` on the created candidate.
-- Stored here as the batch-level record of what was asked for, since their
-- batch object does not echo it back.
--
-- The CHECK pins their three accepted values. A fourth would be silently
-- ignored by their worker and leave us claiming a difficulty that was never
-- applied, which is worse than a refused send.
--
-- `message` is the covering email we send ourselves. InterviewerAI's own mail
-- carries the credentials and cannot be templated by us; ours carries the
-- context — the deadline especially, which their API has no concept of.
alter table public.interview_invite_batches
    add column if not exists question_difficulty text,
    add column if not exists message text;

alter table public.interview_invite_batches
    drop constraint if exists interview_invite_batches_question_difficulty_check;

alter table public.interview_invite_batches
    add constraint interview_invite_batches_question_difficulty_check
    check (
        question_difficulty is null
        or question_difficulty in ('EASY_TO_MEDIUM', 'MEDIUM_TO_HARD', 'EASY_TO_HARD')
    );

comment on column public.interview_invite_batches.question_difficulty is
    'InterviewerAI questionDifficulty for this batch. Undocumented on their '
    'bulk endpoint but verified honoured per row, 2026-09-01.';

comment on column public.interview_invite_batches.message is
    'Body of the covering email we send ourselves, before merge-field '
    'substitution. InterviewerAI sends the credentials mail; this one carries '
    'the deadline, which their API cannot hold.';
