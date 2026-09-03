/**
 * The AI Interview -> Physical Interview funnel, as two summary rows:
 *
 *   AI Interview: 250 attempted -> 180 passed -> 70 failed
 *   Physical Interview: 180 invited -> 120 decided -> 95 selected -> 25 rejected -> 60 pending/missed
 *
 * The AI-interview half costs an InterviewerAI HTTP call (`aiInterviewApi.completed`,
 * the same one the Completed Interviews screen already makes), so it is
 * fetched here on its own — never folded into `bootcampApi.stats()`, which
 * was deliberately cut down to a fixed, cheap round-trip count on
 * 2026-08-29. The physical-interview half is a plain DB aggregate already
 * riding along on that call, passed in as a prop rather than fetched again.
 */

import { AlertTriangle } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { aiInterviewApi } from '@/features/admin/api'
import { useAsync } from '@/hooks/use-async'
import type { PhysicalInterviewFunnel } from '@/lib/types'

function Segment({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 text-center">
      <span className={`text-lg font-semibold tabular-nums ${tone ?? ''}`}>{value}</span>
      <span className="text-[0.68rem] whitespace-nowrap text-muted-foreground">{label}</span>
    </div>
  )
}

function Arrow() {
  return <span className="shrink-0 text-muted-foreground/50">→</span>
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

  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">AI Interview</span>
        {initialLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : error ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5" />
            Couldn&apos;t load AI interview figures.
          </p>
        ) : (
          <div className="flex flex-wrap items-center">
            <Segment label="attempted" value={ai?.stats.total ?? 0} />
            <Arrow />
            <Segment label="passed" value={ai?.stats.passed ?? 0} tone="text-success" />
            <Arrow />
            <Segment label="failed" value={ai?.stats.failed ?? 0} tone="text-destructive" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <span className="text-xs font-medium text-muted-foreground">Physical Interview</span>
        <div className="flex flex-wrap items-center">
          <Segment label="invited" value={pi.invited} />
          <Arrow />
          <Segment label="selected" value={pi.selected} tone="text-success" />
          <Arrow />
          <Segment label="rejected" value={pi.rejected} tone="text-destructive" />
          <Arrow />
          <Segment label="pending" value={pi.pending} />
          <Arrow />
          <Segment label="missed" value={pi.missed} tone="text-warning-foreground dark:text-warning" />
        </div>
      </div>
    </div>
  )

  if (compact) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <span className="mb-2 block text-sm font-medium">Pipeline funnel</span>
        {body}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline funnel</CardTitle>
        <CardDescription>AI Interview results, and the Physical Interview round after it.</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
