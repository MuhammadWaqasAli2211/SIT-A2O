-- Every physical interview result recorded before this feature existed was
-- already emailed to the candidate immediately, under the old behaviour.
-- Leaving announced_at null for those rows would make the very first bulk
-- announce re-email every candidate ever decided under the old system —
-- telling someone selected weeks ago that they are selected again.
--
-- Backfilled to decided_at: the moment the old code actually sent the email,
-- which is the honest value for "when this was announced" even though no
-- announce action existed yet to record it under.
update physical_interview_invites
   set announced_at = decided_at
 where result is not null
   and announced_at is null;
