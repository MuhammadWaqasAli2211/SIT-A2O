/**
 * Landing page for "Student's Folder": two folder-style cards — the
 * Onboarding Form checklist and the Documents Hub — rather than a plain
 * list. Deliberately thin: it reads the same `onboardingForms`/`progress`
 * rows the backend already computes `unlocked` for, instead of re-deriving
 * sequencing rules here.
 */
import { ClipboardCheck, FolderOpen } from 'lucide-react'

import { PageHeader } from '@/components/shared/portal-ui'
import { Stagger, StaggerItem } from '@/components/motion/reveal'
import { Skeleton } from '@/components/ui/skeleton'
import { AsyncSection } from '@/features/admin/components'
import { useApplication } from '@/features/applications/application-context'
import { candidateApi } from '@/features/candidate/api'
import { FolderCard, type FolderTone } from '@/features/onboarding/folder-card'
import { useAsync } from '@/hooks/use-async'
import {
  ONBOARDING_FORM_ORDER,
  ONBOARDING_FORM_SLUG,
  OnboardingFormType,
  type OnboardingFormRow,
  type RequiredOnboardingDocument,
} from '@/lib/types'

export default function StudentFolderPage() {
  const { application } = useApplication()

  return (
    <>
      <PageHeader
        title="Student's Folder"
        description="Complete your onboarding paperwork, then upload the required documents."
      />
      {application && <Folder applicationId={application.id} />}
    </>
  )
}

function Folder({ applicationId }: { applicationId: string }) {
  const forms = useAsync(() => candidateApi.onboardingForms(applicationId), [applicationId])
  const progress = useAsync(() => candidateApi.onboardingProgress(applicationId), [applicationId])
  const hubUnlocked = progress.data?.hub_unlocked ?? false

  // The Documents Hub route 409s until all 4 forms are submitted, so its
  // upload counts are only fetched once it is actually reachable.
  const documents = useAsync(
    () => (hubUnlocked ? candidateApi.onboardingDocuments(applicationId) : Promise.resolve(undefined)),
    [applicationId, hubUnlocked],
  )

  return (
    <AsyncSection
      initialLoading={progress.initialLoading || forms.initialLoading}
      error={progress.error ?? forms.error}
      onRetry={() => {
        progress.refetch()
        forms.refetch()
      }}
      skeleton={<Skeleton className="h-80 w-full rounded-3xl" />}
    >
      {progress.data && forms.data && (
        <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <StaggerItem>
            <FolderCard
              to={`/dashboard/documents/forms/${nextFormSlug(forms.data)}`}
              icon={ClipboardCheck}
              title="Onboarding Form"
              description="4 forms to fill out, in order."
              badgeLabel={`${progress.data.forms_submitted}/${progress.data.forms_total} completed`}
              tone={formsTone(progress.data.forms_submitted, progress.data.forms_total)}
            />
          </StaggerItem>

          <StaggerItem>
            <FolderCard
              to="/dashboard/documents/hub"
              icon={FolderOpen}
              title="Documents Hub"
              description="Upload your CNIC, family, education, and payment documents."
              badgeLabel={hubBadge(hubUnlocked, documents.data)}
              tone={hubTone(hubUnlocked, documents.data)}
              locked={!hubUnlocked}
            />
          </StaggerItem>
        </Stagger>
      )}
    </AsyncSection>
  )
}

/** The form the folder card should deep-link to: the next unsubmitted
 *  unlocked one, or the first form if every one is already submitted. */
function nextFormSlug(rows: OnboardingFormRow[]) {
  const byType = new Map(rows.map((row) => [row.form_type, row]))
  const next = ONBOARDING_FORM_ORDER.find((formType) => {
    const row = byType.get(formType)
    return row?.unlocked && row.submission?.status !== 'SUBMITTED'
  })
  return ONBOARDING_FORM_SLUG[next ?? OnboardingFormType.BACKGROUND_VERIFICATION]
}

function formsTone(submitted: number, total: number): FolderTone {
  if (submitted === 0) return 'idle'
  return submitted === total ? 'complete' : 'partial'
}

function hubBadge(unlocked: boolean, documents: RequiredOnboardingDocument[] | undefined) {
  if (!unlocked) return 'Locked'
  if (!documents) return '…'
  const { uploaded, total } = docsSummary(documents)
  return `${uploaded}/${total} uploaded`
}

function hubTone(unlocked: boolean, documents: RequiredOnboardingDocument[] | undefined): FolderTone {
  if (!unlocked || !documents) return 'idle'
  const { uploaded, total } = docsSummary(documents)
  if (uploaded === 0) return 'idle'
  return uploaded === total ? 'complete' : 'partial'
}

function docsSummary(rows: RequiredOnboardingDocument[]) {
  const uploaded = rows.filter((row) => row.documents.length > 0).length
  return { uploaded, total: rows.length }
}
