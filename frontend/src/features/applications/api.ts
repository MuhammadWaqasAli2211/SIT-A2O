import { api } from '@/lib/api-client'
import type { ApplicationStage } from '@/lib/stages'

/** Mirrors ProgramOut in backend/app/schemas/bootcamp.py. */
export interface Program {
  id: string
  slug: string
  title: string
  tagline: string
  description: string | null
  duration: string | null
  mode: string | null
  level: string | null
}

/** Mirrors StageTransitionOut. One row per stage the application has entered. */
export interface StageTransition {
  from_stage: ApplicationStage | null
  to_stage: ApplicationStage
  reason: string | null
  created_at: string
}

export type ApplicationStatus = 'ACTIVE' | 'REJECTED' | 'WITHDRAWN'

export type PhaseType = 'REGISTRATION' | 'INTERVIEW' | 'FORM' | 'ONBOARDING'

/** Mirrors PhaseOut. The deadline windows the candidate is subject to. */
export interface Phase {
  id: string
  phase: PhaseType
  opens_at: string | null
  deadline_at: string | null
  is_open: boolean
}

/** Mirrors ApplicationDetail. */
export interface ApplicationDetail {
  id: string
  candidate_code: string
  bootcamp_id: string
  program_id: string
  stage: ApplicationStage
  status: ApplicationStatus
  /** Interview outcome. `null` until it has been decided. */
  is_selected: boolean | null
  statement: string | null
  applied_at: string
  program: Program
  bootcamp_name: string
  timeline: StageTransition[]
  phases: Phase[]
}

/** Mirrors PublicBootcampOut — the narrow shape shown before you apply. */
export interface OpenBootcamp {
  id: string
  bootcamp_number: number
  name: string
  description: string | null
  starts_at: string | null
  registration_deadline: string | null
  programs: Program[]
}

/** Mirrors ApplicationCreate — the whole registration form in one payload. */
export interface RegistrationPayload {
  bootcamp_id: string
  program_id: string
  full_name: string
  father_name: string
  gender: string
  date_of_birth: string
  city: string
  email: string
  phone: string
  father_phone: string
  cnic?: string | null
  father_cnic: string
  address: string
  saylani_roll_number: string
  prior_course: string
  prior_course_status: string
  campus: string
  computer_proficiency: string
  last_qualification: string
  referral_source: string
  has_laptop: boolean
  terms_version: string
}

/** Mirrors RegistrationResult — what the success modal renders. */
export interface RegistrationResult {
  application_id: string
  candidate_code: string
  bootcamp_name: string
  program_title: string
  email: string
}

export const applicationsApi = {
  async register(payload: RegistrationPayload) {
    const { data } = await api.post<RegistrationResult>('/applications', payload)
    return data
  },
  async mine() {
    const { data } = await api.get<ApplicationDetail[]>('/applications/mine')
    return data
  },
  async get(id: string) {
    const { data } = await api.get<ApplicationDetail>(`/applications/${id}`)
    return data
  },
  async openBootcamps() {
    const { data } = await api.get<OpenBootcamp[]>('/bootcamps/open')
    return data
  },
}

/**
 * When each stage was reached, keyed by stage.
 *
 * Built from the transition log rather than from dated columns on the
 * application, which is why re-entering a stage is representable at all. The
 * *first* entry wins: if an admin corrects a mistake and moves a candidate
 * back and forth, "Interviewed on 12 Sept" should stay the day it happened.
 */
export function stageTimestamps(
  timeline: readonly StageTransition[],
): Partial<Record<ApplicationStage, string>> {
  const stamps: Partial<Record<ApplicationStage, string>> = {}
  for (const entry of [...timeline].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    stamps[entry.to_stage] ??= entry.created_at
  }
  return stamps
}
