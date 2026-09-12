/**
 * Typed wrappers over the admin endpoints.
 *
 * One module rather than one per page: the admin screens overlap heavily
 * (candidates appear in interviews, interviews appear on the dashboard), and
 * splitting by page would mean the same call defined twice.
 */

import { api } from '@/lib/api-client'
import type {
  AdminApplicationDetail,
  AdminGrants,
  AgilyticsEligibleList,
  AgilyticsInviteOutcome,
  AgilyticsInviteResult,
  AgilyticsJoinSyncResult,
  AgilyticsMemberStatus,
  AgilyticsProvisionResult,
  AgilyticsWorkspaceState,
  AiAnalytics,
  AiScope,
  AnnounceSummary,
  ApplicantRow,
  ApplicationStage,
  AuditEntry,
  Bootcamp,
  BootcampDetail,
  BootcampStats,
  CompletedInterviewsPage,
  DocumentStatus,
  EmailLogEntry,
  EmailSendResult,
  EmailStatus,
  ExternalRecord,
  ExternalRecords,
  HrAssessmentPage,
  Interview,
  InterviewMode,
  InterviewRow,
  InterviewStatus,
  InviteBatch,
  InviteBatchDetail,
  InviteCategory,
  InviteDifficulty,
  KeyScopes,
  OnboardingCandidateSummary,
  OnboardingDocumentLink,
  OnboardingDocumentRecord,
  OnboardingFormRow,
  OnboardingFormSubmission,
  Page,
  PhaseType,
  PhysicalInterviewBatch,
  PhysicalInterviewBatchDetail,
  PlatformStats,
  Profile,
  Program,
  ProgramAdmin,
  RequiredOnboardingDocument,
  UserDetail,
  UserRole,
  UserRow,
} from '@/lib/types'

/** Axios drops `undefined` params, so optional filters can be passed as-is. */
type Params = Record<string, string | number | boolean | undefined>

async function get<T>(url: string, params?: Params): Promise<T> {
  const { data } = await api.get<T>(url, { params })
  return data
}

/* ------------------------------------------------------------- bootcamps -- */

export const bootcampApi = {
  list: () => get<Bootcamp[]>('/bootcamps'),
  detail: (id: string) => get<BootcampDetail>(`/bootcamps/${id}`),
  stats: (id: string) => get<BootcampStats>(`/bootcamps/${id}/stats`),

  async create(payload: {
    bootcamp_number: number
    name: string
    description?: string | null
    starts_at?: string | null
    program_ids: string[]
  }) {
    const { data } = await api.post<BootcampDetail>('/bootcamps', payload)
    return data
  },

  async update(
    id: string,
    payload: Partial<{
      name: string
      description: string | null
      starts_at: string | null
      status: Bootcamp['status']
      program_ids: string[]
    }>,
  ) {
    const { data } = await api.patch<BootcampDetail>(`/bootcamps/${id}`, payload)
    return data
  },

  remove: (id: string) => api.delete(`/bootcamps/${id}`).then(() => undefined),

  admins: (id: string) => get<Profile[]>(`/bootcamps/${id}/admins`),
  assignAdmin: (id: string, profileId: string) =>
    api.post(`/bootcamps/${id}/admins/${profileId}`).then(() => undefined),
  unassignAdmin: (id: string, profileId: string) =>
    api.delete(`/bootcamps/${id}/admins/${profileId}`).then(() => undefined),

  audit: (id: string, params?: Params) =>
    get<Page<AuditEntry>>(`/bootcamps/${id}/audit`, params),
}

/* ---------------------------------------------------------------- phases -- */

export const phaseApi = {
  /**
   * Only the keys present are sent, which is what lets an admin edit the open
   * date without clearing the deadline. Passing an explicit null clears.
   */
  async update(
    bootcampId: string,
    phase: PhaseType,
    payload: Partial<{ opens_at: string | null; deadline_at: string | null }>,
  ) {
    const { data } = await api.patch(`/bootcamps/${bootcampId}/phases/${phase}`, payload)
    return data
  },

  async setOpen(bootcampId: string, phase: PhaseType, open: boolean) {
    const action = open ? 'open' : 'close'
    const { data } = await api.post(`/bootcamps/${bootcampId}/phases/${phase}/${action}`)
    return data
  },
}

/* ---------------------------------------------------------- applications -- */

