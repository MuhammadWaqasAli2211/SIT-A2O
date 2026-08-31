/** Mirrors app/models/enums.py — keep both in sync. */
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CANDIDATE: 'CANDIDATE',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

/** Person-level details captured at registration. Null until somebody registers. */
export interface CandidateProfile {
  full_name: string | null
  father_name: string | null
  gender: string | null
  date_of_birth: string | null
  city: string | null
  phone: string | null
  father_phone: string | null
  cnic: string | null
  father_cnic: string | null
  address: string | null
  saylani_roll_number: string | null
  education: string | null
  picture_path: string | null
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  candidate_profile: CandidateProfile | null
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

/** Endpoints that report an outcome rather than return a resource. */
export interface MessageResponse {
  message: string
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
  'AI-INTERVIEWED': 'AI-INTERVIEWED',
  PHYSICAL_INTERVIEW: 'PHYSICAL_INTERVIEW',
  FORM: 'FORM',
  ONBOARDED: 'ONBOARDED',
  REJECTED: 'REJECTED',
} as const
export type ApplicationStage = (typeof ApplicationStage)[keyof typeof ApplicationStage]

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  'AI-INTERVIEWED': 'AI Interviewed',
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
  has_cnic: boolean
  course_completed: boolean
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

/* ---------------------------------------------------- AI interview invites --
 * InterviewerAI, a third-party service — not our own interviews. It conducts
 * the interview itself once invited; there is no admin-picked time. See
 * docs/project-status.md for how this fits alongside the scheduled
 * (Phase 3) interviews above.
 */

export const InviteCategory = {
  AI: 'AI',
  CLOUD_DATA: 'Cloud & Data Engineering',
  WEB_MOBILE: 'Web and Mobile App Development',
  UI_UX: 'Graphics and UI/UX Design',
  INSTRUCTOR: 'Instructor',
} as const
export type InviteCategory = (typeof InviteCategory)[keyof typeof InviteCategory]

export type InviteBatchStatus = 'PENDING' | 'SENDING' | 'COMPLETED' | 'FAILED'
export type InviteStatus = 'PENDING' | 'SENT' | 'FAILED'

export interface InviteRow {
  id: string
  application_id: string | null
  full_name: string
  email: string
  cnic: string
  category: string
  course_status: string | null
  status: InviteStatus
  error: string | null
}

export interface InviteBatch {
  id: string
  bootcamp_id: string
  subject: string
  batch_name: string | null
  status: InviteBatchStatus
  total_count: number
  sent_count: number
  failed_count: number
  created_at: string
  last_polled_at: string | null
}

export interface InviteBatchDetail extends InviteBatch {
  invites: InviteRow[]
}

export const INVITE_BATCH_STATUS_LABEL: Record<InviteBatchStatus, string> = {
  PENDING: 'Queued',
  SENDING: 'Sending',
  COMPLETED: 'Sent',
  FAILED: 'Failed',
}

/* ------------------------------------------- AI Interviewer: results side --
 * The invite types above cover *sending*. These cover reading back what the
 * external service produced — scores, evidence, reinterview requests.
 *
 * Admin-facing records are typed as loose records on purpose: their API
 * publishes no response schemas, so naming fields here would invent a
 * contract the service has not agreed to. The candidate shape below is the
 * opposite — narrow by design, and mirrors CandidateScore on the backend.
 */

export type AiInterviewStatus =
  | 'not_invited'
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'expired'

/**
 * The only AI-interview data a candidate ever receives. The backend cannot
 * send more than this — see `CandidateScore` in schemas/ai_interview.py.
 */
export interface CandidateScore {
  status: AiInterviewStatus
  score: number | null
  scale: number
  completed_at: string | null
  /** Their own interview deadline, so the portal can count down to it. */
  deadline_at: string | null
  /** Set once the deadline passed without a completed interview. */
  can_explain: boolean
  /** Whether they have already written to the admins about missing it. */
  explanation_sent: boolean
  /** None until completed. score >= AI_PASS_THRESHOLD (see records.ts) — a
   * fact about the number, not an automated verdict. */
  passed: boolean | null
}

/** One record from the external service, shape unverified. */
export type ExternalRecord = Record<string, unknown>

export interface ExternalRecords {
  items: ExternalRecord[]
}

export interface ScoreBand {
  band: string
  count: number
}

export interface AiAnalytics {
  scope: 'platform' | 'bootcamp'
  candidates: number | null
  interviews_completed: number | null
  average_score: number | null
  distribution: ScoreBand[]
}

export interface CompletedInterviewStats {
  total: number
  completed_today: number
  completed_this_week: number
  average_score: number | null
}

export interface CompletedInterviewsPage {
  items: ExternalRecord[]
  stats: CompletedInterviewStats
}

/* -------------------------------------------------- AI write permissions --
 * Only writes are grantable. Every admin can already read, so there is no
 * read scope to hold — see permission_service.py.
 */

export const AiScope = {
  CANDIDATES_WRITE: 'CANDIDATES_WRITE',
  INTERVIEWS_DELETE: 'INTERVIEWS_DELETE',
  INVITES_SEND: 'INVITES_SEND',
  REINTERVIEW_DECIDE: 'REINTERVIEW_DECIDE',
} as const
export type AiScope = (typeof AiScope)[keyof typeof AiScope]

export const AI_SCOPE_LABEL: Record<AiScope, string> = {
  CANDIDATES_WRITE: 'Edit candidate records',
  INTERVIEWS_DELETE: 'Delete AI interviews',
  INVITES_SEND: 'Send AI interview invites',
  REINTERVIEW_DECIDE: 'Decide reinterview requests',
}

export interface AdminGrants {
  profile_id: string
  full_name: string | null
  email: string
  scopes: AiScope[]
}

export interface KeyScopes {
  name: string | null
  company_name: string | null
  scopes: string[]
  rate_limit_per_minute: number | null
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

/** The subset of a candidate's profile an admin's user directory needs. */
export interface CandidateProfileSummary {
  cnic: string | null
  date_of_birth: string | null
  city: string | null
  education: string | null
}

export type UserDetail = Omit<Profile, 'candidate_profile'> & {
  candidate_profile: CandidateProfileSummary | null
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

/* -------------------------------------------------------------- documents --
 * DocumentStatus is the only survivor of the pre-onboarding document
 * checklist (retired 2026-08-31, superseded by the Documents Hub below) — its
 * PENDING/ACCEPTED/REJECTED review states are shared with
 * OnboardingDocumentRecord.
 */

export type DocumentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  PENDING: 'Awaiting review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
}

/* --------------------------------------------------------------- onboarding --
 * Student's Folder: the 4-item Onboarding Form and the Documents Hub. Mirrors
 * backend/app/schemas/onboarding.py.
 */

export const OnboardingFormType = {
  BACKGROUND_VERIFICATION: 'BACKGROUND_VERIFICATION',
  EMPLOYMENT_APPLICATION: 'EMPLOYMENT_APPLICATION',
  HALF_NAMA: 'HALF_NAMA',
  BANK_PAYMENT_DETAILS: 'BANK_PAYMENT_DETAILS',
} as const
export type OnboardingFormType = (typeof OnboardingFormType)[keyof typeof OnboardingFormType]

/** Display order for the sequential checklist — declaration order is the
 *  fixed sequence a candidate must complete them in. */
export const ONBOARDING_FORM_ORDER: OnboardingFormType[] = Object.values(OnboardingFormType)

export const ONBOARDING_FORM_LABEL: Record<OnboardingFormType, string> = {
  BACKGROUND_VERIFICATION: 'Background Verification Form',
  EMPLOYMENT_APPLICATION: 'Employment Application Form',
  HALF_NAMA: 'Half Nama / Oath Form',
  BANK_PAYMENT_DETAILS: 'Bank & Payment Details',
}

/** URL-friendly slug per form, used in the /dashboard/documents/forms/:slug route. */
export const ONBOARDING_FORM_SLUG: Record<OnboardingFormType, string> = {
  BACKGROUND_VERIFICATION: 'background-verification',
  EMPLOYMENT_APPLICATION: 'employment-application',
  HALF_NAMA: 'half-nama',
  BANK_PAYMENT_DETAILS: 'bank-payment',
}
export const ONBOARDING_FORM_BY_SLUG: Record<string, OnboardingFormType> = Object.fromEntries(
  Object.entries(ONBOARDING_FORM_SLUG).map(([type, slug]) => [slug, type as OnboardingFormType]),
)

export type OnboardingFormStatus = 'SUBMITTED' | 'REOPENED'

export interface OnboardingFormSubmission {
  id: string
  application_id: string
  form_type: OnboardingFormType
  submitted_data: Record<string, unknown>
  status: OnboardingFormStatus
  submitted_at: string
  reopened_at: string | null
  reopen_note: string | null
}

export interface OnboardingFormRow {
  form_type: OnboardingFormType
  submission: OnboardingFormSubmission | null
  unlocked: boolean
}

export interface OnboardingProgress {
  forms_submitted: number
  forms_total: number
  hub_unlocked: boolean
}

export const OnboardingDocumentType = {
  PERSONAL_ID_CNIC: 'PERSONAL_ID_CNIC',
  PERSONAL_ID_BFORM: 'PERSONAL_ID_BFORM',
  FATHER_CNIC: 'FATHER_CNIC',
  MOTHER_CNIC: 'MOTHER_CNIC',
  CV: 'CV',
  EDUCATIONAL_CERT: 'EDUCATIONAL_CERT',
  EXPERIENCE_LETTER: 'EXPERIENCE_LETTER',
  BANK_PROOF: 'BANK_PROOF',
  EASYPAISA_PROOF: 'EASYPAISA_PROOF',
} as const
export type OnboardingDocumentType = (typeof OnboardingDocumentType)[keyof typeof OnboardingDocumentType]

export interface OnboardingDocumentRecord {
  id: string
  application_id: string
  doc_type: OnboardingDocumentType
  file_name: string
  content_type: string
  size_bytes: number
  status: DocumentStatus
  review_note: string | null
  reviewed_at: string | null
  created_at: string
}

/** One tab of the Documents Hub — `documents` is a list (not one optional
 *  record) because EDUCATIONAL_CERT and EXPERIENCE_LETTER hold several. */
export interface RequiredOnboardingDocument {
  doc_type: OnboardingDocumentType
  label: string
  required: boolean
  multi: boolean
  documents: OnboardingDocumentRecord[]
}

export interface OnboardingDocumentLink {
  url: string
  expires_in: number
}

/** One row of the admin's bootcamp-level candidate-folder list. */
export interface OnboardingCandidateSummary {
  application_id: string
  candidate_code: string
  full_name: string | null
  forms_submitted: number
  forms_total: number
  documents_required: number
  documents_uploaded: number
  documents_approved: number
  documents_rejected: number
  documents_pending: number
  hub_unlocked: boolean
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
