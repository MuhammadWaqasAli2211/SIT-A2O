/**
 * Reviewing one uploaded document without leaving the page.
 *
 * Replaces the `window.open(url, '_blank')` this screen used to do. That
 * handed the reviewer off to a bare browser tab showing a file with no
 * candidate, no context and no actions — every approve/reject meant coming
 * back, finding the row again, and remembering what was in the file. The
 * preview and the decision belong in the same frame.
 *
 * The link is fetched when the dialog opens, never for a list: these are
 * short-lived signed URLs (DOCUMENT_SIGNED_URL_TTL, 120s by default), so
 * minting one per row up front would hand out a page of URLs that are mostly
 * expired before anybody clicks. Re-opening mints a fresh one.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppLoader } from '@/components/shared/app-loader'
import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { onboardingApi } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import { DOCUMENT_STATUS_LABEL, type OnboardingDocumentRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Long enough to be a reason, short enough not to be a form. */
const MIN_REASON = 4

export function DocumentReviewDialog({
  doc,
  onClose,
  onReviewed,
}: {
  /** Null closes it; a record opens it. */
  doc: OnboardingDocumentRecord | null
  onClose: () => void
  onReviewed: () => void
}) {
  return (
    <Dialog open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[88vh] max-h-[54rem] flex-col gap-0 p-0 sm:max-w-4xl">
        {/* Keyed on the document so moving to the next one refetches its link
            and clears any half-typed rejection reason. */}
        {doc && <Body key={doc.id} doc={doc} onClose={onClose} onReviewed={onReviewed} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  doc,
  onClose,
  onReviewed,
}: {
  doc: OnboardingDocumentRecord
  onClose: () => void
  onReviewed: () => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const link = useAsync(() => onboardingApi.documentLink(doc.id), [doc.id])
  const review = useMutation((payload: { status: 'ACCEPTED' | 'REJECTED'; note?: string }) =>
    onboardingApi.reviewDocument(doc.id, payload.status, payload.note),
  )

  const reasonTooShort = reason.trim().length < MIN_REASON

  async function approve() {
    if (await review.run({ status: 'ACCEPTED' })) {
      toast.success(`Approved — ${doc.file_name}`)
      onReviewed()
      onClose()
    }
  }

  async function reject() {
    if (reasonTooShort) return
    if (await review.run({ status: 'REJECTED', note: reason.trim() })) {
      toast.success(`Rejected — the candidate can now re-upload ${doc.file_name}`)
      onReviewed()
      onClose()
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-6 py-4">
        <DialogTitle className="truncate">{doc.file_name}</DialogTitle>
        <DialogDescription>
          {(doc.size_bytes / 1024).toFixed(0)} KB · {DOCUMENT_STATUS_LABEL[doc.status]}
          {doc.review_note ? ` · previously: ${doc.review_note}` : ''}
        </DialogDescription>
      </div>

      <div className="min-h-0 flex-1 bg-muted/40">
        <Preview
          contentType={doc.content_type}
          fileName={doc.file_name}
          url={link.data?.url}
          loading={link.initialLoading}
          error={link.error}
          onRetry={link.refetch}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-6 py-4">
        {review.error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{review.error}</AlertDescription>
          </Alert>
        )}

        {rejecting ? (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              aria-label="Rejection reason"
              placeholder="e.g. Image is blurry — please re-upload a clearer scan"
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {reasonTooShort
                  ? 'A reason is required — the candidate sees it and re-uploads against it.'
                  : 'The candidate sees this reason and can re-upload.'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRejecting(false)}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={reject}
                  disabled={review.pending || reasonTooShort}
                >
                  <PendingLabel
                    idle="Confirm rejection"
                    pending="Rejecting…"
                    isPending={review.pending}
                  />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* A real download, for the reviewer who wants the file itself.
                Deliberately the only thing here that leaves the page. */}
            {link.data?.url && (
              <a
                href={link.data.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Download className="size-3.5" />
                Download
              </a>
            )}
            {doc.status !== 'REJECTED' && (
              <Button variant="destructive" onClick={() => setRejecting(true)}>
                <XCircle className="size-3.5" />
                Reject
              </Button>
            )}
            {doc.status !== 'ACCEPTED' && (
              <Button onClick={approve} disabled={review.pending}>
                <CheckCircle2 className="size-3.5" />
                <PendingLabel
                  idle="Approve"
                  pending="Approving…"
                  isPending={review.pending}
                />
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------- preview -- */

function Preview({
  contentType,
  fileName,
  url,
  loading,
  error,
  onRetry,
}: {
  contentType: string
  fileName: string
  url: string | undefined
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <AppLoader size="sm" />
      </div>
    )
  }

  if (error || !url) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {error ?? 'That preview link could not be created.'}
          </p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  // The two shapes the upload validator actually admits: PDFs and images.
  // Anything else could only be guessed at, so it says so rather than
  // rendering a broken frame.
  if (contentType === 'application/pdf') {
    return <iframe src={url} title={fileName} className="size-full border-0" />
  }

  if (contentType.startsWith('image/')) {
    return (
      <div className={cn('grid h-full place-items-center overflow-auto p-4')}>
        <img src={url} alt={fileName} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  return (
    <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
      This file type cannot be previewed here — download it to review.
    </div>
  )
}
