/**
 * Landing page for "Student's Folder": the 4-item Onboarding Form checklist,
 * and the Documents Hub once all 4 are done.
 *
 * Deliberately thin — it reads the same `onboardingForms` rows the backend
 * already computes `unlocked` for, rather than re-deriving sequencing rules
 * here. The actual filling happens on /dashboard/documents/forms/:slug.
 */
import { CheckCircle2, Circle, FileEdit, FolderOpen, Lock, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/shared/portal-ui'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AsyncSection } from '@/features/admin/components'
import { useApplication } from '@/features/applications/application-context'
import { candidateApi } from '@/features/candidate/api'
import { useAsync } from '@/hooks/use-async'
import { ONBOARDING_FORM_LABEL, ONBOARDING_FORM_SLUG, type OnboardingFormRow } from '@/lib/types'
import { cn } from '@/lib/utils'

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

  return (
    <AsyncSection
      initialLoading={forms.initialLoading || progress.initialLoading}
      error={forms.error ?? progress.error}
      onRetry={() => {
        forms.refetch()
        progress.refetch()
      }}
      skeleton={<Skeleton className="h-96 w-full rounded-xl" />}
    >
      {forms.data && progress.data && (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Form</CardTitle>
              <CardDescription>
                Complete these in order — each one unlocks the next.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {forms.data.map((row) => (
                <FormRow key={row.form_type} row={row} />
              ))}
            </CardContent>
          </Card>

          <Card className={cn(!progress.data.hub_unlocked && 'opacity-70')}>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex flex-col gap-1.5">
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="size-4.5" />
                  Documents Hub
                </CardTitle>
                <CardDescription>
                  {progress.data.hub_unlocked
                    ? 'Upload your CNIC, family documents, education records, and payment proof.'
                    : `Unlocks once all ${progress.data.forms_total} onboarding forms are submitted.`}
                </CardDescription>
              </div>
              {progress.data.hub_unlocked ? (
                <Button size="sm" render={<Link to="/dashboard/documents/hub" />}>
                  Open
                </Button>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Lock className="size-3.5" />
                  Locked
                </span>
              )}
            </CardHeader>
          </Card>
        </div>
      )}
    </AsyncSection>
  )
}

function FormRow({ row }: { row: OnboardingFormRow }) {
  const label = ONBOARDING_FORM_LABEL[row.form_type]
  const slug = ONBOARDING_FORM_SLUG[row.form_type]
  const status = row.submission?.status

  const { icon, tone, text } = describe(status, row.unlocked)

  return (
    <div className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', tone)}>
          {icon}
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{text}</span>
        </div>
      </div>

      {row.unlocked ? (
        <Button
          size="sm"
          variant={status === 'SUBMITTED' ? 'outline' : 'default'}
          render={<Link to={`/dashboard/documents/forms/${slug}`} />}
        >
          {status === 'SUBMITTED' && <CheckCircle2 className="size-3.5" />}
          {status === 'REOPENED' && <RotateCcw className="size-3.5" />}
          {!status && <FileEdit className="size-3.5" />}
          {status === 'SUBMITTED' ? 'View' : status === 'REOPENED' ? 'Fix & resubmit' : 'Fill out'}
        </Button>
      ) : (
        <span className={buttonVariants({ variant: 'outline', size: 'sm', className: 'pointer-events-none opacity-50' })}>
          <Lock className="size-3.5" />
          Locked
        </span>
      )}
    </div>
  )
}

function describe(status: 'SUBMITTED' | 'REOPENED' | undefined, unlocked: boolean) {
  if (status === 'SUBMITTED') {
    return { icon: <CheckCircle2 className="size-4 text-success" />, tone: 'bg-success/10', text: 'Submitted' }
  }
  if (status === 'REOPENED') {
    return {
      icon: <RotateCcw className="size-4 text-warning-foreground dark:text-warning" />,
      tone: 'bg-warning/10',
      text: 'Sent back for correction',
    }
  }
  if (!unlocked) {
    return { icon: <Lock className="size-4 text-muted-foreground" />, tone: 'bg-muted', text: 'Locked' }
  }
  return { icon: <Circle className="size-4 text-muted-foreground" />, tone: 'bg-muted', text: 'Not started' }
}
