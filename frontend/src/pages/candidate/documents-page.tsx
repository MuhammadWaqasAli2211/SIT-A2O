/**
 * Candidate document uploads.
 *
 * Driven by the server's checklist rather than a hardcoded list, so what is
 * asked for can change without a frontend release. Files go straight to a
 * private bucket through the API; reads come back as short-lived signed URLs.
 */

import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AsyncSection } from '@/features/admin/components'
import { candidateApi } from '@/features/candidate/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import {
  DOCUMENT_STATUS_LABEL,
  type ApplicationDetail,
  type DocumentStatus,
  type DocumentType,
  type RequiredDocument,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'
const MAX_MB = 5

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

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CandidateDocumentsPage() {
  const applications = useAsync(() => candidateApi.myApplications(), [])
  const application = applications.data?.[0]

  return (
    <>
      <PageHeader
        title="Documents"
        description="Upload the papers we need to confirm your place."
      />

      <AsyncSection
        initialLoading={applications.initialLoading}
        error={applications.error}
        onRetry={applications.refetch}
        skeleton={<Skeleton className="h-80 w-full rounded-xl" />}
      >
        {!application ? (
          <EmptyState
            icon={FileText}
            title="No application yet"
            description="Documents are collected once you have applied to an intake."
            action={
              <Link to="/dashboard/application" className={buttonVariants({ size: 'sm' })}>
                Apply now
              </Link>
            }
          />
        ) : (
          <Checklist application={application} />
        )}
      </AsyncSection>
    </>
  )
}

function Checklist({ application }: { application: ApplicationDetail }) {
  const { data, error, initialLoading, refetch } = useAsync(
    () => candidateApi.checklist(application.id),
    [application.id],
  )

  const rows = data ?? []
  const required = rows.filter((r) => r.required)
  const done = required.filter((r) => r.document?.status === 'ACCEPTED').length
  const rejected = rows.filter((r) => r.document?.status === 'REJECTED')

  return (
    <AsyncSection
      initialLoading={initialLoading}
      error={error}
      onRetry={refetch}
      skeleton={<Skeleton className="h-80 w-full rounded-xl" />}
    >
      <div className="flex flex-col gap-5">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                {done} of {required.length} required documents accepted
              </span>
              <span className="text-sm text-muted-foreground">
                {application.candidate_code} · {application.bootcamp_name}
              </span>
            </div>
            <div className="h-2 w-full max-w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${required.length ? (done / required.length) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {rejected.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>
              {rejected.length} document{rejected.length === 1 ? '' : 's'} need re-uploading
            </AlertTitle>
            <AlertDescription>
              Read the note under each one, then upload a replacement.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <DocumentSlot
              key={row.doc_type}
              row={row}
              applicationId={application.id}
              onChanged={refetch}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          PDF, JPG, PNG, or WebP · maximum {MAX_MB} MB per file. Your documents are stored
          privately and are only visible to the admissions team.
        </p>
      </div>
    </AsyncSection>
  )
}

function DocumentSlot({
  row,
  applicationId,
  onChanged,
}: {
  row: RequiredDocument
  applicationId: string
  onChanged: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const document = row.document
  const accepted = document?.status === 'ACCEPTED'

  const upload = useMutation((file: File) =>
    candidateApi.upload(applicationId, row.doc_type as DocumentType, file),
  )
  const remove = useMutation(() => candidateApi.deleteDocument(document!.id))
  const view = useMutation(async () => {
    const { url } = await candidateApi.documentLink(document!.id)
    window.open(url, '_blank', 'noopener,noreferrer')
  })

  async function pick(file: File | undefined) {
    if (!file) return
    setLocalError(null)

    // Checked here as well as server-side so an oversized file is not spent on
    // an upload that will be refused.
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`That file is ${formatSize(file.size)}. The limit is ${MAX_MB} MB.`)
      return
    }

    if (await upload.run(file)) {
      toast.success(`${row.label} uploaded`)
      onChanged()
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  async function doRemove() {
    if ((await remove.run()) !== undefined) {
      toast.success(`${row.label} removed`)
      onChanged()
    }
  }

  const StatusIcon = document ? STATUS_ICON[document.status] : null

  return (
    <Card className={cn(accepted && 'border-success/40')}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">{row.label}</CardTitle>
          <CardDescription>
            {row.required ? 'Required' : 'Optional'}
          </CardDescription>
        </div>
        {document && StatusIcon && (
          <span
            className={cn(
              'flex shrink-0 items-center gap-1.5 text-xs font-medium',
              STATUS_TONE[document.status],
            )}
          >
            <StatusIcon className="size-4" />
            {DOCUMENT_STATUS_LABEL[document.status]}
          </span>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {document ? (
          <>
            <div className="flex items-center gap-2.5 rounded-lg border border-border p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{document.file_name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatSize(document.size_bytes)}
                </span>
              </div>
            </div>

            {document.review_note && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{document.review_note}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => view.run()}
                disabled={view.pending}
              >
                {view.pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="size-3.5" />
                )}
                View
              </Button>

              {!accepted && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                    disabled={upload.pending}
                  >
                    {upload.pending && <Loader2 className="size-3.5 animate-spin" />}
                    Replace
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={doRemove}
                    disabled={remove.pending}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                </>
              )}
            </div>

            {accepted && (
              <Badge variant="outline" className="w-fit font-normal">
                Accepted — this can no longer be changed.
              </Badge>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.pending}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-center transition-colors hover:bg-muted/50 disabled:opacity-60"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              {upload.pending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <CloudUpload className="size-5" />
              )}
            </span>
            <span className="text-sm font-medium">
              {upload.pending ? 'Uploading…' : 'Choose a file'}
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, JPG, PNG, or WebP · up to {MAX_MB} MB
            </span>
          </button>
        )}

        {(localError || upload.error || remove.error) && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              {localError ?? upload.error ?? remove.error}
            </AlertDescription>
          </Alert>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0])}
        />
      </CardContent>
    </Card>
  )
}
