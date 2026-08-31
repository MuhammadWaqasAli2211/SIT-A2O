/**
 * What to tell a candidate sitting at each stored stage, and which deadline
 * applies.
 *
 * Keyed by stage rather than by visible step, because the two interview
 * sub-stages need different messages — "join at your slot" and "wait for the
 * result" are opposite instructions — even though they share one node on the
 * stepper. The candidate reads this panel; the stepper only shows position.
 *
 * The step names read as places you stand, not events you completed: a
 * candidate at PHYSICAL_INTERVIEW has been selected and is *in* the HR round,
 * and one at FORM has the enrolment form open to them.
 */

import type { ApplicationStage } from '@/lib/stages'

export type GuidanceTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger'

/** Which phase window, if any, is counting down while at this stage. */
export type PhaseKey = 'REGISTRATION' | 'INTERVIEW' | 'FORM' | 'ONBOARDING'

export interface StageGuidance {
  headline: string
  body: string
  tone: GuidanceTone
  /** Deadline to count down to, drawn from the application's phase windows. */
  deadlinePhase?: PhaseKey
  deadlineLabel?: string
  action?: { label: string; to: string }
  /** Nothing is required of the candidate; they are waiting on us. */
  waiting?: boolean
}

export const STAGE_GUIDANCE: Record<ApplicationStage, StageGuidance> = {
  APPLIED: {
    headline: 'Application received',
    body:
      'You are in the pool for this intake. Applications are batched and reviewed together, then interview slots go out by email — watch your inbox, including spam.',
    tone: 'info',
    waiting: true,
  },

  INTERVIEW_SCHEDULED: {
    headline: 'Your interview is booked',
    body:
      'Join from the interview page at your allotted slot. Have your candidate code and CNIC to hand. Missing the slot without notice ends the application.',
    tone: 'warning',
    deadlinePhase: 'INTERVIEW',
    deadlineLabel: 'Interview phase closes in',
    action: { label: 'Open interview details', to: '/dashboard/interview' },
  },

  'AI-INTERVIEWED': {
    headline: 'Interview complete — awaiting the result',
    body:
      'Your interview has been recorded and is being reviewed alongside the rest of your batch. Everyone is told at the same time. Clear this and the next step is a physical interview at the campus.',
    tone: 'info',
    waiting: true,
  },

  PHYSICAL_INTERVIEW: {
    headline: 'Selected — physical interview next',
    body:
      'You cleared the interview. The next step is a one-to-one, in-person conversation with HR at the campus — no technical questions, just a chance for both sides to meet. Your date and venue are emailed to you.',
    tone: 'success',
    action: { label: 'View venue and timing', to: '/dashboard/interview' },
  },

  FORM: {
    headline: 'Enrolment form is open to you',
    body:
      'Complete the form and upload your documents before the deadline. Originals of everything you upload must be brought on your first day.',
    tone: 'warning',
    deadlinePhase: 'FORM',
    deadlineLabel: 'Form closes in',
    action: { label: 'Fill the enrolment form', to: '/dashboard/documents' },
  },

  ONBOARDED: {
    headline: 'You are onboarded',
    body:
      'Your Agilytic account is live and your seat is confirmed. Everything you need for your first class is on the documents page.',
    tone: 'success',
    action: { label: 'View joining details', to: '/dashboard/documents' },
  },

  REJECTED: {
    headline: 'Not selected this time',
    body:
      'This application did not progress. Intakes run several times a year and previous applicants are welcome to apply again — many people are accepted on a second attempt.',
    tone: 'danger',
    action: { label: 'See open programs', to: '/programs' },
  },
}

export const TONE_CLASS: Record<GuidanceTone, string> = {
  neutral: 'border-border bg-muted/40',
  info: 'border-info/30 bg-info/5',
  warning: 'border-warning/35 bg-warning/5',
  success: 'border-success/30 bg-success/5',
  danger: 'border-destructive/30 bg-destructive/5',
}

export const TONE_ACCENT: Record<GuidanceTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/20 text-warning-foreground dark:text-warning',
  success: 'bg-success/15 text-success',
  danger: 'bg-destructive/15 text-destructive',
}
