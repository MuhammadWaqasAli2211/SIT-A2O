/**
 * The merge-field vocabulary shared by every admin-composed email.
 *
 * Promoted out of `emails-page.tsx` when the interview-invite dialog gained a
 * message composer of its own — two screens offering `$candidate_name` from
 * two private lists is how one of them silently falls behind the backend's
 * actual `_MERGE_FIELDS`. The substitution itself is the backend's
 * (`email_service.render`); this is only what an admin is told they may type.
 */

/** Filled per recipient, by `email_service.render()`. */
export const MERGE_FIELDS = [
  '$candidate_name',
  '$candidate_code',
  '$program',
  '$bootcamp',
  '$email',
] as const

/**
 * Filled once per batch, before the per-recipient pass — see
 * `email_service.render_partial()` and `_send_covering_email` in
 * interview_invite_service.py.
 *
 * Only offered on the invite composer: nothing else knows an interview
 * deadline, and an admin typing these into an ordinary broadcast would get
 * them rendered as empty.
 */
export const INVITE_MERGE_FIELDS = ['$interview_deadline', '$interview_difficulty'] as const

/**
 * The covering email we send alongside InterviewerAI's own credentials mail.
 *
 * It exists because their bulk endpoint accepts a subject and nothing else —
 * there is no body we can hand them — and because the deadline is *ours*:
 * their API has no invite-deadline concept at all (verified 2026-09-01), so
 * this message is the only place a candidate is told when the link stops
 * working.
 */
export const INVITE_MESSAGE_TEMPLATE =
  '<p>Dear $candidate_name,</p>' +
  '<p>You have been invited to sit the AI screening interview for ' +
  '<strong>$program</strong> ($bootcamp). Your candidate code is $candidate_code.</p>' +
  '<p>InterviewerAI has emailed you separately with the link and your one-time ' +
  'login details — check that email to begin.</p>' +
  '<p><strong>Deadline: $interview_deadline.</strong> The interview link stops ' +
  'working after this, and a missed deadline holds your application where it is.</p>' +
  '<p>Question difficulty for this round: $interview_difficulty.</p>' +
  '<p>— Saylani Admissions</p>'