export const applicationApi = {
  listForBootcamp: (
    bootcampId: string,
    params?: { stage?: ApplicationStage; search?: string; limit?: number; offset?: number },
  ) => get<Page<ApplicantRow>>(`/bootcamps/${bootcampId}/applications`, params),

  detail: (id: string) => get<AdminApplicationDetail>(`/applications/${id}/admin`),

  async advanceStage(id: string, to_stage: ApplicationStage, reason?: string) {
    const { data } = await api.post(`/applications/${id}/stage`, { to_stage, reason })
    return data
  },

  async reinstate(id: string, to_stage: ApplicationStage, reason?: string) {
    const { data } = await api.post(`/applications/${id}/reinstate`, { to_stage, reason })
    return data
  },

  async update(id: string, payload: { program_id?: string; statement?: string }) {
    const { data } = await api.patch(`/applications/${id}`, payload)
    return data
  },

  remove: (id: string) => api.delete(`/applications/${id}`).then(() => undefined),

  interviews: (id: string) => get<InterviewRow[]>(`/applications/${id}/interviews`),
}

/* ------------------------------------------------------------ interviews -- */

export interface InterviewDraft {
  application_id: string
  scheduled_at: string
  duration_minutes?: number
  mode?: InterviewMode
  location?: string | null
  interviewer_id?: string | null
  batch_label?: string | null
  notes?: string | null
}

export const interviewApi = {
  listForBootcamp: (
    bootcampId: string,
    params?: {
      status?: InterviewStatus
      batch_label?: string
      upcoming_only?: boolean
      search?: string
      limit?: number
      offset?: number
    },
  ) => get<Page<InterviewRow>>(`/bootcamps/${bootcampId}/interviews`, params),

  async schedule(payload: InterviewDraft) {
    const { data } = await api.post<Interview>('/interviews', payload)
    return data
  },

  async bulkSchedule(
    bootcampId: string,
    payload: {
      slots: { application_id: string; scheduled_at: string }[]
      duration_minutes?: number
      mode?: InterviewMode
      location?: string | null
      interviewer_id?: string | null
      batch_label?: string | null
      advance_stage?: boolean
    },
  ) {
    const { data } = await api.post<Interview[]>(
      `/bootcamps/${bootcampId}/interviews/batch`,
      payload,
    )
    return data
  },

  async update(
    id: string,
    payload: Partial<{
      scheduled_at: string
      duration_minutes: number
      mode: InterviewMode
      location: string | null
      interviewer_id: string | null
      status: InterviewStatus
      score: number | null
      notes: string | null
      batch_label: string | null
    }>,
  ) {
    const { data } = await api.patch<Interview>(`/interviews/${id}`, payload)
    return data
  },

  async cancel(id: string, reason?: string) {
    const { data } = await api.post<Interview>(`/interviews/${id}/cancel`, { reason })
    return data
  },

  remove: (id: string) => api.delete(`/interviews/${id}`).then(() => undefined),
}

/* ---------------------------------------------------------------- emails -- */

export const emailApi = {
  log: (
    bootcampId: string,
    params?: { status?: EmailStatus; search?: string; limit?: number; offset?: number },
  ) => get<Page<EmailLogEntry>>(`/bootcamps/${bootcampId}/emails`, params),

  async send(
    bootcampId: string,
    payload: {
      application_ids: string[]
      subject: string
      body_html: string
      template?: string | null
    },
  ) {
    const { data } = await api.post<EmailSendResult>(
      `/bootcamps/${bootcampId}/emails/send`,
      payload,
    )
    return data
  },

  async broadcast(
    bootcampId: string,
    payload: {
      stage?: ApplicationStage | null
      subject: string
      body_html: string
      template?: string | null
    },
  ) {
    const { data } = await api.post<EmailSendResult>(
      `/bootcamps/${bootcampId}/emails/broadcast`,
      payload,
    )
    return data
  },
}

/* ----------------------------------------------------------------- users -- */

