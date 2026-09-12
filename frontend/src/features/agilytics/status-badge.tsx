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

import { CircleDashed, CircleCheck, Send } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type AgilyticsState = 'not-invited' | 'invited' | 'joined'

export function agilyticsStateOf(row: {
  invited_at?: string | null
  joined_at?: string | null
}): AgilyticsState {
  if (row.joined_at) return 'joined'
  if (row.invited_at) return 'invited'
  return 'not-invited'
}

const STYLE: Record<AgilyticsState, { label: string; className: string; icon: typeof Send }> = {
  'not-invited': {
    label: 'Not invited',
    className: 'text-muted-foreground',
    icon: CircleDashed,
  },
  invited: {
    label: 'Invited',
    className: 'border-info/40 text-info',
    icon: Send,
  },
  joined: {
    label: 'Joined',
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
