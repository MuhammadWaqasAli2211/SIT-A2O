/**
 * Placeholder data for the portal UI.
 *
 * The Phase 2 API does not exist yet, so dashboards render against these
 * fixtures. Every export here is expected to be replaced by a fetch — keeping
 * them in one module makes that swap mechanical rather than a hunt.
 */

export type ApplicationStage =
  | 'APPLIED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEWED'
  | 'ASSESSMENT'
  | 'FORM_PENDING'
  | 'ONBOARDED'
  | 'REJECTED'

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEWED: 'Interviewed',
  ASSESSMENT: 'Assessment',
  FORM_PENDING: 'Form pending',
  ONBOARDED: 'Onboarded',
  REJECTED: 'Rejected',
}

export interface CandidateRow {
  id: string
  code: string
  name: string
  email: string
  phone: string
  program: string
  stage: ApplicationStage
  score: number | null
  appliedAt: string
  city: string
}

const FIRST = ['Ayesha', 'Bilal', 'Fatima', 'Usman', 'Zainab', 'Hamza', 'Sana', 'Ali', 'Hira', 'Omar', 'Maryam', 'Danish', 'Noor', 'Saad', 'Iqra', 'Tariq', 'Rabia', 'Faizan', 'Amna', 'Kashif']
const LAST = ['Siddiqui', 'Ahmed', 'Khan', 'Tariq', 'Ali', 'Sheikh', 'Malik', 'Hussain', 'Raza', 'Butt', 'Qureshi', 'Farooq']
const PROGRAMS_SHORT = ['Web & App Dev', 'Mobile Dev', 'Data Science & AI', 'Cloud & DevOps', 'UI/UX Design']
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Multan', 'Hyderabad']
const STAGES: ApplicationStage[] = [
  'APPLIED', 'APPLIED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_SCHEDULED',
  'INTERVIEWED', 'ASSESSMENT', 'FORM_PENDING', 'ONBOARDED', 'REJECTED',
]

