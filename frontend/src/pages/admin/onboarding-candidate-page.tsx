/**
 * One candidate's onboarding folder: their 4 forms (view-only, with a
 * per-form Reopen action) and their Documents Hub uploads (approve/reject
 * per file).
 */
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/portal-ui'
import { applicationApi, onboardingApi } from '@/features/admin/api'
import { AsyncSection } from '@/features/admin/components'
import { OnboardingSubmissionView } from '@/features/onboarding/submission-view'
import { useAsync, useMutation } from '@/hooks/use-async'
import {
  DOCUMENT_STATUS_LABEL,
  ONBOARDING_FORM_LABEL,
  type DocumentStatus,
  type OnboardingDocumentRecord,
  type OnboardingFormRow,
} from '@/lib/types'
import { cn } from '@/lib/utils'

export default function AdminOnboardingCandidatePage() {
  const { applicationId } = useParams<{ applicationId: string }>()

  const application = useAsync(
    () => (applicationId ? applicationApi.detail(applicationId) : Promise.resolve(undefined)),
    [applicationId],
  )

  if (!applicationId) return null

  return (
    <>
      <Link
        to="/admin/onboarding"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Back to Onboarding
      </Link>
      <PageHeader
        title={application.data ? `${application.data.candidate_code} — ${application.data.full_name ?? 'Unnamed'}` : 'Loading…'}
        description={application.data?.bootcamp_name}
      />

      <AsyncSection
        initialLoading={application.initialLoading}
        error={application.error}
        onRetry={application.refetch}
        skeleton={<Skeleton className="h-96 w-full rounded-xl" />}
      >
        {application.data && (
          <Tabs defaultValue="forms">
            <TabsList>
              <TabsTrigger value="forms">Onboarding Form</TabsTrigger>
              <TabsTrigger value="documents">Documents Hub</TabsTrigger>
            </TabsList>
            <TabsContent value="forms">
              <FormsPanel applicationId={applicationId} dateOfBirth={application.data.date_of_birth} />
            </TabsContent>
            <TabsContent value="documents">
              <DocumentsPanel applicationId={applicationId} />
            </TabsContent>
          </Tabs>
        )}
      </AsyncSection>
    </>
  )
}

/* --------------------------------------------------------------- forms -- */

function FormsPanel({ applicationId, dateOfBirth }: { applicationId: string; dateOfBirth: string | null }) {
  const [reopenTarget, setReopenTarget] = useState<OnboardingFormRow | null>(null)
  // The shared view owns the fetch, so "that reopen landed" is communicated by
  // bumping this rather than by calling a refetch it does not expose.
  const [refreshToken, setRefreshToken] = useState(0)

  return (
    <>
      <OnboardingSubmissionView
        applicationId={applicationId}
        dateOfBirth={dateOfBirth}
        refreshToken={refreshToken}
        renderActions={(row) =>
          row.submission?.status === 'SUBMITTED' && (
            <Button size="sm" variant="outline" onClick={() => setReopenTarget(row)}>
              <RotateCcw className="size-3.5" />
              Reopen for correction
            </Button>
          )
        }
      />

      <ReopenDialog
        row={reopenTarget}
        onClose={() => setReopenTarget(null)}
        onDone={() => setRefreshToken((n) => n + 1)}
      />
    </>
  )
}

