-- Marks when an admin has already been notified that a candidate finished
-- their AI interview, so the notification is created once, not on every poll
-- of the candidate's own status. See ai_interview_service.candidate_score —
-- this backend has no scheduler/webhook from InterviewerAI, so detection
-- piggybacks on the candidate's own polling of their result.

alter table public.interview_invites
    add column admin_notified_at timestamptz;