export const userApi = {
  list: (params?: {
    role?: UserRole
    is_active?: boolean
    search?: string
    limit?: number
    offset?: number
  }) => get<Page<UserRow>>('/users', params),

  detail: (id: string) => get<UserDetail>(`/users/${id}`),

  async createStaff(payload: {
    email: string
    password: string
    full_name: string
    phone?: string | null
    role: UserRole
    bootcamp_ids?: string[]
  }) {
    const { data } = await api.post<Profile>('/users', payload)
    return data
  },

  async update(
    id: string,
    payload: Partial<{
      full_name: string
      phone: string | null
      cnic: string | null
      date_of_birth: string | null
      city: string | null
      education: string | null
    }>,
  ) {
    const { data } = await api.patch<Profile>(`/users/${id}`, payload)
    return data
  },

  async changeRole(id: string, role: UserRole, reason?: string) {
    const { data } = await api.post<Profile>(`/users/${id}/role`, { role, reason })
    return data
  },

  async setActive(id: string, is_active: boolean, reason?: string) {
    const { data } = await api.post<Profile>(`/users/${id}/active`, { is_active, reason })
    return data
  },

  resetPassword: (id: string, password: string) =>
    api.post(`/users/${id}/password`, { password }).then(() => undefined),

  remove: (id: string) => api.delete(`/users/${id}`).then(() => undefined),

  audit: (id: string, params?: Params) => get<Page<AuditEntry>>(`/users/${id}/audit`, params),
}

/* -------------------------------------------------------------- programs -- */

export const programApi = {
  listPublic: () => get<Program[]>('/programs'),
  listAll: () => get<ProgramAdmin[]>('/programs/manage'),

  async create(payload: {
    slug: string
    title: string
    tagline: string
    description?: string | null
    duration?: string | null
    mode?: string | null
    level?: string | null
    is_active?: boolean
    sort_order?: number
  }) {
    const { data } = await api.post<Program>('/programs', payload)
    return data
  },

  async update(
    id: string,
    payload: Partial<{
      title: string
      tagline: string
      description: string | null
      duration: string | null
      mode: string | null
      level: string | null
      is_active: boolean
      sort_order: number
    }>,
  ) {
    const { data } = await api.patch<Program>(`/programs/${id}`, payload)
    return data
  },

  remove: (id: string) => api.delete(`/programs/${id}`).then(() => undefined),
}

/* ------------------------------------------------------------- platform -- */

export const platformApi = {
  stats: () => get<PlatformStats>('/stats'),
  audit: (params?: Params) => get<Page<AuditEntry>>('/audit', params),
}

/* ------------------------------------------------------------ onboarding --
 * Student's Folder review: the bootcamp-level candidate-folder list, one
 * candidate's 4 forms + document checklist, reopening a form, and
 * per-document approve/reject.
 */

export const onboardingApi = {
  listCandidates: (
    bootcampId: string,
    params?: { search?: string; limit?: number; offset?: number },
  ) => get<Page<OnboardingCandidateSummary>>(`/bootcamps/${bootcampId}/onboarding/candidates`, params),

  forms: (applicationId: string) =>
    get<OnboardingFormRow[]>(`/admin/applications/${applicationId}/onboarding/forms`),

  async reopenForm(submissionId: string, note?: string) {
    const { data } = await api.post<OnboardingFormSubmission>(
      `/onboarding/forms/${submissionId}/reopen`,
      { note },
    )
    return data
  },

  documents: (applicationId: string) =>
    get<RequiredOnboardingDocument[]>(`/admin/applications/${applicationId}/onboarding/documents`),

  documentLink: (id: string) => get<OnboardingDocumentLink>(`/admin/onboarding/documents/${id}/link`),

  async reviewDocument(id: string, status: DocumentStatus, review_note?: string) {
    const { data } = await api.post<OnboardingDocumentRecord>(`/onboarding/documents/${id}/review`, {
      status,
      review_note,
    })
    return data
  },
}

/* ---------------------------------------------------- AI interview invites --
 * InterviewerAI, not our own scheduled interviews — see the type-level note
 * in lib/types.ts.
 */

export interface ManualInviteRow {
  full_name: string
  email: string
  cnic: string
  category: InviteCategory
}

export const interviewInviteApi = {
  listForBootcamp: (bootcampId: string) =>
    get<InviteBatch[]>(`/bootcamps/${bootcampId}/interview-invites`),

  async sendBulk(
    bootcampId: string,
    payload: {
      subject: string
      batch_name?: string
      personalize?: boolean
      question_difficulty?: InviteDifficulty
      /** ISO instant. Ours to enforce — InterviewerAI has no deadline field. */
      deadline_at?: string
      /** Covering-email body, with $candidate_name-style merge fields. */
      message?: string
      application_ids?: string[]
      manual_rows?: ManualInviteRow[]
      advance_stage?: boolean
    },
  ) {
    const { data } = await api.post<InviteBatchDetail>(
      `/bootcamps/${bootcampId}/interview-invites/bulk`,
      payload,
    )
    return data
  },

  detail: (batchId: string) => get<InviteBatchDetail>(`/interview-invites/${batchId}`),

  async refresh(batchId: string) {
    const { data } = await api.post<InviteBatchDetail>(`/interview-invites/${batchId}/refresh`)
    return data
  },
}

