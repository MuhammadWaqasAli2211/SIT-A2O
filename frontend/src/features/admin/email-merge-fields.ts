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

/**
 * Filled once per Physical Interview batch — see `send_bulk` in
 * physical_interview_service.py. Only offered on that composer: nothing
 * else knows a venue, and there is no second channel telling a candidate
 * where to go, unlike the AI invite's InterviewerAI credentials mail.
 */
export const PHYSICAL_INTERVIEW_MERGE_FIELDS = [
  '$venue',
  '$interview_date',
  '$interview_day',
  '$interview_time',
  '$deadline',
] as const

/**
 * The covering email sent alongside an Agilytics invite.
 *
 * Same shape of problem as the InterviewerAI one above, for a sharper
 * reason: Agilytics's bulk-invite endpoint accepts no body *and returns no
 * tokens* (verified 2026-09-05 against their live API — the response carries
 * only `invitesIssued` and `expiresAt`). So we cannot build an accept URL and
 * cannot send their invitation ourselves. Their system owns that message;
 * this one tells the candidate it is coming, and what it is for.
 *
 * Deliberately does not promise a link or a sender name we have not
 * verified — a covering mail that describes an email the candidate never
 * receives is worse than no covering mail.
 */
export const AGILYTICS_MESSAGE_TEMPLATE =
  '<p>Dear $candidate_name,</p>' +
  '<p>Your onboarding for <strong>$program</strong> ($bootcamp) is complete, and ' +
  'your place on the Agilytics learning platform has been set up. Your candidate ' +
  'code is $candidate_code.</p>' +
  '<p>Agilytics will email you separately at this address with an invitation link ' +
  'to activate your account. <strong>That link expires 7 days after it is sent</strong>, ' +
  'so please activate as soon as it arrives.</p>' +
  '<p>If it has not arrived within a day, check your spam folder before contacting ' +
  'us — we can reissue it.</p>' +
  '<p>— Saylani Admissions</p>'

export const PHYSICAL_INTERVIEW_MESSAGE_TEMPLATE =
  '<p>Dear $candidate_name,</p>' +
  '<p>Congratulations — you have cleared the AI screening interview for ' +
  '<strong>$program</strong> ($bootcamp) and are invited to a Physical Interview.</p>' +
  '<p><strong>Venue:</strong> $venue<br>' +
  '<strong>Date:</strong> $interview_day, $interview_date<br>' +
  '<strong>Time:</strong> $interview_time</p>' +
  '<p>Please bring your CNIC/B-Form and arrive at least 15 minutes early. Your ' +
  'candidate code is $candidate_code.</p>' +
  '<p><strong>Deadline: $deadline.</strong> An outcome must be recorded by ' +
  'this date, or your application will show as having missed this stage.</p>' +
  '<p>— Saylani Admissions</p>'
