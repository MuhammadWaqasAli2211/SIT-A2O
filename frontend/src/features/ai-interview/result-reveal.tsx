/**
 * The one-time popup a candidate sees the first time their AI interview
 * result is announced.
 *
 * Fires once and never again: dismissing it stamps `result_seen_at`, and
 * every later read comes back with `result_seen: true`.
 *
 * Marked on dismiss, deliberately not on mount. The card behind this polls
 * every 10s, so stamping on mount would flip `result_seen` true underneath
 * the popup and unmount it a moment after it appeared — the result would
 * flash past unread. Dismissal is also the honest signal: a candidate who
 * closed the tab without acknowledging it has not been told, and should be
 * shown it again.
 *
 * The two outcomes are deliberately not symmetrical. Passing is a moment
 * worth marking; not passing is news somebody has to absorb, so it is
 * plain, gives the number that produced it, and closes with something other
 * than a door shutting. Neither is framed as an automated verdict — the same
 * reasoning as the score card's own copy.
 */

import { motion } from 'motion/react'
import { CheckCircle2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { candidateApi } from '@/features/candidate/api'
import { useMutation } from '@/hooks/use-async'
import type { CandidateScore } from '@/lib/types'

export function ResultReveal({
  result,
  onSeen,
}: {
  result: CandidateScore
  onSeen: () => void
}) {
  const passed = result.passed === true

  // A failed stamp leaves the popup to fire again next visit, which is the
  // right way round: better seen twice than a result never shown. Either way
  // the dialog closes, so a network failure never traps the candidate behind
  // an unclosable popup.
  const dismiss = useMutation(async () => {
    await candidateApi.markAiResultSeen()
  })

  async function close() {
    await dismiss.run()
    onSeen()
  }

  return (
    <Dialog open onOpenChange={(next) => !next && void close()}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className={
              passed
                ? 'grid size-16 place-items-center rounded-full bg-success/12 text-success'
                : 'grid size-16 place-items-center rounded-full bg-muted text-muted-foreground'
            }
          >
            {passed ? <Sparkles className="size-7" /> : <CheckCircle2 className="size-7" />}
          </motion.span>

          <DialogTitle className="text-xl">
            {passed ? 'Congratulations!' : 'Your AI interview result'}
          </DialogTitle>

          <div className="flex items-end gap-1.5">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">
              {result.score ?? '—'}
            </span>
            <span className="pb-1 text-sm text-muted-foreground">/ {result.scale}</span>
          </div>

          <DialogDescription className="text-sm">
            {passed ? (
              <>
                You have cleared the AI interview. Stay prepared for your Physical Interview —
                we will email you the venue, date and time, and it will appear on this page as
                soon as it is set.
              </>
            ) : (
              <>
                Your score was below the mark needed for this intake, so your application will
                not continue this time. That is one interview on one day, not a verdict on what
                you can do — Saylani runs new intakes regularly, and you are welcome to apply
                again.
              </>
            )}
          </DialogDescription>

          <Button className="mt-1 w-full" disabled={dismiss.pending} onClick={() => void close()}>
            {passed ? 'Continue' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
