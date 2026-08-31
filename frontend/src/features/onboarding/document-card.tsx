/**
 * One Documents Hub grid card — a scannable summary of one required
 * document type. Deliberately shows a generic file icon rather than a
 * thumbnail: a signed preview URL per card would mean 7-9 network
 * requests just to render the grid. The real thumbnail loads lazily,
 * inside DocumentSheet, once a card is actually opened.
 */
import { AlertTriangle, CheckCircle2, Clock, FileQuestion, FileText, Upload, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { RequiredOnboardingDocument } from '@/lib/types'
import { cn } from '@/lib/utils'

export type DocCardStatus = 'empty' | 'pending' | 'accepted' | 'rejected'

export function computeDocStatus(row: RequiredOnboardingDocument): DocCardStatus {
  if (row.documents.length === 0) return 'empty'
  if (row.documents.some((d) => d.status === 'REJECTED')) return 'rejected'
  if (row.documents.every((d) => d.status === 'ACCEPTED')) return 'accepted'
  return 'pending'
}

const STATUS_META: Record<DocCardStatus, { label: string; badge: string; icon: LucideIcon }> = {
  empty: { label: 'Not uploaded', badge: 'bg-muted text-muted-foreground', icon: FileQuestion },
  pending: { label: 'Pending review', badge: 'bg-warning/15 text-warning-foreground dark:text-warning', icon: Clock },
  accepted: { label: 'Approved', badge: 'bg-success/15 text-success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', badge: 'bg-destructive/15 text-destructive', icon: AlertTriangle },
}

export function DocumentCard({ row, onOpen }: { row: RequiredOnboardingDocument; onOpen: () => void }) {
  const status = computeDocStatus(row)
  const meta = STATUS_META[status]
  const StatusIcon = meta.icon
  const rejectedNote = row.documents.find((d) => d.status === 'REJECTED')?.review_note

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'group h-full cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg',
        status === 'rejected' && 'border-destructive/40',
        status === 'accepted' && 'border-success/40',
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <FileText className="size-4.5" />
          </span>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium',
              meta.badge,
            )}
          >
            <StatusIcon className="size-3" />
            {meta.label}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{row.label}</span>
          <span className="text-xs text-muted-foreground">
            {row.required ? 'Required' : 'Optional'}
            {row.multi && ' · multiple files'}
            {row.documents.length > 0 &&
              ` · ${row.documents.length} file${row.documents.length > 1 ? 's' : ''}`}
          </span>

          {status === 'rejected' && rejectedNote && (
            <p className="mt-1.5 line-clamp-2 rounded-lg bg-destructive/8 px-2.5 py-1.5 text-xs text-destructive">
              {rejectedNote}
            </p>
          )}
        </div>

        <Button
          size="sm"
          variant={status === 'empty' ? 'default' : 'outline'}
          className="w-full"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          {status === 'empty' ? (
            <>
              <Upload className="size-3.5" />
              Upload
            </>
          ) : status === 'rejected' ? (
            'Re-upload'
          ) : (
            'Manage'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
