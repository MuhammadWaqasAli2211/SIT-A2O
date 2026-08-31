/**
 * One form of the Onboarding Form checklist, at /dashboard/documents/forms/:slug.
 *
 * A single route rather than 4, switching on the slug: every form shares the
 * same lifecycle (locked/editable/reopened/submitted), and centralising the
 * lock check and submit wiring here means it exists once, not four times.
 */
import { AlertTriangle, ArrowLeft, Lock } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AsyncSection } from '@/features/admin/components'
import { useApplication } from '@/features/applications/application-context'
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
import { candidateApi } from '@/features/candidate/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useAuth } from '@/hooks/use-auth'
import { isAdult } from '@/lib/age'
import { ONBOARDING_FORM_BY_SLUG, ONBOARDING_FORM_LABEL, OnboardingFormType } from '@/lib/types'

export default function OnboardingFormPage() {
  const { slug } = useParams<{ slug: string }>()
  const { application } = useApplication()
  const { profile } = useAuth()

  const formType = slug ? ONBOARDING_FORM_BY_SLUG[slug] : undefined
  if (!formType) return <Navigate to="/dashboard/documents" replace />

  return (
    <>
      <Link
        to="/dashboard/documents"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Back to Student's Folder
      </Link>
      <PageHeader title={ONBOARDING_FORM_LABEL[formType]} />
      {application && (
        <FormBody
          applicationId={application.id}
          formType={formType}
          dateOfBirth={profile?.candidate_profile?.date_of_birth ?? null}
        />
      )}
    </>
  )
}

function FormBody({
  applicationId,
  formType,
  dateOfBirth,
}: {
  applicationId: string
  formType: OnboardingFormType
  dateOfBirth: string | null
}) {
  const navigate = useNavigate()
  const rows = useAsync(() => candidateApi.onboardingForms(applicationId), [applicationId])
  const submit = useMutation((data: unknown) =>
    candidateApi.submitOnboardingForm(applicationId, formType, data),
  )

  return (
    <AsyncSection
      initialLoading={rows.initialLoading}
      error={rows.error}
      onRetry={rows.refetch}
      skeleton={<Skeleton className="h-96 w-full rounded-xl" />}
    >
      {rows.data && (() => {
        const row = rows.data.find((r) => r.form_type === formType)
        if (!row?.unlocked) {
          return (
            <EmptyState
              icon={Lock}
              title="Not available yet"
              description="Complete the forms before this one first."
              action={
                <Link to="/dashboard/documents" className={buttonVariants({ size: 'sm' })}>
                  Back to Student's Folder
                </Link>
              }
            />
          )
        }

        const readOnly = row.submission?.status === 'SUBMITTED'
        const initialData = row.submission?.submitted_data

        const handleSubmit = async (draft: unknown) => {
          if (await submit.run(draft)) {
            toast.success(`${ONBOARDING_FORM_LABEL[formType]} submitted`)
            await rows.refetch()
            navigate('/dashboard/documents')
          }
        }

        return (
          <div className="flex flex-col gap-4">
            {row.submission?.status === 'REOPENED' && (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertTitle>Sent back for correction</AlertTitle>
                <AlertDescription>
                  {row.submission.reopen_note || 'An administrator asked you to review and resubmit this form.'}
                </AlertDescription>
              </Alert>
            )}
            {submit.error && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{submit.error}</AlertDescription>
              </Alert>
            )}

            <RenderForm
              formType={formType}
              initialData={initialData}
              readOnly={readOnly}
              submitting={submit.pending}
              onSubmit={handleSubmit}
              isAdultCandidate={dateOfBirth ? isAdult(dateOfBirth) : true}
            />
          </div>
        )
      })()}
    </AsyncSection>
  )
}

function RenderForm({
  formType,
  initialData,
  readOnly,
  submitting,
  onSubmit,
  isAdultCandidate,
}: {
  formType: OnboardingFormType
  initialData: Record<string, unknown> | undefined
  readOnly: boolean
  submitting: boolean
  onSubmit: (draft: unknown) => void
  isAdultCandidate: boolean
}) {
  switch (formType) {
    case OnboardingFormType.BACKGROUND_VERIFICATION:
      return (
        <BackgroundVerificationForm
          initialData={initialData as Partial<BackgroundVerificationDraft> | undefined}
          readOnly={readOnly}
          submitting={submitting}
          onSubmit={onSubmit}
        />
      )
    case OnboardingFormType.EMPLOYMENT_APPLICATION:
      return (
        <EmploymentApplicationForm
          initialData={initialData as Partial<EmploymentApplicationDraft> | undefined}
          readOnly={readOnly}
          submitting={submitting}
          onSubmit={onSubmit}
        />
      )
    case OnboardingFormType.HALF_NAMA:
      return (
        <HalfNamaForm
          initialData={initialData as Partial<HalfNamaDraft> | undefined}
          readOnly={readOnly}
          submitting={submitting}
          onSubmit={onSubmit}
        />
      )
    case OnboardingFormType.BANK_PAYMENT_DETAILS:
      return (
        <BankPaymentForm
          isAdultCandidate={isAdultCandidate}
          initialData={initialData as Partial<BankPaymentDraft> | undefined}
          readOnly={readOnly}
          submitting={submitting}
          onSubmit={onSubmit}
        />
      )
  }
}