export const physicalInterviewApi = {
  listForBootcamp: (bootcampId: string) =>
    get<PhysicalInterviewBatch[]>(`/bootcamps/${bootcampId}/physical-interviews`),

  async sendBulk(
    bootcampId: string,
    payload: {
      venue: string
      /** YYYY-MM-DD. */
      interview_date: string
      /** HH:mm, optional — a batch may cover a whole day rather than one slot. */
      start_time?: string
      /** ISO instant. The deadline for recording a result, not for attending. */
      deadline_at: string
      subject: string
      /** Covering email, with $venue/$interview_date/$interview_day/
       * $interview_time/$deadline plus the usual $candidate_name-style
       * merge fields. Required — there is no second channel telling the
       * candidate where to go, unlike the AI-invite's credentials mail. */
      message: string
      application_ids: string[]
    },
  ) {
    const { data } = await api.post<PhysicalInterviewBatchDetail>(
      `/bootcamps/${bootcampId}/physical-interviews`,
      payload,
    )
    return data
  },

  detail: (batchId: string) => get<PhysicalInterviewBatchDetail>(`/physical-interviews/${batchId}`),

  async recordResult(inviteId: string, payload: { result: 'SELECTED' | 'REJECTED'; rejection_note?: string }) {
    const { data } = await api.post<PhysicalInterviewBatchDetail>(
      `/physical-interviews/invites/${inviteId}/result`,
      payload,
    )
    return data
  },
}

/* ------------------------------------------ AI Interviewer: results side --
 * Reading back what the external service produced. Every call here goes
 * through our own backend — the InterviewerAI key stays server-side and is
 * never present in the browser.
 */

export const aiInterviewApi = {
  listForBootcamp: (bootcampId: string) =>
    get<ExternalRecords>(`/bootcamps/${bootcampId}/ai-interviews`),

  /** Omit bootcampId for the platform-wide view — super admin only, the
   * backend refuses an admin who omits it. */
  completed: (bootcampId?: string) =>
    get<CompletedInterviewsPage>('/ai-interviews/completed', bootcampId ? { bootcamp_id: bootcampId } : undefined),

  /** Figures behind the announce confirm dialog, plus whether results are
   * currently announced. `can_announce` is false until the deadline passes. */
  announceSummary: (bootcampId: string) =>
    get<AnnounceSummary>(`/bootcamps/${bootcampId}/ai-interviews/announce`),

  /** Announce this intake's results, or hide them again. Announcing also
   * moves every invited candidate on — passed to Physical Interview,
   * everyone else to Rejected. Hiding does not reverse that. */
  async setResultsVisible(bootcampId: string, visible: boolean) {
    const { data } = await api.post<AnnounceSummary>(
      `/bootcamps/${bootcampId}/ai-interviews/announce`,
      { visible },
    )
    return data
  },

  detail: (interviewId: number) => get<ExternalRecord>(`/ai-interviews/${interviewId}`),

  /** Full per-question report. Admin-only; never fetched by a candidate view. */
  report: (interviewId: number) => get<ExternalRecord>(`/ai-interviews/${interviewId}/report`),

  /** Their signed playback URL. Proxied through us so the key is not exposed. */
  recording: (interviewId: number) =>
    get<ExternalRecord>(`/ai-interviews/${interviewId}/recording`),

  snapshots: (interviewId: number) =>
    get<ExternalRecords>(`/ai-interviews/${interviewId}/snapshots`),

  /** Requires the INTERVIEWS_DELETE grant. Deletes on their side only. */
  async remove(interviewId: number) {
    await api.delete(`/ai-interviews/${interviewId}`)
  },

  reinterviewRequests: (bootcampId?: string) =>
    get<ExternalRecords>('/ai-reinterview-requests', bootcampId ? { bootcamp_id: bootcampId } : undefined),

  /** Requires the REINTERVIEW_DECIDE grant. */
  async decideReinterview(requestId: number, approve: boolean, note?: string) {
    const { data } = await api.post<ExternalRecord>(
      `/ai-reinterview-requests/${requestId}/decision`,
      { approve, note },
    )
    return data
  },

  analytics: (bootcampId?: string) =>
    get<AiAnalytics>('/ai-analytics', bootcampId ? { bootcamp_id: bootcampId } : undefined),

  /** Super-admin only — their log is tenant-wide and cannot be intake-scoped. */
  auditLog: () => get<ExternalRecords>('/ai-audit-log'),
}