/**
 * Deterministic pseudo-random source.
 *
 * Math.random() would reshuffle the table on every render and make the UI
 * impossible to review; a fixed seed keeps the fixture stable across reloads.
 */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function buildCandidates(count: number): CandidateRow[] {
  const rand = seeded(20260819)
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!

  return Array.from({ length: count }, (_, i) => {
    const first = pick(FIRST)
    const last = pick(LAST)
    const stage = pick(STAGES)
    const day = 1 + Math.floor(rand() * 28)

    return {
      id: `app-${i + 1}`,
      code: `B07-${String(i + 1).padStart(3, '0')}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      phone: `03${Math.floor(rand() * 5)}${Math.floor(10000000 + rand() * 89999999)}`.slice(0, 11),
      program: pick(PROGRAMS_SHORT),
      stage,
      score:
        stage === 'APPLIED' || stage === 'INTERVIEW_SCHEDULED'
          ? null
          : Math.round((55 + rand() * 45) * 10) / 10,
      appliedAt: `2026-09-${String(day).padStart(2, '0')}`,
      city: pick(CITIES),
    }
  })
}

export const CANDIDATES = buildCandidates(96)

/* ------------------------------------------------------------- analytics -- */

export const APPLICATIONS_OVER_TIME = [
  { date: 'Sep 01', applications: 24, interviews: 0 },
  { date: 'Sep 05', applications: 78, interviews: 0 },
  { date: 'Sep 09', applications: 143, interviews: 0 },
  { date: 'Sep 13', applications: 201, interviews: 12 },
  { date: 'Sep 17', applications: 268, interviews: 48 },
  { date: 'Sep 21', applications: 322, interviews: 96 },
  { date: 'Sep 25', applications: 389, interviews: 154 },
  { date: 'Sep 29', applications: 441, interviews: 212 },
]

export const FUNNEL = [
  { stage: 'Applied', count: 441 },
  { stage: 'Interviewed', count: 300 },
  { stage: 'Assessed', count: 168 },
  { stage: 'Onboarded', count: 112 },
]

export const PROGRAM_SPLIT = [
  { name: 'Web & App Dev', value: 168, fill: 'var(--color-chart-1)' },
  { name: 'Data Science & AI', value: 104, fill: 'var(--color-chart-2)' },
  { name: 'Mobile Dev', value: 71, fill: 'var(--color-chart-3)' },
  { name: 'UI/UX Design', value: 58, fill: 'var(--color-chart-4)' },
  { name: 'Cloud & DevOps', value: 40, fill: 'var(--color-chart-5)' },
]

export const CITY_SPLIT = [
  { city: 'Karachi', applicants: 186 },
  { city: 'Lahore', applicants: 98 },
  { city: 'Islamabad', applicants: 61 },
  { city: 'Faisalabad', applicants: 43 },
  { city: 'Multan', applicants: 32 },
  { city: 'Hyderabad', applicants: 21 },
]

/* ------------------------------------------------------------- interview -- */

export interface InterviewBatch {
  id: string
  batchNumber: number
  date: string
  slot: string
  capacity: number
  assigned: number
  attended: number
  status: 'scheduled' | 'in_progress' | 'completed'
}

export const INTERVIEW_BATCHES: InterviewBatch[] = [
  { id: 'b1', batchNumber: 1, date: '2026-10-08', slot: '10:00', capacity: 50, assigned: 50, attended: 47, status: 'completed' },
  { id: 'b2', batchNumber: 2, date: '2026-10-08', slot: '11:00', capacity: 50, assigned: 50, attended: 44, status: 'completed' },
  { id: 'b3', batchNumber: 3, date: '2026-10-08', slot: '12:00', capacity: 25, assigned: 25, attended: 25, status: 'completed' },
  { id: 'b4', batchNumber: 4, date: '2026-10-09', slot: '10:00', capacity: 50, assigned: 50, attended: 0, status: 'in_progress' },
  { id: 'b5', batchNumber: 5, date: '2026-10-09', slot: '11:00', capacity: 50, assigned: 38, attended: 0, status: 'scheduled' },
  { id: 'b6', batchNumber: 6, date: '2026-10-09', slot: '12:00', capacity: 25, assigned: 0, attended: 0, status: 'scheduled' },
]

/* ---------------------------------------------------------------- phases -- */

export interface PhaseRow {
  phase: 'REGISTRATION' | 'INTERVIEW' | 'FORM' | 'ONBOARDING'
  label: string
  opensAt: string
  deadlineAt: string
  isOpen: boolean
  progress: number
}

export const PHASES: PhaseRow[] = [
  { phase: 'REGISTRATION', label: 'Registration', opensAt: '2026-09-01', deadlineAt: '2026-09-30', isOpen: true, progress: 92 },
  { phase: 'INTERVIEW', label: 'Interview', opensAt: '2026-10-05', deadlineAt: '2026-10-12', isOpen: false, progress: 0 },
  { phase: 'FORM', label: 'Onboarding form', opensAt: '2026-10-20', deadlineAt: '2026-10-27', isOpen: false, progress: 0 },
  { phase: 'ONBOARDING', label: 'Onboarding', opensAt: '2026-10-28', deadlineAt: '2026-11-01', isOpen: false, progress: 0 },
]

/* ---------------------------------------------------------------- emails -- */

export interface EmailLogRow {
  id: string
  template: string
  recipients: number
  sentAt: string
  status: 'sent' | 'queued' | 'failed'
  openRate: number | null
}

export const EMAIL_LOGS: EmailLogRow[] = [
  { id: 'e1', template: 'Application received', recipients: 441, sentAt: '2026-09-29 14:20', status: 'sent', openRate: 87 },
  { id: 'e2', template: 'Interview invitation — Batch 1', recipients: 50, sentAt: '2026-10-05 09:00', status: 'sent', openRate: 94 },
  { id: 'e3', template: 'Interview invitation — Batch 2', recipients: 50, sentAt: '2026-10-05 09:02', status: 'sent', openRate: 91 },
  { id: 'e4', template: 'Interview invitation — Batch 3', recipients: 25, sentAt: '2026-10-05 09:04', status: 'sent', openRate: 88 },
  { id: 'e5', template: 'Interview reminder', recipients: 125, sentAt: '2026-10-07 18:00', status: 'queued', openRate: null },
  { id: 'e6', template: 'Assessment invitation', recipients: 168, sentAt: '2026-10-14 10:00', status: 'failed', openRate: null },
]

/* ------------------------------------------------------------- bootcamps -- */

export interface BootcampRow {
  id: string
  number: number
  name: string
  admin: string
  status: 'DRAFT' | 'REG_OPEN' | 'INTERVIEWING' | 'COMPLETED'
  applicants: number
  seats: number
  startsAt: string
}

export const BOOTCAMPS: BootcampRow[] = [
  { id: 'bc7', number: 7, name: 'Bootcamp 07 — Autumn 2026', admin: 'Kamran Aslam', status: 'REG_OPEN', applicants: 441, seats: 300, startsAt: '2026-11-01' },
  { id: 'bc6', number: 6, name: 'Bootcamp 06 — Spring 2026', admin: 'Sadia Nawaz', status: 'INTERVIEWING', applicants: 512, seats: 300, startsAt: '2026-05-01' },
  { id: 'bc5', number: 5, name: 'Bootcamp 05 — Autumn 2025', admin: 'Kamran Aslam', status: 'COMPLETED', applicants: 478, seats: 280, startsAt: '2025-11-01' },
  { id: 'bc4', number: 4, name: 'Bootcamp 04 — Spring 2025', admin: 'Rehan Yousuf', status: 'COMPLETED', applicants: 401, seats: 250, startsAt: '2025-05-01' },
  { id: 'bc8', number: 8, name: 'Bootcamp 08 — Spring 2027', admin: 'Unassigned', status: 'DRAFT', applicants: 0, seats: 320, startsAt: '2027-05-01' },
]

export interface AdminRow {
  id: string
  name: string
  email: string
  bootcamps: string[]
  lastActive: string
  status: 'active' | 'inactive'
}

export const ADMINS: AdminRow[] = [
  { id: 'a1', name: 'Kamran Aslam', email: 'kamran.aslam@saylani.org', bootcamps: ['Bootcamp 07', 'Bootcamp 05'], lastActive: '2 minutes ago', status: 'active' },
  { id: 'a2', name: 'Sadia Nawaz', email: 'sadia.nawaz@saylani.org', bootcamps: ['Bootcamp 06'], lastActive: '1 hour ago', status: 'active' },
  { id: 'a3', name: 'Rehan Yousuf', email: 'rehan.yousuf@saylani.org', bootcamps: ['Bootcamp 04'], lastActive: '3 days ago', status: 'active' },
  { id: 'a4', name: 'Nadia Iqbal', email: 'nadia.iqbal@saylani.org', bootcamps: [], lastActive: '2 months ago', status: 'inactive' },
]

/* ------------------------------------------------- candidate own journey -- */

export const MY_APPLICATION = {
  code: 'B07-142',
  program: 'Web & App Development',
  bootcamp: 'Bootcamp 07 — Autumn 2026',
  appliedAt: '12 August 2026',
  stage: 'ASSESSMENT' as ApplicationStage,
  timeline: [
    { label: 'Application submitted', date: '12 Aug 2026', status: 'done', detail: 'Candidate code B07-142 assigned' },
    { label: 'Screening interview', date: '08 Oct 2026, 11:00', status: 'done', detail: 'Passed · Batch 2 · Score 82.5' },
    { label: 'Physical assessment', date: '16 Oct 2026, 11:00', status: 'active', detail: 'Bahadurabad Campus, Room 204' },
    { label: 'Onboarding form', date: 'Opens 20 Oct 2026', status: 'pending', detail: 'Bank and identity details' },
    { label: 'Enrolment confirmed', date: 'Expected 22 Oct 2026', status: 'pending', detail: 'Class schedule issued' },
  ] as const,
}
