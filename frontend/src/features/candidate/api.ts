/**
 * Typed wrappers over the candidate-facing endpoints.
 *
 * Separate from `features/admin/api.ts` because the two address different
 * routes for the same nouns: an admin reads `/applications/{id}/admin` with
 * contact details attached, a candidate reads `/applications/mine`. Sharing
 * one module would invite calling an admin-only path from a candidate screen
 * and only finding out at runtime with a 403.
 */

import { api } from '@/lib/api-client'
import type {
  ApplicationDetail,
  CandidateScore,
  DocumentLink,
  DocumentRecord,
  DocumentType,
  InterviewRow,
  Program,
  PublicBootcamp,
  RequiredDocument,
  UserDetail,
} from '@/lib/types'

async function get<T>(url: string): Promise<T> {
  const { data } = await api.get<T>(url)
  return data
}

export const candidateApi = {
  /* ------------------------------------------------------- applications -- */

  myApplications: () => get<ApplicationDetail[]>('/applications/mine'),

  /** Intakes currently accepting applications. Public — no token needed. */
  openBootcamps: () => get<PublicBootcamp[]>('/bootcamps/open'),

  programs: () => get<Program[]>('/programs'),

  async apply(payload: { bootcamp_id: string; program_id: string; statement?: string }) {
    const { data } = await api.post<ApplicationDetail>('/applications', payload)
    return data
  },

  /* ---------------------------------------------------------- interviews -- */

  /**
   * The candidate's own schedule.
   *
   * The row type carries a `score`, but candidate screens must not render it —
   * scores are an internal admin signal. See docs/project-status.md.
   */
  myInterviews: () => get<InterviewRow[]>('/me/interviews'),

  /**
   * The candidate's own AI screening result.
   *
   * Returns a score and nothing else — the backend's `CandidateScore` has no
   * field able to carry questions, proctor snapshots, recordings or audit
   * entries, so this is safe to render directly rather than filtered here.
   */
  myAiInterview: () => get<CandidateScore>('/me/ai-interview'),

  /**
   * Write to the intake's administrators about a missed interview deadline.
   *
   * Accepted only once the deadline has actually passed, and only once. No
   * agent judges the reason — an administrator reads it and decides.
   */
  async explainMissedDeadline(reason: string) {
    await api.post('/me/ai-interview/explanation', { reason })
  },

  /* ----------------------------------------------------------- documents -- */

  checklist: (applicationId: string) =>
    get<RequiredDocument[]>(`/applications/${applicationId}/documents`),

  async upload(applicationId: string, docType: DocumentType, file: File) {
    const form = new FormData()
    form.append('doc_type', docType)
    form.append('file', file)

    // Content-Type is deliberately unset: the browser must add the multipart
    // boundary itself, and naming the header here would overwrite it.
    const { data } = await api.post<DocumentRecord>(
      `/applications/${applicationId}/documents`,
      form,
      { headers: { 'Content-Type': undefined } },
    )
    return data
  },

  deleteDocument: (id: string) => api.delete(`/documents/${id}`).then(() => undefined),

  /** Short-lived; fetch one per view rather than storing it. */
  documentLink: (id: string) => get<DocumentLink>(`/documents/${id}/link`),

  /* ------------------------------------------------------------- profile -- */

  myDetail: () => get<UserDetail>('/auth/me/detail'),

  async updateProfile(payload: {
    full_name?: string
    phone?: string | null
    cnic?: string | null
    date_of_birth?: string | null
    city?: string | null
    education?: string | null
  }) {
    const { data } = await api.patch<UserDetail>('/auth/me', payload)
    return data
  },
}
