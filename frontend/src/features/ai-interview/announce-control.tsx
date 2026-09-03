/**
 * The bulk "announce AI interview results" toggle, bootcamp-scoped.
 *
 * Until it is switched on, a candidate who has finished their interview is
 * told only that it is complete — no score, no verdict. Switching it on
 * reveals every completed candidate's result at once *and* moves each
 * application on: passed to Physical Interview, everyone else to Rejected.
 *
 * Two things this control has to be honest about, both surfaced in the
 * confirm dialog rather than buried:
 *
 *   - Candidates who never completed their interview are rejected alongside
 *     the failures, so their count is shown separately from the failures.
 *   - Hiding again is not an undo. The stage moves stand and the
 *     notifications have already gone out; only the score display goes away.
 */

import { AlertTriangle, Eye, EyeOff, Lock } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { aiInterviewApi } from '@/features/admin/api'
import { ConfirmDialog } from '@/features/admin/components'
import { useAsync, useMutation } from '@/hooks/use-async'

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AnnounceResultsControl({ bootcampId }: { bootcampId: string }) {
  const { data, initialLoading, refetch } = useAsync(
    () => aiInterviewApi.announceSummary(bootcampId),
    [bootcampId],
  )
  const [confirming, setConfirming] = useState(false)

  const apply = useMutation(async (visible: boolean) => {
    await aiInterviewApi.setResultsVisible(bootcampId, visible)
    toast.success(visible ? 'Results announced to candidates' : 'Results hidden from candidates')
    setConfirming(false)
    refetch()
  })

  if (initialLoading || !data) return null

  const announced = data.announced
  // Hiding is always available once announced; announcing waits for the
  // deadline, so nobody can still be sitting the interview when everyone
  // else's result lands.
  const locked = !announced && !data.can_announce

  const control = (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
      {announced ? (
        <Eye className="size-3.5 text-success" />
      ) : locked ? (
        <Lock className="size-3.5 text-muted-foreground" />
      ) : (
        <EyeOff className="size-3.5 text-muted-foreground" />
      )}
      <span className="text-sm whitespace-nowrap">
        {announced ? 'Results visible' : 'Results hidden'}
      </span>
      <Switch
        checked={announced}
        disabled={locked || apply.pending}
        onCheckedChange={() => setConfirming(true)}
        aria-label={announced ? 'Hide results from candidates' : 'Show results to candidates'}
      />
    </div>
  )

  return (
    <>
      {locked ? (
        <Tooltip>
          <TooltipTrigger render={control} />
          <TooltipContent>
            {data.deadline_at
              ? `Results can be announced after the interview deadline (${formatDeadline(data.deadline_at)}).`
              : 'Set an interview deadline on the Phases screen first.'}
          </TooltipContent>
        </Tooltip>
      ) : (
        control
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={announced ? 'Hide results from candidates?' : 'Show results to all candidates?'}
        description={
          announced ? (
            <span className="flex flex-col gap-2">
              <span>
                Candidates will stop seeing their score and pass/fail result.
              </span>
              <span className="flex items-start gap-1.5 text-warning-foreground dark:text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  This does not undo the announcement. Candidates already moved to Physical
                  Interview or Rejected stay where they are, and the notifications they were
                  sent cannot be recalled.
                </span>
              </span>
            </span>
          ) : (
            <span className="flex flex-col gap-2">
              <span>
                <strong>{data.completed}</strong> candidates completed —{' '}
                <strong>{data.passed}</strong> passed, <strong>{data.failed}</strong> failed.
              </span>
              <span>
                Every one of them sees their result immediately. Passed candidates move to
                Physical Interview; the rest move to Rejected.
              </span>
              {data.no_score > 0 && (
                <span className="flex items-start gap-1.5 text-warning-foreground dark:text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <strong>{data.no_score}</strong> invited{' '}
                    {data.no_score === 1 ? 'candidate' : 'candidates'} never completed an
                    interview we can score. They will be rejected too.
                  </span>
                </span>
              )}
            </span>
          )
        }
        confirmLabel={announced ? 'Hide results' : 'Show results'}
        destructive={announced}
        pending={apply.pending}
        error={apply.error}
        onConfirm={() => void apply.run(!announced)}
      />
    </>
  )
}
