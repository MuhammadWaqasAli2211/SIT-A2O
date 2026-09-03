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
  CandidatePhysicalInterview,
  CandidateScore,
  InterviewRow,
  OnboardingDocumentLink,
  OnboardingDocumentRecord,
  OnboardingDocumentType,
  OnboardingFormRow,
  OnboardingFormSubmission,
  OnboardingFormType,
  OnboardingProgress,
  Program,
  PublicBootcamp,
  RequiredOnboardingDocument,
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

  /**
   * The candidate's own latest Physical Interview invite — venue, date,
   * time, and the outcome once one is recorded. Not reachable until the AI
   * Interview has been cleared.
   */
  myPhysicalInterview: () => get<CandidatePhysicalInterview>('/me/physical-interview'),

  /* ----------------------------------------------- onboarding: forms hub -- */

  onboardingForms: (applicationId: string) =>
    get<OnboardingFormRow[]>(`/applications/${applicationId}/onboarding/forms`),

  onboardingProgress: (applicationId: string) =>
    get<OnboardingProgress>(`/applications/${applicationId}/onboarding/progress`),

  async submitOnboardingForm(applicationId: string, formType: OnboardingFormType, submitted_data: unknown) {
    const { data } = await api.post<OnboardingFormSubmission>(
      `/applications/${applicationId}/onboarding/forms/${formType}`,
      { submitted_data },
    )
    return data
  },

  /* ------------------------------------------- onboarding: documents hub -- */

  onboardingDocuments: (applicationId: string) =>
    get<RequiredOnboardingDocument[]>(`/applications/${applicationId}/onboarding/documents`),

  async uploadOnboardingDocument(applicationId: string, docType: OnboardingDocumentType, file: File) {
    const form = new FormData()
    form.append('doc_type', docType)
    form.append('file', file)
    const { data } = await api.post<OnboardingDocumentRecord>(
      `/applications/${applicationId}/onboarding/documents`,
      form,
      { headers: { 'Content-Type': undefined } },
    )
    return data
  },

  deleteOnboardingDocument: (id: string) =>
    api.delete(`/onboarding/documents/${id}`).then(() => undefined),

  onboardingDocumentLink: (id: string) => get<OnboardingDocumentLink>(`/onboarding/documents/${id}/link`),

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
