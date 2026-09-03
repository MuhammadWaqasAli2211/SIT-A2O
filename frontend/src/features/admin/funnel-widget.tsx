/**
 * The AI Interview -> Physical Interview pipeline, as a funnel.
 *
 * Two stages, each drawn as one proportional bar rather than a row of loose
 * numbers: the segments are sized by their real share, so the narrowing from
 * "attempted" to "passed" to "selected" is visible before a single figure is
 * read. The connector between the stages carries the number that actually
 * crossed from one to the other, which is the only figure that belongs to
 * both and the one a funnel exists to show.
 *
 * Colour is the same vocabulary the rest of the app already uses for these
 * outcomes — success for passed/selected, destructive for failed/rejected,
 * muted for still-pending, warning for missed — so a reader who has seen a
 * status badge here already knows what each band means.
 *
 * The AI half costs an InterviewerAI HTTP call (`aiInterviewApi.completed`,
 * the same one the Completed Interviews screen makes), so it is fetched here
 * on its own and never folded into `bootcampApi.stats()`, which was cut down
 * to a fixed, cheap round-trip count on 2026-08-29. The physical half is a
 * plain DB aggregate already riding along on that call, passed in as a prop.
 */

import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, ChevronDown } from 'lucide-react'

import { Counter } from '@/components/motion/counter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { aiInterviewApi } from '@/features/admin/api'
import { useAsync } from '@/hooks/use-async'
import type { PhysicalInterviewFunnel } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Band {
  label: string
  value: number
  /** Tailwind background for the bar segment. */
  bar: string
  /** Tailwind background for the legend dot. */
  dot: string
}

function FunnelStage({
  label,
  total,
  totalLabel,
  bands,
  compact,
  emptyHint,
}: {
  label: string
  total: number
  totalLabel: string
  bands: Band[]
  compact: boolean
  emptyHint: string
}) {
  const reduce = useReducedMotion()
  const shown = bands.filter((b) => b.value > 0)
  // Shares are taken against the summed bands, not `total`: a band set that
  // does not add up to the headline (an unscored record, say) should still
  // fill the bar it is drawn in rather than leave a phantom gap that reads
  // as a fifth, unlabelled outcome.
  const sum = shown.reduce((acc, b) => acc + b.value, 0)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            'font-medium tracking-wide text-muted-foreground uppercase',
            compact ? 'text-[0.65rem]' : 'text-xs',
          )}
        >
          {label}
        </span>
        <span className="flex items-baseline gap-1.5">
          <Counter
            to={total}
            duration={1.1}
            className={cn('font-semibold tracking-tight', compact ? 'text-xl' : 'text-2xl')}
          />
          <span className="text-xs text-muted-foreground">{totalLabel}</span>
        </span>
      </div>

      {sum === 0 ? (
        <div
          className={cn(
            'grid place-items-center rounded-full border border-dashed border-border',
            compact ? 'h-2.5' : 'h-3.5',
          )}
        />
      ) : (
        <div
          role="img"
          aria-label={`${label}: ${shown.map((b) => `${b.value} ${b.label}`).join(', ')}`}
          className={cn(
            // gap-0.5 lets the track show through between bands, so two
            // adjacent segments read as two outcomes rather than one wider
            // one. The segments shrink to absorb it, which costs a fraction
            // of a percent of width and buys the separation.
            'flex w-full gap-0.5 overflow-hidden rounded-full bg-muted',
            compact ? 'h-2.5' : 'h-3.5',
          )}
        >
          {shown.map((band, index) => (
            <motion.div
              key={band.label}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(band.value / sum) * 100}%` }}
              transition={{ duration: 0.7, delay: 0.06 * index, ease: 'easeOut' }}
              className={cn(band.bar, 'h-full')}
            />
          ))}
        </div>
      )}

      {sum === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className={cn('flex flex-wrap items-center', compact ? 'gap-x-3 gap-y-1' : 'gap-x-4 gap-y-1.5')}>
          {shown.map((band) => (
            <span key={band.label} className="flex items-center gap-1.5">
              <span className={cn('size-2 shrink-0 rounded-full', band.dot)} />
              <span className="text-xs text-muted-foreground">{band.label}</span>
              <span className="text-xs font-semibold tabular-nums">{band.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Connector({ carried, compact }: { carried: number; compact: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', compact ? 'py-1.5' : 'py-3')}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
      <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1">
        <ChevronDown className="size-3 text-success" />
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{carried}</span> carried
          through
        </span>
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
    </div>
  )
}

export function FunnelWidget({
  bootcampId,
  physicalInterviewFunnel,
  compact = false,
}: {
  bootcampId: string
  physicalInterviewFunnel: PhysicalInterviewFunnel
  compact?: boolean
}) {
  const { data: ai, initialLoading, error } = useAsync(
    () => aiInterviewApi.completed(bootcampId),
    [bootcampId],
  )
  const pi = physicalInterviewFunnel

  const aiBands: Band[] = [
    { label: 'Passed', value: ai?.stats.passed ?? 0, bar: 'bg-success', dot: 'bg-success' },
    { label: 'Failed', value: ai?.stats.failed ?? 0, bar: 'bg-destructive', dot: 'bg-destructive' },
  ]

  const piBands: Band[] = [
    { label: 'Selected', value: pi.selected, bar: 'bg-success', dot: 'bg-success' },
    { label: 'Rejected', value: pi.rejected, bar: 'bg-destructive', dot: 'bg-destructive' },
    { label: 'Pending', value: pi.pending, bar: 'bg-muted-foreground/35', dot: 'bg-muted-foreground/35' },
    { label: 'Missed', value: pi.missed, bar: 'bg-warning', dot: 'bg-warning' },
  ]

  const body = (
    <div className="flex flex-col">
      {initialLoading ? (
        <Skeleton className={compact ? 'h-14 w-full' : 'h-16 w-full'} />
      ) : error ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5" />
          Couldn&apos;t load AI interview figures.
        </p>
      ) : (
        <FunnelStage
          label="AI Interview"
          total={ai?.stats.total ?? 0}
          totalLabel="attempted"
          bands={aiBands}
          compact={compact}
          emptyHint="No AI interviews completed yet."
        />
      )}

      <Connector carried={pi.invited} compact={compact} />

      <FunnelStage
        label="Physical Interview"
        total={pi.invited}
        totalLabel="invited"
        bands={piBands}
        compact={compact}
        emptyHint="Nobody invited to a Physical Interview yet."
      />
    </div>
  )

  if (compact) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <span className="mb-3 block text-sm font-medium">Pipeline funnel</span>
        {body}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline funnel</CardTitle>
        <CardDescription>
          From AI screening through the in-person round, for this intake.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
