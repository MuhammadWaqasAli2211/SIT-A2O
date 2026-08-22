/** Mirrors app/models/enums.py — keep both in sync. */
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CANDIDATE: 'CANDIDATE',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface AuthResponse {
  tokens: TokenPair
  profile: Profile | null
}

export interface SignupResponse {
  message: string
  email: string
  email_confirmation_required: boolean
}

/** Shape of every error the API returns; see backend app/main.py handlers. */
export interface ApiError {
  code: string
  message: string
  details?: unknown
}

/** Landing route per role, used after login and by the guards. */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  SUPER_ADMIN: '/super-admin',
  ADMIN: '/admin',
  CANDIDATE: '/dashboard',
}

/* ------------------------------------------------------------ enumerations --
 * Each mirrors the matching StrEnum in backend/app/models/enums.py, which in
 * turn mirrors a Postgres enum. All three must change together.
 */

export const ApplicationStage = {
  APPLIED: 'APPLIED',
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
  INTERVIEWED: 'INTERVIEWED',
  PHYSICAL_INTERVIEW: 'PHYSICAL_INTERVIEW',
  FORM: 'FORM',
  ONBOARDED: 'ONBOARDED',
  REJECTED: 'REJECTED',
} as const
export type ApplicationStage = (typeof ApplicationStage)[keyof typeof ApplicationStage]

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEWED: 'Interviewed',
  PHYSICAL_INTERVIEW: 'Physical interview',
  FORM: 'Form',
  ONBOARDED: 'Onboarded',
  REJECTED: 'Rejected',
}

/** Display order for pipeline views — enum declaration order is the funnel. */
export const STAGE_ORDER: ApplicationStage[] = Object.values(ApplicationStage)

export type ApplicationStatus = 'ACTIVE' | 'REJECTED' | 'WITHDRAWN'

export type BootcampStatus =
  | 'DRAFT'
  | 'REG_OPEN'
  | 'REG_CLOSED'
  | 'INTERVIEWING'
  | 'ASSESSING'
  | 'ONBOARDING'
  | 'COMPLETED'
  | 'ARCHIVED'

export const BOOTCAMP_STATUS_LABEL: Record<BootcampStatus, string> = {
  DRAFT: 'Draft',
  REG_OPEN: 'Registration open',
  REG_CLOSED: 'Registration closed',
  INTERVIEWING: 'Interviewing',
  ASSESSING: 'Assessing',
  ONBOARDING: 'Onboarding',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

export type PhaseType = 'REGISTRATION' | 'INTERVIEW' | 'FORM' | 'ONBOARDING'

export const PHASE_LABEL: Record<PhaseType, string> = {
  REGISTRATION: 'Registration',
  INTERVIEW: 'Interview',
  FORM: 'Onboarding form',
  ONBOARDING: 'Onboarding',
}

export type InterviewMode = 'ONLINE' | 'ONSITE'
export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
}

export type EmailStatus = 'SENT' | 'FAILED'

/* ---------------------------------------------------------------- payloads -- */

/** Envelope returned by every paginated list endpoint. */
export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

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

export interface ProgramAdmin extends Program {
  is_active: boolean
  sort_order: number
  bootcamp_count: number
  application_count: number
}

export interface Phase {
  id: string
  phase: PhaseType
  opens_at: string | null
  deadline_at: string | null
  is_open: boolean
}

export interface Bootcamp {
  id: string
  bootcamp_number: number
  name: string
  description: string | null
  status: BootcampStatus
  starts_at: string | null
  created_at: string
}

export interface BootcampDetail extends Bootcamp {
  programs: Program[]
  phases: Phase[]
  application_count: number
}

export interface ApplicantRow {
  id: string
  candidate_code: string
  full_name: string | null
  email: string
  program_title: string
  stage: ApplicationStage
  status: ApplicationStatus
  applied_at: string
}

export interface StageTransition {
  from_stage: ApplicationStage | null
  to_stage: ApplicationStage
  reason: string | null
  created_at: string
}

export interface AdminApplicationDetail {
  id: string
  candidate_code: string
  bootcamp_id: string
  program_id: string
  stage: ApplicationStage
  status: ApplicationStatus
  statement: string | null
  applied_at: string
  program: Program
  bootcamp_name: string
  bootcamp_number: number
  timeline: StageTransition[]
  full_name: string | null
  email: string
  phone: string | null
  city: string | null
  education: string | null
  date_of_birth: string | null
  interview_count: number
}