export const hrAssessmentApi = {
  /** Onboarding candidates with their AI screening result on the same row.
   *  Omit bootcampId for the platform-wide view — super admin only, the
   *  backend refuses an admin who omits it. */
  list: (bootcampId?: string) =>
    get<HrAssessmentPage>('/hr-assessment', bootcampId ? { bootcamp_id: bootcampId } : undefined),
}

export const agilyticsApi = {
  /** This intake's Agilytics side. `provisioned: false` before it exists. */
  state: (bootcampId: string) =>
    get<AgilyticsWorkspaceState>(`/bootcamps/${bootcampId}/agilytics`),

  /** What provisioning would send. Read-only — creates nothing. */
  preview: (bootcampId: string) =>
    get<AgilyticsProvisionResult>(`/bootcamps/${bootcampId}/agilytics/preview`),

  /** Creates the workspace. Refused if one already exists — their endpoint is
   *  not idempotent and a duplicate cannot be deleted. */
  async provision(bootcampId: string) {
    const { data } = await api.post<AgilyticsProvisionResult>(
      `/bootcamps/${bootcampId}/agilytics`,
    )
    return data
  },

  /** Issues Agilytics invites, and optionally emails the selected candidates.
   *
   *  `application_ids` does NOT narrow the Agilytics half — their endpoint
   *  takes no member list and always covers every pending member. It selects
   *  who receives our own covering email. Safe to repeat. */
  async sendInvites(
    bootcampId: string,
    payload: { application_ids?: string[]; subject?: string; body_html?: string } = {},
  ) {
    const { data } = await api.post<AgilyticsInviteResult>(
      `/bootcamps/${bootcampId}/agilytics/invites`,
      { application_ids: payload.application_ids ?? [], ...payload },
    )
    return data
  },

  /** One member's status, fetched on demand for a single row — never for the
   *  whole table, which would be one request per candidate. */
  memberStatus: (bootcampId: string, email: string) =>
    get<AgilyticsMemberStatus>(
      `/bootcamps/${bootcampId}/agilytics/members/${encodeURIComponent(email)}`,
    ),

  /** Who could be invited, split by whether they already have been. Reads our
   *  own database only — no Agilytics call, so it is cheap enough to drive the
   *  folder badges as well as the modal. */
  eligible: (bootcampId: string) =>
    get<AgilyticsEligibleList>(`/bootcamps/${bootcampId}/agilytics/eligible`),

  /** Stages invites, then confirms each candidate's membership before stamping
   *  them. `application_ids` chooses whose membership is verified — it cannot
   *  narrow the bulk-invite itself, which always covers every pending member. */
  async invite(
    bootcampId: string,
    payload: { application_ids: string[]; subject?: string; body_html?: string },
  ) {
    const { data } = await api.post<AgilyticsInviteOutcome>(
      `/bootcamps/${bootcampId}/agilytics/invite`,
      payload,
    )
    return data
  },

  /** Checks invited candidates for a join and advances those who have to
   *  Onboarded. One request to Agilytics per un-joined candidate, which is why
   *  it is an explicit action rather than something a page load triggers. */
  async syncJoins(bootcampId: string) {
    const { data } = await api.post<AgilyticsJoinSyncResult>(
      `/bootcamps/${bootcampId}/agilytics/sync-joins`,
    )
    return data
  },
}

export const permissionApi = {
  /** What the signed-in admin may write, so the UI can disable rather than fail. */
  mine: () => get<AiScope[]>('/me/permissions'),

  grants: () => get<AdminGrants[]>('/admin-permissions'),

  keyScopes: () => get<KeyScopes>('/admin-permissions/key'),

  async grant(profileId: string, scope: AiScope) {
    const { data } = await api.post<AiScope[]>(`/users/${profileId}/permissions`, { scope })
    return data
  },

  async revoke(profileId: string, scope: AiScope) {
    const { data } = await api.delete<AiScope[]>(`/users/${profileId}/permissions/${scope}`)
    return data
  },
}
