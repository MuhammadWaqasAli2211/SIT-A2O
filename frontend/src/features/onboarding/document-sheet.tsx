/**
 * Documents Hub detail view — everything for one required document type,
 * opened from its grid card. One component handles both the classic
 * single-slot types and the multi-file ones (Educational Certificates,
 * Experience Letters); they only differ in whether a new upload replaces
 * the existing file or appends to the list.
 */
import { AlertTriangle, ExternalLink, FileText, ImageOff, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { candidateApi } from '@/features/candidate/api'
import { UploadDropzone } from '@/features/onboarding/dropzone'
import { useMutation } from '@/hooks/use-async'
import type {
  DocumentStatus,
  OnboardingDocumentRecord,
  OnboardingDocumentType,
  RequiredOnboardingDocument,
} from '@/lib/types'
import { cn } from '@/lib/utils'

export function DocumentSheet({
  row,
  applicationId,
  open,
  onOpenChange,
  onChanged,
}: {
  row: RequiredOnboardingDocument | null
  applicationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const upload = useMutation((file: File) =>
    row
      ? candidateApi.uploadOnboardingDocument(applicationId, row.doc_type, file)
      : Promise.reject(new Error('No document type selected')),
  )

  async function handleUpload(file: File) {
    const result = await upload.run(file)
    if (result) {
      toast.success('Uploaded')
      onChanged()
    }
    return Boolean(result)
  }

  if (!row) return null

  const accepted = !row.multi && row.documents[0]?.status === 'ACCEPTED'
  const canAddMore = !accepted && (row.multi || row.documents.length === 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{row.label}</SheetTitle>
          <SheetDescription>
            {row.required ? 'Required' : 'Optional'}
            {row.multi && ' · add as many as you need'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {row.documents.map((document) => (
            <DocumentFileRow
              key={document.id}
              document={document}
              allowReplace={!row.multi}
              onChanged={onChanged}
              uploadArgs={{ applicationId, docType: row.doc_type }}
            />
          ))}

          {upload.error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{upload.error}</AlertDescription>
            </Alert>
          )}

          {canAddMore && (
            <UploadDropzone
              onFile={handleUpload}
              label={row.documents.length === 0 ? 'Drag & drop, or click to browse' : '+ Add another file'}
            />
          )}

          {accepted && (
            <Badge variant="outline" className="w-fit font-normal">
              Accepted — this can no longer be changed.
            </Badge>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------- one file -- */

const STATUS_TONE: Record<DocumentStatus, string> = {
  PENDING: 'text-warning-foreground dark:text-warning',
  ACCEPTED: 'text-success',
  REJECTED: 'text-destructive',
}

const STATUS_TEXT: Record<DocumentStatus, string> = {
  PENDING: 'Awaiting review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
}

function DocumentFileRow({
  document,
  allowReplace,
  onChanged,
  uploadArgs,
}: {
  document: OnboardingDocumentRecord
  allowReplace: boolean
  onChanged: () => void
  uploadArgs: { applicationId: string; docType: OnboardingDocumentType }
}) {
  const isImage = document.content_type.startsWith('image/')
  const [thumb, setThumb] = useState<string | null>(null)
  const [thumbFailed, setThumbFailed] = useState(false)

  useEffect(() => {
    if (!isImage) return
    let cancelled = false
    candidateApi
      .onboardingDocumentLink(document.id)
      .then(({ url }) => {
        if (!cancelled) setThumb(url)
      })
      .catch(() => {
        if (!cancelled) setThumbFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [document.id, isImage])

  const remove = useMutation(() => candidateApi.deleteOnboardingDocument(document.id))
  const view = useMutation(async () => {
    const { url } = await candidateApi.onboardingDocumentLink(document.id)
    window.open(url, '_blank', 'noopener,noreferrer')
  })
  const replace = useMutation((file: File) =>
    candidateApi.uploadOnboardingDocument(uploadArgs.applicationId, uploadArgs.docType, file),
  )

  const accepted = document.status === 'ACCEPTED'

  async function doRemove() {
    if ((await remove.run()) !== undefined) {
      toast.success('Removed')
      onChanged()
    }
  }

  async function doReplace(file: File) {
    const result = await replace.run(file)
    if (result) {
      toast.success('Replaced')
      onChanged()
    }
    return Boolean(result)
  }

  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border border-border p-3', accepted && 'border-success/40')}>
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
          {isImage && thumbFailed ? (
            <ImageOff className="size-4" />
          ) : isImage && thumb ? (
            <img src={thumb} alt="" className="size-full object-cover" onError={() => setThumbFailed(true)} />
          ) : isImage ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{document.file_name}</span>
          <span className={cn('text-xs font-medium', STATUS_TONE[document.status])}>
            {STATUS_TEXT[document.status]}
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
        <Button size="sm" variant="outline" onClick={() => view.run()} disabled={view.pending}>
          {view.pending ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
          View
        </Button>

        {!accepted && (
          <>
            {allowReplace && <ReplaceButton onFile={doReplace} pending={replace.pending} />}
            <Button size="sm" variant="ghost" onClick={doRemove} disabled={remove.pending}>
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function ReplaceButton({
  onFile,
  pending,
}: {
  onFile: (file: File) => Promise<boolean>
  pending: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" />}
        Replace
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onFile(file)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
    </>
  )
}