export interface Interview {
  id: string
  application_id: string
  scheduled_at: string
  duration_minutes: number
  mode: InterviewMode
  location: string | null
  interviewer_id: string | null
  status: InterviewStatus
  score: number | null
  notes: string | null
  batch_label: string | null
  created_at: string
}

export interface InterviewRow extends Interview {
  candidate_code: string
  candidate_name: string | null
  candidate_email: string
  program_title: string
  interviewer_name: string | null
}

export interface EmailLogEntry {
  id: string
  recipient_email: string
  subject: string
  template: string | null
  status: EmailStatus
  provider_message_id: string | null
  error: string | null
  sent_by_name: string | null
  candidate_code: string | null
  created_at: string
}

export interface EmailSendResult {
  sent: number
  failed: number
  total: number
  failures: string[]
}

export interface UserRow {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  is_active: boolean
  application_count: number
  bootcamp_count: number
  created_at: string
}

export interface UserDetail extends Profile {
  candidate_profile: {
    cnic: string | null
    date_of_birth: string | null
    city: string | null
    education: string | null
  } | null
  application_count: number
  managed_bootcamp_ids: string[]
}

export interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  summary: string | null
  metadata: Record<string, unknown>
  actor_name: string | null
  actor_email: string | null
  created_at: string
}

/* -------------------------------------------------------------- dashboard -- */

export interface StageCount {
  stage: ApplicationStage
  count: number
}

export interface ProgramCount {
  program_id: string
  title: string
  count: number
}

export interface DailyCount {
  day: string
  count: number
}

export interface UpcomingInterview {
  id: string
  application_id: string
  candidate_code: string
  candidate_name: string | null
  scheduled_at: string
  status: InterviewStatus
  location: string | null
}

export interface BootcampStats {
  bootcamp_id: string
  bootcamp_name: string
  bootcamp_number: number
  status: BootcampStatus
  total_applications: number
  active_applications: number
  rejected_applications: number
  onboarded: number
  interviews_scheduled: number
  interviews_completed: number
  interviews_no_show: number
  average_score: number | null
  applications_last_7_days: number
  emails_sent: number
  by_stage: StageCount[]
  by_program: ProgramCount[]
  applications_over_time: DailyCount[]
  upcoming_interviews: UpcomingInterview[]
}

export interface CityCount {
  city: string
  count: number
}

export interface BootcampSummary {
  id: string
  bootcamp_number: number
  name: string
  status: BootcampStatus
  starts_at: string | null
  application_count: number
  admin_count: number
  admin_names: string[]
}

export interface PlatformStats {
  total_bootcamps: number
  active_bootcamps: number
  total_candidates: number
  total_admins: number
  total_applications: number
  total_interviews: number
  emails_sent: number
  by_stage: StageCount[]
  by_program: ProgramCount[]
  by_city: CityCount[]
  applications_over_time: DailyCount[]
  bootcamps: BootcampSummary[]
}

/* -------------------------------------------------------------- documents -- */

export const DocumentType = {
  CNIC_FRONT: 'CNIC_FRONT',
  CNIC_BACK: 'CNIC_BACK',
  PHOTO: 'PHOTO',
  QUALIFICATION: 'QUALIFICATION',
  BANK_LETTER: 'BANK_LETTER',
  OTHER: 'OTHER',
} as const
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType]

export type DocumentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  PENDING: 'Awaiting review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
}

export interface DocumentRecord {
  id: string
  application_id: string
  doc_type: DocumentType
  file_name: string
  content_type: string
  size_bytes: number
  status: DocumentStatus
  review_note: string | null
  reviewed_at: string | null
  created_at: string
}

export interface DocumentRow extends DocumentRecord {
  candidate_code: string
  candidate_name: string | null
}

/** One line of the candidate's upload checklist. */
export interface RequiredDocument {
  doc_type: DocumentType
  label: string
  required: boolean
  document: DocumentRecord | null
}

export interface DocumentLink {
  url: string
  expires_in: number
}

/* ---------------------------------------------------------- candidate view -- */

export interface ApplicationDetail {
  id: string
  candidate_code: string
  bootcamp_id: string
  program_id: string
  stage: ApplicationStage
  status: ApplicationStatus
  statement: string | null
  applied_at: string
  program: Program
  bootcamp_name: string
  timeline: StageTransition[]
}

export interface PublicBootcamp {
  id: string
  bootcamp_number: number
  name: string
  description: string | null
  starts_at: string | null
  registration_deadline: string | null
  programs: Program[]
}
