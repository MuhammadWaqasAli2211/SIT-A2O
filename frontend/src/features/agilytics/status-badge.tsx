/**
 * One candidate's Agilytics state, at a glance, on their folder card.
 *
 * Read from our own two timestamps rather than from Agilytics, on purpose.
 * Their workspace-wide response reports students as counts, so a live badge
 * would cost one request per card — the exact per-row fetch the HR screen's
 * `AgilyticsCell` already exists to avoid. These columns are what we recorded
 * when we confirmed the invite and when we confirmed the join, so the badge is
 * cheap, and it is honest about being our record rather than their live state.
 */

import { CircleDashed, CircleCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Two states, not three.
 *
 * There used to be an "invited" middle state, because their API staged an
 * invitation and the candidate accepted it some time later. Their onboard
 * call has no such gap — a student is an APPROVED member the moment it
 * returns — so a badge distinguishing "invited" from "joined" would be
 * drawing a distinction that can no longer exist.
 */
export type AgilyticsState = 'not-onboarded' | 'onboarded'

export function agilyticsStateOf(row: { onboarded_at?: string | null }): AgilyticsState {
  return row.onboarded_at ? 'onboarded' : 'not-onboarded'
}

const STYLE: Record<
  AgilyticsState,
  { label: string; className: string; icon: typeof CircleCheck }
> = {
  'not-onboarded': {
    label: 'Not onboarded',
    className: 'text-muted-foreground',
    icon: CircleDashed,
  },
  onboarded: {
    label: 'In Agilytics',
    className: 'border-success/40 text-success',
    icon: CircleCheck,
  },
}

export function AgilyticsStatusBadge({
  state,
  className,
}: {
  state: AgilyticsState
  className?: string
}) {
  const style = STYLE[state]
  const Icon = style.icon
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap text-[0.68rem]', style.className, className)}
    >
      <Icon className="size-3" />
      {style.label}
    </Badge>
  )
}
