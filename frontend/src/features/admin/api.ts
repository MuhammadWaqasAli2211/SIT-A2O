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
  ApplicantRow,
  ApplicationStage,
  AuditEntry,
  Bootcamp,
  BootcampDetail,
  BootcampStats,
  DocumentLink,
  DocumentRecord,
  DocumentRow,
  DocumentStatus,
  EmailLogEntry,
  EmailSendResult,
  EmailStatus,
  Interview,
  InterviewMode,
  InterviewRow,
  InterviewStatus,
  InviteBatch,
  InviteBatchDetail,
  InviteCategory,
  Page,
  PhaseType,
  PlatformStats,
  Profile,
  Program,
  ProgramAdmin,
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

/* ------------------------------------------------------------- documents -- */

export const documentApi = {
  /** Admin: every upload in an intake, for review. */
  listForBootcamp: (
    bootcampId: string,
    params?: { status?: DocumentStatus; limit?: number; offset?: number },
  ) => get<Page<DocumentRow>>(`/bootcamps/${bootcampId}/documents`, params),

  async review(id: string, status: DocumentStatus, review_note?: string) {
    const { data } = await api.post<DocumentRecord>(`/documents/${id}/review`, {
      status,
      review_note,
    })
    return data
  },

  /** Signed URLs expire quickly — fetch one per view, never cache it. */
  adminLink: (id: string) => get<DocumentLink>(`/admin/documents/${id}/link`),
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
