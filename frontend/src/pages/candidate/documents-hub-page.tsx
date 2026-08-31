/**
 * The Documents Hub: one tab per required document type, at
 * /dashboard/documents/hub. Single-file types (CNIC, Father's CNIC, ...)
 * behave like a classic upload slot; EDUCATIONAL_CERT and EXPERIENCE_LETTER
 * hold a list, with an "Add file" control instead of "Replace".
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
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/portal-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AsyncSection } from '@/features/admin/components'
import { useApplication } from '@/features/applications/application-context'
import { candidateApi } from '@/features/candidate/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import {
  DOCUMENT_STATUS_LABEL,
  type DocumentStatus,
  type OnboardingDocumentRecord,
  type OnboardingDocumentType,
  type RequiredOnboardingDocument,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'
const MAX_MB = 5

export default function DocumentsHubPage() {
  const { application } = useApplication()

  return (
    <>
      <PageHeader title="Documents Hub" description="Upload the papers we need to complete your onboarding." />
      {application && <Hub applicationId={application.id} />}
    </>
  )
}

function Hub({ applicationId }: { applicationId: string }) {
  const { data, error, initialLoading, refetch } = useAsync(
    () => candidateApi.onboardingDocuments(applicationId),
    [applicationId],
  )

  return (
    <AsyncSection
      initialLoading={initialLoading}
      error={error}
      onRetry={refetch}
      skeleton={<Skeleton className="h-96 w-full rounded-xl" />}
    >
      {data && (
        <Tabs defaultValue={data[0]?.doc_type} orientation="vertical">
          <TabsList className="h-fit w-56 shrink-0 flex-col items-stretch">
            {data.map((row) => (
              <TabsTrigger key={row.doc_type} value={row.doc_type} className="justify-start">
                {row.label}
                {tabBadge(row)}
              </TabsTrigger>
            ))}
          </TabsList>

          {data.map((row) => (
            <TabsContent key={row.doc_type} value={row.doc_type}>
              {row.multi ? (
                <MultiFileTab row={row} applicationId={applicationId} onChanged={refetch} />
              ) : (
                <SingleFileTab row={row} applicationId={applicationId} onChanged={refetch} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </AsyncSection>
  )
}

function tabBadge(row: RequiredOnboardingDocument) {
  if (row.documents.length === 0) return null
  const rejected = row.documents.some((d) => d.status === 'REJECTED')
  const allAccepted = row.documents.every((d) => d.status === 'ACCEPTED')
  if (rejected) return <span className="ml-auto size-1.5 shrink-0 rounded-full bg-destructive" />
  if (allAccepted) return <span className="ml-auto size-1.5 shrink-0 rounded-full bg-success" />
  return <span className="ml-auto size-1.5 shrink-0 rounded-full bg-warning" />
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* --------------------------------------------------------- single-file -- */

function SingleFileTab({
  row,
  applicationId,
  onChanged,
}: {
  row: RequiredOnboardingDocument
  applicationId: string
  onChanged: () => void
}) {
  const document = row.documents[0]

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{row.required ? 'Required' : 'Optional'}</span>
        </div>
        {document ? (
          <DocumentSlot
            document={document}
            allowReplace
            onChanged={onChanged}
            uploadArgs={{ applicationId, docType: row.doc_type }}
          />
        ) : (
          <UploadDropzone applicationId={applicationId} docType={row.doc_type} onChanged={onChanged} />
        )}
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------- multi-file -- */

function MultiFileTab({
  row,
  applicationId,
  onChanged,
}: {
  row: RequiredOnboardingDocument
  applicationId: string
  onChanged: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <span className="text-sm font-medium">{row.required ? 'Required' : 'Optional'} · multiple files</span>

        {row.documents.map((document) => (
          <DocumentSlot key={document.id} document={document} allowReplace={false} onChanged={onChanged} />
        ))}

        <UploadDropzone
          applicationId={applicationId}
          docType={row.doc_type}
          onChanged={onChanged}
          label={row.documents.length === 0 ? 'Choose a file' : '+ Add another file'}
        />
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------ dropzone -- */

function UploadDropzone({
  applicationId,
  docType,
  onChanged,
  label = 'Choose a file',
}: {
  applicationId: string
  docType: OnboardingDocumentType
  onChanged: () => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const upload = useMutation((file: File) => candidateApi.uploadOnboardingDocument(applicationId, docType, file))

  async function pick(file: File | undefined) {
    if (!file) return
    setLocalError(null)
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`That file is ${formatSize(file.size)}. The limit is ${MAX_MB} MB.`)
      return
    }
    if (await upload.run(file)) {
      toast.success('Uploaded')
      onChanged()
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.pending}
        className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-center transition-colors hover:bg-muted/50 disabled:opacity-60"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
          {upload.pending ? <Loader2 className="size-5 animate-spin" /> : <CloudUpload className="size-5" />}
        </span>
        <span className="text-sm font-medium">{upload.pending ? 'Uploading…' : label}</span>
        <span className="text-xs text-muted-foreground">PDF, JPG, PNG, or WebP · up to {MAX_MB} MB</span>
      </button>

      {(localError || upload.error) && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{localError ?? upload.error}</AlertDescription>
        </Alert>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  )
}

/* ------------------------------------------------------------- one row -- */

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

function DocumentSlot({
  document,
  allowReplace,
  onChanged,
  uploadArgs,
}: {
  document: OnboardingDocumentRecord
  allowReplace: boolean
  onChanged: () => void
  uploadArgs?: { applicationId: string; docType: OnboardingDocumentType }
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const accepted = document.status === 'ACCEPTED'
  const StatusIcon = STATUS_ICON[document.status]

  const remove = useMutation(() => candidateApi.deleteOnboardingDocument(document.id))
  const view = useMutation(async () => {
    const { url } = await candidateApi.onboardingDocumentLink(document.id)
    window.open(url, '_blank', 'noopener,noreferrer')
  })
  const upload = useMutation((file: File) =>
    uploadArgs
      ? candidateApi.uploadOnboardingDocument(uploadArgs.applicationId, uploadArgs.docType, file)
      : Promise.reject(new Error('not replaceable')),
  )

  async function doRemove() {
    if ((await remove.run()) !== undefined) {
      toast.success('Removed')
      onChanged()
    }
  }

  async function doReplace(file: File | undefined) {
    if (!file) return
    if (await upload.run(file)) {
      toast.success('Replaced')
      onChanged()
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border border-border p-3', accepted && 'border-success/40')}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{document.file_name}</span>
          <span className="text-xs text-muted-foreground">{formatSize(document.size_bytes)}</span>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1.5 text-xs font-medium', STATUS_TONE[document.status])}>
          <StatusIcon className="size-4" />
          {DOCUMENT_STATUS_LABEL[document.status]}
        </span>
      </div>

      {document.review_note && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{document.review_note}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => view.run()} disabled={view.pending}>
          {view.pending ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
          View
        </Button>

        {!accepted && (
          <>
            {allowReplace && uploadArgs && (
              <>
                <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={upload.pending}>
                  {upload.pending && <Loader2 className="size-3.5 animate-spin" />}
                  Replace
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => doReplace(e.target.files?.[0])}
                />
              </>
            )}
            <Button size="sm" variant="ghost" onClick={doRemove} disabled={remove.pending}>
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
    </div>
  )
}