function ReopenDialog({
  row,
  onClose,
  onDone,
}: {
  row: OnboardingFormRow | null
  onClose: () => void
  onDone: () => void
}) {
  const [note, setNote] = useState('')
  const reopen = useMutation((submissionId: string, reason: string) => onboardingApi.reopenForm(submissionId, reason || undefined))

  async function confirm() {
    if (!row?.submission) return
    if (await reopen.run(row.submission.id, note)) {
      toast.success(`${ONBOARDING_FORM_LABEL[row.form_type]} reopened for correction`)
      setNote('')
      onClose()
      onDone()
    }
  }

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reopen for correction</DialogTitle>
          <DialogDescription>
            {row && ONBOARDING_FORM_LABEL[row.form_type]} goes back to an editable state for the candidate.
            Everything after it in the sequence re-locks until it is resubmitted.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What needs to be fixed? (optional, but the candidate will see it)"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {reopen.error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{reopen.error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reopen.pending}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={reopen.pending}>
            {reopen.pending && <Loader2 className="size-3.5 animate-spin" />}
            Reopen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------- documents -- */

function DocumentsPanel({ applicationId }: { applicationId: string }) {
  const rows = useAsync(() => onboardingApi.documents(applicationId), [applicationId])
  const [rejectTarget, setRejectTarget] = useState<OnboardingDocumentRecord | null>(null)

  const approve = useMutation((id: string) => onboardingApi.reviewDocument(id, 'ACCEPTED'))

  async function doApprove(doc: OnboardingDocumentRecord) {
    if (await approve.run(doc.id)) {
      toast.success('Approved')
      rows.refetch()
    }
  }

  return (
    <AsyncSection
      initialLoading={rows.initialLoading}
      error={rows.error}
      onRetry={rows.refetch}
      skeleton={<Skeleton className="h-96 w-full rounded-xl" />}
    >
      {rows.data && (
        <Tabs defaultValue={rows.data[0]?.doc_type} orientation="vertical">
          <TabsList className="h-fit w-56 shrink-0 flex-col items-stretch">
            {rows.data.map((row) => (
              <TabsTrigger key={row.doc_type} value={row.doc_type} className="justify-start">
                {row.label}
                {row.documents.length > 0 && (
                  <Badge variant="outline" className="ml-auto text-[0.68rem]">
                    {row.documents.length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {rows.data.map((row) => (
            <TabsContent key={row.doc_type} value={row.doc_type}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-5">
                  <span className="text-sm font-medium">{row.required ? 'Required' : 'Optional'}</span>
                  {row.documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Not uploaded yet.</p>
                  ) : (
                    row.documents.map((doc) => (
                      <AdminDocumentRow
                        key={doc.id}
                        doc={doc}
                        onApprove={() => doApprove(doc)}
                        onReject={() => setRejectTarget(doc)}
                        approving={approve.pending}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <RejectDialog doc={rejectTarget} onClose={() => setRejectTarget(null)} onDone={rows.refetch} />
    </AsyncSection>
  )
}

const STATUS_ICON: Record<DocumentStatus, typeof CheckCircle2> = {
  PENDING: Clock,
  ACCEPTED: CheckCircle2,
  REJECTED: XCircle,
}
const STATUS_TONE: Record<DocumentStatus, string> = {
  PENDING: 'text-warning-foreground dark:text-warning',
  ACCEPTED: 'text-success',
  REJECTED: 'text-destructive',
}

function AdminDocumentRow({
  doc,
  onApprove,
  onReject,
  approving,
}: {
  doc: OnboardingDocumentRecord
  onApprove: () => void
  onReject: () => void
  approving: boolean
}) {
  const view = useMutation(async () => {
    const { url } = await onboardingApi.documentLink(doc.id)
    window.open(url, '_blank', 'noopener,noreferrer')
  })
  const StatusIcon = STATUS_ICON[doc.status]

  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border border-border p-3', doc.status === 'ACCEPTED' && 'border-success/40')}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{doc.file_name}</span>
          <span className="text-xs text-muted-foreground">{(doc.size_bytes / 1024).toFixed(0)} KB</span>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1.5 text-xs font-medium', STATUS_TONE[doc.status])}>
          <StatusIcon className="size-4" />
          {DOCUMENT_STATUS_LABEL[doc.status]}
        </span>
      </div>

      {doc.review_note && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{doc.review_note}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => view.run()} disabled={view.pending}>
          {view.pending ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
          View
        </Button>
        {doc.status !== 'ACCEPTED' && (
          <Button size="sm" onClick={onApprove} disabled={approving}>
            <CheckCircle2 className="size-3.5" />
            Approve
          </Button>
        )}
        {doc.status !== 'REJECTED' && (
          <Button size="sm" variant="destructive" onClick={onReject}>
            <XCircle className="size-3.5" />
            Reject
          </Button>
        )}
      </div>
    </div>
  )
}

function RejectDialog({
  doc,
  onClose,
  onDone,
}: {
  doc: OnboardingDocumentRecord | null
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const reject = useMutation((id: string, note: string) => onboardingApi.reviewDocument(id, 'REJECTED', note))

  async function confirm() {
    if (!doc || !reason.trim()) return
    if (await reject.run(doc.id, reason.trim())) {
      toast.success('Rejected')
      setReason('')
      onClose()
      onDone()
    }
  }

  return (
    <Dialog open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject this document</DialogTitle>
          <DialogDescription>
            {doc?.file_name} — the candidate sees this reason and can re-upload.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Image is blurry, please re-upload"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {reject.error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{reject.error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reject.pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={reject.pending || !reason.trim()}>
            {reject.pending && <Loader2 className="size-3.5 animate-spin" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
