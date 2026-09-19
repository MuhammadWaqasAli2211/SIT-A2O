/**
 * Recording a Physical Interview result — selected, or not selected with a
 * reason.
 *
 * Lifted out of the invite dialog's batch-history table when the HR Assessment
 * screen grew its own awaiting-decision list. Both surfaces record the same
 * decision against the same invite, so they share this rather than growing two
 * dialogs that would drift on the one thing that must not drift: whether the
 * internal note is captured, and whether it can reach the candidate.
 *
 * The note is required on a rejection. It is the admin's own record — the
 * backend keeps it on the invite row and never passes it to the rejection
 * email — and a decision nobody wrote a reason for is one nobody can review
 * later, which is the whole reason the field exists.
 */

import { useState } from 'react'
import { toast } from 'sonner'

import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { physicalInterviewApi } from '@/features/admin/api'
import { useMutation } from '@/hooks/use-async'

/** The minimum that counts as a reason rather than a keystroke. */
const MIN_NOTE = 4

export interface RecordResultTarget {
  /** The invite row's id — what the result is recorded against. */
  invite_id: string
  candidate_code: string
  full_name?: string | null
}

export function RecordResultDialog({
  target,
  onClose,
  onRecorded,
}: {
  /** Null closes the dialog; a row opens it. */
  target: RecordResultTarget | null
  onClose: () => void
  /** Fired after a result lands, so the caller can refetch. */
  onRecorded: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed on the invite so switching rows resets the form rather than
            carrying one candidate's half-typed note onto the next. */}
        {target && <Body key={target.invite_id} target={target} onRecorded={onRecorded} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  target,
  onRecorded,
}: {
  target: RecordResultTarget
  onRecorded: () => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  const record = useMutation(
    (payload: { result: 'SELECTED' | 'REJECTED'; rejection_note?: string }) =>
      physicalInterviewApi.recordResult(target.invite_id, payload),
  )

  const noteTooShort = note.trim().length < MIN_NOTE

  async function select() {
    if (await record.run({ result: 'SELECTED' })) {
      toast.success(`${target.candidate_code} selected — onboarding unlocked now, email waits for Announce`)
      onRecorded()
    }
  }

  async function reject() {
    if (noteTooShort) return
    if (await record.run({ result: 'REJECTED', rejection_note: note.trim() })) {
      toast.success(`${target.candidate_code} marked Not Selected — email waits for Announce`)
      onRecorded()
    }
  }

  return (
    <>
      <DialogTitle>Record result — {target.candidate_code}</DialogTitle>
      <DialogDescription>
        {rejecting
          ? 'Give a reason for the record. Admins only — the candidate is told the outcome, never the reason, and only once results are announced.'
          : 'Selecting moves this candidate to Onboarding right away. The email telling them waits until you announce results.'}
      </DialogDescription>

      {record.error && (
        <Alert variant="destructive">
          <AlertDescription>{record.error}</AlertDescription>
        </Alert>
      )}

      {rejecting ? (
        <div className="flex flex-col gap-3">
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="e.g. Communication skills weak (internal only)"
            aria-label="Rejection reason"
            className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {noteTooShort ? 'A reason is required.' : `${note.trim().length}/1000`}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setRejecting(false)}>
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={reject}
                disabled={record.pending || noteTooShort}
              >
                <PendingLabel
                  idle="Confirm rejection"
                  pending="Rejecting…"
                  isPending={record.pending}
                />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="destructive" onClick={() => setRejecting(true)}>
            Not selected
          </Button>
          <Button type="button" onClick={select} disabled={record.pending}>
            <PendingLabel idle="Selected" pending="Saving…" isPending={record.pending} />
          </Button>
        </div>
      )}
    </>
  )
}
