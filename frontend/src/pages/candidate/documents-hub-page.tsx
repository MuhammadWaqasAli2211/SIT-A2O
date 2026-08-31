/**
 * The Documents Hub: a scannable grid of the required document types, at
 * /dashboard/documents/hub. Each card opens a Sheet with the actual upload/
 * review detail — see document-card.tsx and document-sheet.tsx.
 */
import { FolderOpen } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/shared/portal-ui'
import { Stagger, StaggerItem } from '@/components/motion/reveal'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { AsyncSection } from '@/features/admin/components'
import { useApplication } from '@/features/applications/application-context'
import { candidateApi } from '@/features/candidate/api'
import { computeDocStatus, DocumentCard } from '@/features/onboarding/document-card'
import { DocumentSheet } from '@/features/onboarding/document-sheet'
import { useAsync } from '@/hooks/use-async'
import type { RequiredOnboardingDocument } from '@/lib/types'

export default function DocumentsHubPage() {
  const { application } = useApplication()

  return (
    <>
      <PageHeader
        title="Documents Hub"
        description="Upload the papers we need to complete your onboarding."
      />
      {application && <Hub applicationId={application.id} />}
    </>
  )
}

function Hub({ applicationId }: { applicationId: string }) {
  const { data, error, initialLoading, refetch } = useAsync(
    () => candidateApi.onboardingDocuments(applicationId),
    [applicationId],
  )
  const [openType, setOpenType] = useState<string | null>(null)
  const activeRow = data?.find((row) => row.doc_type === openType) ?? null

  return (
    <AsyncSection
      initialLoading={initialLoading}
      error={error}
      onRetry={refetch}
      skeleton={<Skeleton className="h-96 w-full rounded-xl" />}
    >
      {data && (
        <div className="flex flex-col gap-6">
          <ProgressSummary rows={data} />

          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((row) => (
              <StaggerItem key={row.doc_type}>
                <DocumentCard row={row} onOpen={() => setOpenType(row.doc_type)} />
              </StaggerItem>
            ))}
          </Stagger>

          <DocumentSheet
            row={activeRow}
            applicationId={applicationId}
            open={activeRow !== null}
            onOpenChange={(next) => !next && setOpenType(null)}
            onChanged={refetch}
          />
        </div>
      )}
    </AsyncSection>
  )
}

function ProgressSummary({ rows }: { rows: RequiredOnboardingDocument[] }) {
  const total = rows.length
  const uploaded = rows.filter((row) => computeDocStatus(row) !== 'empty').length
  const pct = total === 0 ? 0 : Math.round((uploaded / total) * 100)

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <FolderOpen className="size-5" />
      </span>
      <div className="flex flex-1 flex-col gap-2">
        <Progress value={pct}>
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
        <span className="text-xs text-muted-foreground">
          {uploaded} of {total} documents uploaded
        </span>
      </div>
    </div>
  )
}
