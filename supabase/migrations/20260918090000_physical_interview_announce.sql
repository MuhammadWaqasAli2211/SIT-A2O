-- Physical Interview results move to a bulk-announce model, mirroring the
-- AI interview's announce switch: recording a decision advances the
-- application immediately (unchanged), but the candidate-facing email now
-- waits for an explicit admin action instead of firing the moment a result
-- is saved.
--
-- Per-invite, not a single bootcamp-wide timestamp like the AI interview's:
-- Physical Interview decisions are made one candidate at a time as an admin
-- works through a list, not all at once, so "pending announcement" is
-- naturally a per-row state (result is not null, announced_at is null) that
-- accumulates between announce actions, not a single moment everything
-- shares.
alter table physical_interview_invites
  add column announced_at timestamptz;

comment on column physical_interview_invites.announced_at is
  'When the candidate-facing result email was actually sent. Null means the '
  'result is recorded (stage already advanced) but not yet announced - see '
  'physical_interview_service.announce_results.';

create index physical_interview_invites_pending_announce_idx
  on physical_interview_invites (batch_id)
  where result is not null and announced_at is null;
