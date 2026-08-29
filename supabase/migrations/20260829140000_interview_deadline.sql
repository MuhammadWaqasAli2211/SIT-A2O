-- Interview invite lifecycle: the deadline an invite was sent under.
--
-- The deadline itself belongs to the intake's INTERVIEW phase
-- (`bootcamp_phases.deadline_at`), which is the existing flag-and-clock
-- gate — this is not a second gating mechanism. What is stored here is the
-- value that phase held *at the moment the batch went out*, snapshotted.
--
-- Snapshotted rather than read live because an admin editing the phase
-- deadline later would otherwise retroactively change the date candidates
-- were emailed, expiring links that were still valid when someone looked at
-- them this morning. The invite is honoured against the date it promised.

alter table public.interview_invite_batches
    add column deadline_at timestamptz;

-- Finding an expired batch is a scan the expiry check runs on every
-- candidate-facing read, so it gets an index rather than a sequential scan
-- once several intakes' worth of batches have accumulated.
create index interview_invite_batches_deadline_idx
    on public.interview_invite_batches (deadline_at);

comment on column public.interview_invite_batches.deadline_at is
    'INTERVIEW phase deadline at send time. After this, the invite link is no '
    'longer honoured by us — InterviewerAI has no invite-expiry concept of its '
    'own (verified against their OpenAPI spec, 2026-08-29), so this is the only '
    'thing enforcing it.';
