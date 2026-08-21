import { CheckCircle2, ExternalLink, FileText, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { documentApi } from '@/features/admin/api'
import {
  AsyncSection,
  BootcampSwitcher,
  ConfirmDialog,
  NoBootcampSelected,
  Pagination,
} from '@/features/admin/components'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import {
  DOCUMENT_STATUS_LABEL,
  type DocumentRow,
  type DocumentStatus,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25
const ALL = 'ALL'

const STATUS_TONE: Record<DocumentStatus, string> = {
  PENDING: 'bg-warning/15 text-warning-foreground dark:text-warning',
  ACCEPTED: 'bg-success/12 text-success',
  REJECTED: 'bg-destructive/12 text-destructive',
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function AdminDocumentsPage() {
  const { selected, selectedId } = useBootcamp()

  const [status, setStatus] = useState<string>(ALL)
  const [offset, setOffset] = useState(0)
  const [reviewing, setReviewing] = useState<DocumentRow | null>(null)

  const { data, error, initialLoading, refetch } = useAsync(
    () =>
      selectedId
        ? documentApi.listForBootcamp(selectedId, {
            status: status === ALL ? undefined : (status as DocumentStatus),
            limit: PAGE_SIZE,
            offset,
          })
        : Promise.resolve(undefined),
    [selectedId, status, offset],
  )

  const rows = data?.items ?? []

  /**
   * Signed URLs are short-lived, so one is minted per click rather than
   * fetched with the list — a link rendered up front would be dead by the
   * time an admin worked down a page of 25.
   */
  const openFile = useMutation(async (id: string) => {
    const { url } = await documentApi.adminLink(id)
    window.open(url, '_blank', 'noopener,noreferrer')
    return url
  })

  return (
    <>
      <PageHeader
        title="Documents"
        description={
          selected
            ? `Review what candidates uploaded for ${selected.name}.`
            : 'Pick an intake to review its documents.'
        }
        actions={<BootcampSwitcher />}
      />

      {!selectedId ? (
        <NoBootcampSelected icon={FileText} />
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            value={status}
            onValueChange={(value) => {
              if (!value) return
              setStatus(value)
              setOffset(0)
            }}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All documents</SelectItem>
              <SelectItem value="PENDING">Awaiting review</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
            {rows.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={status === ALL ? 'No documents yet' : 'No matches'}
                description={
                  status === ALL
                    ? 'Uploads appear here once candidates start submitting their onboarding documents.'
                    : 'Try a different filter.'
                }
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Document</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                          <TableHead className="w-40" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {row.candidate_name ?? row.candidate_code}
                                </span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {row.candidate_code}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm">{row.doc_type.replace(/_/g, ' ')}</span>
                                <span className="text-xs text-muted-foreground">
                                  {row.file_name} · {formatSize(row.size_bytes)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                                  STATUS_TONE[row.status],
                                )}
                              >
                                {DOCUMENT_STATUS_LABEL[row.status]}
                              </span>
                              {row.review_note && (
                                <span className="mt-1 block max-w-52 truncate text-xs text-muted-foreground">
                                  {row.review_note}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(row.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={openFile.pending}
                                  onClick={() => openFile.run(row.id)}
                                >
                                  <ExternalLink className="size-3.5" />
                                  View
                                </Button>
                                <Button size="sm" onClick={() => setReviewing(row)}>
                                  Review
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {data && (
              <Pagination
                total={data.total}
                limit={data.limit}
                offset={data.offset}
                onChange={setOffset}
              />
            )}
          </AsyncSection>
        </div>
      )}

      <ReviewDialog
        document={reviewing}
        onClose={() => setReviewing(null)}
        onSaved={() => {
          setReviewing(null)
          refetch()
        }}
      />
    </>
  )
}

function ReviewDialog({
  document,
  onClose,
  onSaved,
}: {
  document: DocumentRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [decision, setDecision] = useState<DocumentStatus>('ACCEPTED')
  const [note, setNote] = useState('')

  const save = useMutation(() =>
    documentApi.review(document!.id, decision, note || undefined),
  )

  async function submit() {
    if (await save.run()) {
      toast.success(`Document ${decision.toLowerCase()}`)
      setNote('')
      onSaved()
    }
  }

  // The server requires a reason on rejection; block the button rather than
  // letting the request bounce back as a 409.
  const blocked = decision === 'REJECTED' && note.trim().length === 0

  return (
    <ConfirmDialog
      open={document !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Review document"
      confirmLabel={blocked ? 'Add a reason first' : 'Save decision'}
      pending={save.pending || blocked}
      error={save.error}
      onConfirm={submit}
      description={
        <div className="flex flex-col gap-4 pt-2 text-left">
          <p className="text-sm text-muted-foreground">
            {document?.candidate_code} · {document?.doc_type.replace(/_/g, ' ')}
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={decision === 'ACCEPTED' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setDecision('ACCEPTED')}
            >
              <CheckCircle2 className="size-4" />
              Accept
            </Button>
            <Button
              type="button"
              variant={decision === 'REJECTED' ? 'destructive' : 'outline'}
              className="flex-1"
              onClick={() => setDecision('REJECTED')}
            >
              <XCircle className="size-4" />
              Reject
            </Button>
          </div>

          {decision === 'REJECTED' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="review-note">What is wrong with it?</Label>
              <textarea
                id="review-note"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="The candidate sees this, so say what to re-upload."
                className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          {decision === 'ACCEPTED' && (
            <Badge variant="outline" className="w-fit font-normal">
              Accepted documents cannot be replaced by the candidate.
            </Badge>
          )}
        </div>
      }
    />
  )
}
