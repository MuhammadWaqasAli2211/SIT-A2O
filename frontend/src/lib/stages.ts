/**
 * The candidate journey — one definition, used everywhere.
 *
 * Five steps are visible to a candidate:
 *
 *     Application -> Interview -> Physical Interview -> Form -> Onboarded
 *
 * The database stores more than five values, and the extra ones are not
 * clutter. `INTERVIEW_SCHEDULED` and `AI-INTERVIEWED` are the two halves of the
 * batching workflow: an admin has to be able to ask who has a slot but has not
 * yet been seen. Both collapse into the single "Interview" node here, so the
 * candidate is told one clear thing while the admin keeps the detail.
 *
 * Selection is not a step. Passing the interview is the condition for reaching
 * "Physical Interview"; failing it ends the journey at "Interview".
 *
 * `ApplicationStage` mirrors `public.application_stage` in Postgres and
 * `ApplicationStage` in `backend/app/models/enums.py` exactly. All three change
 * together.
 */

import {
  Bot,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Handshake,
  type LucideIcon,
} from 'lucide-react'

/** What the database stores. Finer-grained than what the stepper renders. */
export type ApplicationStage =
  | 'APPLIED'
  | 'INTERVIEW_SCHEDULED'
  | 'AI-INTERVIEWED'
  | 'PHYSICAL_INTERVIEW'
  | 'FORM'
  | 'ONBOARDED'
  | 'REJECTED'

/** What the stepper renders. One node each. */
export type JourneyStepKey =
  | 'APPLICATION'
  | 'INTERVIEW'
  | 'PHYSICAL_INTERVIEW'
  | 'FORM'
  | 'ONBOARDED'

export interface JourneyStep {
  key: JourneyStepKey
  /** Shown under the node. */
  label: string
  /** One line explaining what happens here, for the demo/explainer mode. */
  blurb: string
  icon: LucideIcon
  /**
   * Stored stages that render as this node. More than one means the step has
   * internal sub-states the candidate is not shown.
   */
  stages: readonly ApplicationStage[]
}

/**
 * The five sequential steps. REJECTED is deliberately absent: it is terminal
 * and sits outside the sequence, so it has no position on a stepper.
 */
export const JOURNEY_STEPS: readonly JourneyStep[] = [
  {
    key: 'APPLICATION',
    label: 'Application',
    blurb: 'You apply to an open bootcamp and receive your candidate code.',
    icon: FileText,
    stages: ['APPLIED'],
  },
  {
    key: 'INTERVIEW',
    label: 'Interview',
    blurb: 'You are given a slot, sit the interview, and wait for the result.',
    icon: Bot,
    stages: ['INTERVIEW_SCHEDULED', 'AI-INTERVIEWED'],
  },
  {
    key: 'PHYSICAL_INTERVIEW',
    label: 'Physical Interview',
    blurb: 'Cleared the interview — a one-to-one with HR at the campus.',
    icon: Handshake,
    stages: ['PHYSICAL_INTERVIEW'],
  },
  {
    key: 'FORM',
    label: 'Form',
    blurb: 'You complete the enrolment form and upload your documents.',
    icon: ClipboardCheck,
    stages: ['FORM'],
  },
  {
    key: 'ONBOARDED',
    label: 'Onboarded',
    blurb: 'Your Agilytic account is live. Classes begin.',
    icon: GraduationCap,
    stages: ['ONBOARDED'],
  },
]

export const TOTAL_STEPS = JOURNEY_STEPS.length

/**
 * Which step a stored stage belongs to, or -1 for REJECTED.
 *
 * -1 rather than undefined so callers can compare numerically without a null
 * check: every sequential stage is `> -1`, and REJECTED never reads as "ahead
 * of" anything.
 */
export const STEP_INDEX: Record<ApplicationStage, number> = {
  ...(Object.fromEntries(
    JOURNEY_STEPS.flatMap((step, index) => step.stages.map((s) => [s, index])),
  ) as Record<ApplicationStage, number>),
  REJECTED: -1,
}

/**
 * Per-stage labels, kept finer-grained than the step labels on purpose.
 *
 * A candidate's stepper says "Interview"; an admin's candidate table has to
 * distinguish a booked slot from a completed one, and that table reads from
 * here.
 */
export const STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  'AI-INTERVIEWED': 'AI Interviewed',
  PHYSICAL_INTERVIEW: 'Physical interview',
  FORM: 'Form',
  ONBOARDED: 'Onboarded',
  REJECTED: 'Not selected',
}

export function isRejected(stage: ApplicationStage): stage is 'REJECTED' {
  return stage === 'REJECTED'
}

/** How many steps are fully behind the candidate, for progress readouts. */
export function completedSteps(stage: ApplicationStage): number {
  if (isRejected(stage)) return 0
  return STEP_INDEX[stage]
}

/** The step a candidate is standing on, for headings and summaries. */
export function currentStep(stage: ApplicationStage): JourneyStep | null {
  const index = STEP_INDEX[stage]
  return index < 0 ? null : (JOURNEY_STEPS[index] ?? null)
}
