/**
 * Physical Interview results: recorded immediately, emailed in bulk.
 *
 * An admin's Selected/Rejected click still advances the candidate's stage the
 * instant it happens (Student's Folder unlocks right away), but the
 * candidate-facing email waits for this action. Every decided candidate sits
 * in "Pending announcement" until an admin announces, at which point both
 * outcomes — Selected and Rejected alike — are emailed together and the row
 * moves to "Announced".
 *
 * The whole thing lives behind one button, in a modal, rather than as a
 * permanent block on the HR Assessment page: it is something an admin does
 * once per round, not something to read past on every visit. The button
 * carries the pending count so the reason to open it is visible without
 * opening it.
 *
 * Modelled on the AI Interview's announce control for the confirm-with-counts
 * shape, but not its mechanics: that one moves stages *at* announce time and
 * can be reversed by hiding results again. This one cannot — an email, once
 * sent, cannot be unsent — so there is no toggle, only a one-way action, and
 * its confirmation is a second step inside the same modal rather than a
 * second dialog stacked on the first.
 */

import { AlertTriangle, CheckCircle2, Megaphone } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppLoader } from '@/components/shared/app-loader'
import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { physicalInterviewApi } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import type { PhysicalInterviewAnnounceRow } from '@/lib/types'

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ResultBadge({ result }: { result: 'SELECTED' | 'REJECTED' }) {
  return result === 'SELECTED' ? (
    <Badge variant="outline" className="border-success/40 text-success">
      Selected
    </Badge>
  ) : (
    <Badge variant="outline" className="border-destructive/40 text-destructive">
      Rejected
    </Badge>
  )
}

function RowsTable({ rows, emptyLabel }: { rows: PhysicalInterviewAnnounceRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Candidate</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Decided</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.invite_id}>
            <TableCell>
              <span className="font-mono text-xs">{row.candidate_code}</span>{' '}
              <span className="text-muted-foreground">{row.full_name ?? ''}</span>
            </TableCell>
            <TableCell>
              <ResultBadge result={row.result} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{formatWhen(row.decided_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** The single trigger on the HR Assessment page. */
export function PhysicalInterviewAnnounceButton({ bootcampId }: { bootcampId: string }) {
  const [open, setOpen] = useState(false)
  // Only the count, for the badge. The lists are fetched when the modal opens,
  // so a page visit that never opens it costs one cheap aggregate, not a roster.
  const summary = useAsync(() => physicalInterviewApi.announceSummary(bootcampId), [bootcampId])
  const pending = (summary.data?.pending_selected ?? 0) + (summary.data?.pending_rejected ?? 0)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Megaphone className="size-4" />
        Announce Physical Interview Results
        {pending > 0 && (
          <Badge className="ml-1 px-1.5" aria-label={`${pending} waiting`}>
            {pending}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[80vh] max-h-[40rem] flex-col gap-0 p-0 sm:max-w-2xl">
          {/* Mounted only while open, so it fetches fresh every time and a
              half-finished confirmation never survives a close. */}
          {open && (
            <Body
              bootcampId={bootcampId}
              onChanged={() => summary.refetch()}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Body({
  bootcampId,
  onChanged,
  onClose,
}: {
  bootcampId: string
  onChanged: () => void
  onClose: () => void
}) {
  const summary = useAsync(() => physicalInterviewApi.announceSummary(bootcampId), [bootcampId])
  const lists = useAsync(() => physicalInterviewApi.announceCandidates(bootcampId), [bootcampId])
  const [confirming, setConfirming] = useState(false)
  const announce = useMutation(() => physicalInterviewApi.announceResults(bootcampId))

  const selected = summary.data?.pending_selected ?? 0
  const rejected = summary.data?.pending_rejected ?? 0
  const totalPending = selected + rejected
  const announcedCount = lists.data?.announced.length ?? 0

  async function confirm() {
    const result = await announce.run()
    if (!result) return
    toast.success(
      `Announced to ${result.emailed} candidate${result.emailed === 1 ? '' : 's'} — ` +
        `${result.selected} selected, ${result.rejected} rejected.`,
    )
    setConfirming(false)
    summary.refetch()
    lists.refetch()
    onChanged()
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-6 py-4">
        <DialogTitle>Physical Interview results</DialogTitle>
        <DialogDescription>
          {totalPending > 0
            ? `${totalPending} decided candidate${totalPending === 1 ? '' : 's'} waiting to be told.`
            : 'Everyone decided so far has been announced.'}
        </DialogDescription>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {summary.initialLoading || lists.initialLoading ? (
          <div className="grid min-h-40 place-items-center">
            <AppLoader size="sm" label="Loading results" />
          </div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">Pending announcement ({totalPending})</TabsTrigger>
              <TabsTrigger value="announced">Announced ({announcedCount})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
              <RowsTable
                rows={lists.data?.pending ?? []}
                emptyLabel="Nothing waiting — every decision so far has been announced."
              />
            </TabsContent>
            <TabsContent value="announced">
              <RowsTable rows={lists.data?.announced ?? []} emptyLabel="Nothing announced yet." />
            </TabsContent>
          </Tabs>
        )}

        {announce.error && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="size-4" />
            <AlertDescription>{announce.error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-6 py-4">
        {confirming ? (
          <>
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                <span className="flex flex-col gap-1.5">
                  <span>
                    <strong>{selected}</strong> selected and <strong>{rejected}</strong> rejected
                    candidate{totalPending === 1 ? '' : 's'} will be emailed their result right away —
                    both outcomes, in the same action.
                  </span>
                  <span>
                    Their stage already moved when each decision was recorded. This only sends the
                    notification, and it cannot be undone once sent.
                  </span>
                </span>
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={announce.pending}>
                Back
              </Button>
              <Button onClick={() => void confirm()} disabled={announce.pending}>
                <CheckCircle2 className="size-4" />
                <PendingLabel idle="Announce results" pending="Announcing…" isPending={announce.pending} />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={totalPending === 0}>
              <Megaphone className="size-4" />
              Announce{totalPending > 0 ? ` ${totalPending}` : ''}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
