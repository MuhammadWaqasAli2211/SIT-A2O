/**
 * A candidate's onboarding submission, rendered read-only.
 *
 * Extracted from the admin onboarding detail page so the HR Assessment
 * modal can show the same thing without a second implementation. The forms
 * themselves were always shared — `BackgroundVerificationForm` and its three
 * siblings each take `readOnly` — but the tab strip around them, the
 * per-form "not submitted yet" state and the form-type-to-component mapping
 * were not, and rebuilding those for the modal would have been two
 * definitions of what an onboarding submission looks like.
 *
 * Deliberately actionless. Reopening a form is a write with an audit trail
 * and a candidate-visible consequence; it lives on /admin/onboarding, which
 * is built around reviewing and acting. This view is for reading, and the
 * page that owns the actions composes them around it.
 */

import { Skeleton } from '@/components/ui/skeleton'
import { AsyncSection } from '@/features/admin/components'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { onboardingApi } from '@/features/admin/api'
import {
  BackgroundVerificationForm,
  type BackgroundVerificationDraft,
} from '@/features/onboarding/background-verification-form'
import { BankPaymentForm, type BankPaymentDraft } from '@/features/onboarding/bank-payment-form'
import {
  EmploymentApplicationForm,
  type EmploymentApplicationDraft,
} from '@/features/onboarding/employment-application-form'
import { HalfNamaForm, type HalfNamaDraft } from '@/features/onboarding/half-nama-form'
import { useAsync } from '@/hooks/use-async'
import { isAdult } from '@/lib/age'
import { ONBOARDING_FORM_LABEL, OnboardingFormType, type OnboardingFormRow } from '@/lib/types'

/**
 * One submitted form's answers, in the same component the candidate filled
 * in — not a second, read-only rendering of the same fields that would drift
 * from it every time a question changes.
 */
export function ReadOnlyForm({
  formType,
  data,
  isAdultCandidate,
}: {
  formType: OnboardingFormRow['form_type']
  data: Record<string, unknown>
  isAdultCandidate: boolean
}) {
  switch (formType) {
    case OnboardingFormType.BACKGROUND_VERIFICATION:
      return (
        <BackgroundVerificationForm
          initialData={data as Partial<BackgroundVerificationDraft>}
          readOnly
        />
      )
    case OnboardingFormType.EMPLOYMENT_APPLICATION:
      return (
        <EmploymentApplicationForm
          initialData={data as Partial<EmploymentApplicationDraft>}
          readOnly
        />
      )
    case OnboardingFormType.HALF_NAMA:
      return <HalfNamaForm initialData={data as Partial<HalfNamaDraft>} readOnly />
    case OnboardingFormType.BANK_PAYMENT_DETAILS:
      return (
        <BankPaymentForm
          isAdultCandidate={isAdultCandidate}
          initialData={data as Partial<BankPaymentDraft>}
          readOnly
        />
      )
  }
}

/**
 * The whole submission: a tab per form, each showing its answers or saying
 * plainly that it has not been submitted.
 *
 * Fetches on mount, which for the modal means on open — mounting it only
 * once the dialog is actually opened is what keeps a table of these from
 * pulling every candidate's paperwork up front.
 */
export function OnboardingSubmissionView({
  applicationId,
  dateOfBirth,
  renderActions,
  refreshToken = 0,
}: {
  applicationId: string
  /** Decides which bank-details variant applies. Missing means treat as an
   *  adult — the same assumption the admin detail page makes. */
  dateOfBirth: string | null
  /** Optional per-form controls, for the screen that owns the write actions. */
  renderActions?: (row: OnboardingFormRow) => React.ReactNode
  /** Bump to refetch — the caller owning `renderActions` needs a way to say
   *  "that write landed" without this component knowing what the write was. */
  refreshToken?: number
}) {
  const rows = useAsync(() => onboardingApi.forms(applicationId), [applicationId, refreshToken])

  return (
    <AsyncSection
      initialLoading={rows.initialLoading}
      error={rows.error}
      onRetry={rows.refetch}
      skeleton={<Skeleton className="h-96 w-full rounded-xl" />}
    >
      {rows.data && (
        <Tabs defaultValue={rows.data[0]?.form_type} orientation="vertical">
          <TabsList className="h-fit w-56 shrink-0 flex-col items-stretch">
            {rows.data.map((row) => (
              <TabsTrigger key={row.form_type} value={row.form_type} className="justify-start">
                {ONBOARDING_FORM_LABEL[row.form_type]}
              </TabsTrigger>
            ))}
          </TabsList>

          {rows.data.map((row) => (
            <TabsContent key={row.form_type} value={row.form_type}>
              <div className="flex flex-col gap-3">
                {!row.submission ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Not submitted yet.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {row.submission.status === 'REOPENED'
                          ? `Reopened for correction${row.submission.reopen_note ? `: "${row.submission.reopen_note}"` : ''}`
                          : `Submitted ${new Date(row.submission.submitted_at).toLocaleString()}`}
                      </span>
                      {renderActions?.(row)}
                    </div>
                    <ReadOnlyForm
                      formType={row.form_type}
                      data={row.submission.submitted_data}
                      isAdultCandidate={dateOfBirth ? isAdult(dateOfBirth) : true}
                    />
                  </>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </AsyncSection>
  )
}
