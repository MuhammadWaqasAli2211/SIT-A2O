import { motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Counter } from '@/components/motion/counter'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { STAGE_LABEL, type ApplicationStage } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ---------------------------------------------------------- page header -- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  /** A node, not just a string, so a page can style part of its own title —
   *  the candidate dashboard sets the greeting's name in the display face. */
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      {/* `min-w-0`: a flex item will not shrink below its content's width by
          default, so a long title — a greeting carrying someone's full name —
          overflowed the row and was clipped at the viewport edge instead of
          wrapping. */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-lg font-semibold tracking-tight break-words sm:text-xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {/* `flex-wrap`, with the first action allowed to shrink instead of
          claiming the row: the bootcamp switcher is `w-full` below `sm`,
          which under plain `flex-wrap` bumped every other action onto its
          own line even when only one small button followed it. Overriding
          the switcher to `min-w-0 flex-1` fixes that case — it now shares
          the first line with as much as fits — while `flex-wrap` itself
          stays on so a header with three or four actions (more than one
          switcher-sized shrink can make room for) wraps onto a second line
          instead of overflowing the page.

          Not `shrink-0` any more: that pinned this whole block to its
          unwrapped, one-line preferred width at `sm` and up, which gave
          `flex-wrap` nothing to wrap against (the box was already exactly
          as wide as its widest possible line) and squeezed the title down
          to its own `min-w-0`, wrapping a short heading letter by letter.
          Letting this shrink like a normal flex item means a wide action
          group gives ground first, wrapping its own buttons onto a second
          line, before the title loses any room. */}
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1 sm:[&>*:first-child]:flex-none">
          {actions}
        </div>
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------- stat card -- */

/** Accent tones for the stat grid — see `TONE_STYLE`. */
export type StatTone = 'primary' | 'info' | 'success' | 'warning'

/**
 * One accent colour per card, applied in three places: a bar across the
 * top, the icon chip, and the hover border.
 *
 * The chip is a light tint at rest and goes to full saturation on hover,
 * rather than sitting solid the whole time — a card that already shouts
 * has nowhere to go when you point at it. The hover border is the card's
 * *own* colour too: a blue card that turns green under the cursor reads as
 * a theme bug, not as feedback.
 *
 * Every class is written out in full because Tailwind scans source text —
 * a template-built `bg-${tone}` name is not in the output CSS at all.
 */
const TONE_STYLE: Record<StatTone, { bar: string; chip: string; border: string }> = {
  primary: {
    bar: 'bg-primary',
    chip: 'bg-primary/15 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-primary/30',
    border: 'hover:border-primary',
  },
  info: {
    bar: 'bg-info',
    chip: 'bg-info/15 text-info group-hover:bg-info group-hover:text-info-foreground group-hover:shadow-info/30',
    border: 'hover:border-info',
  },
  success: {
    bar: 'bg-success',
    chip: 'bg-success/15 text-success group-hover:bg-success group-hover:text-success-foreground group-hover:shadow-success/30',
    border: 'hover:border-success',
  },
  warning: {
    bar: 'bg-warning',
    chip: 'bg-warning/20 text-warning-foreground group-hover:bg-warning group-hover:text-warning-foreground group-hover:shadow-warning/30 dark:text-warning',
    border: 'hover:border-warning',
  },
}

export function StatCard({
  label,
  value,
  suffix = '',
  decimals = 0,
  icon: Icon,
  trend,
  hint,
  tone = 'primary',
}: {
  label: string
  value: number
  suffix?: string
  decimals?: number
  icon: LucideIcon
  /** Percentage change; positive renders as an uptick, negative as a downtick. */
  trend?: number
  hint?: string
  tone?: StatTone
}) {
  const toneStyle = TONE_STYLE[tone]

  return (
    <Card
      className={cn(
        'group relative h-full overflow-hidden border-2 border-foreground/15 py-0',
        'transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/10',
        toneStyle.border,
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-0.5', toneStyle.bar)} />
      <CardContent className="flex flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[0.7rem] font-medium text-muted-foreground sm:text-xs">{label}</span>
          <span
            className={cn(
              'grid size-6 shrink-0 place-items-center rounded-lg transition-all duration-200 ease-out group-hover:scale-105 group-hover:shadow-md sm:size-7',
              toneStyle.chip,
            )}
          >
            <Icon className="size-3.5 sm:size-4" />
          </span>
        </div>

        <span className="text-lg font-bold tracking-tight sm:text-xl">
          <Counter to={value} suffix={suffix} decimals={decimals} />
        </span>

        <div className="flex items-center gap-2 text-xs">
          {trend !== undefined && (
            <span
              className={cn(
                'flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
                trend >= 0 ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive',
              )}
            >
              {trend >= 0 ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {Math.abs(trend)}%
            </span>
          )}
          {hint && <span className="truncate text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------- status badge -- */

const STAGE_STYLE: Record<ApplicationStage, string> = {
  APPLIED: 'bg-muted text-muted-foreground',
  INTERVIEW_SCHEDULED: 'bg-info/12 text-info',
  'AI-INTERVIEWED': 'bg-info/12 text-info',
  PHYSICAL_INTERVIEW: 'bg-success/12 text-success',
  FORM: 'bg-warning/15 text-warning-foreground dark:text-warning',
  ONBOARDED: 'bg-success/12 text-success',
  REJECTED: 'bg-destructive/12 text-destructive',
}

export function StageBadge({ stage, className }: { stage: ApplicationStage; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STAGE_STYLE[stage],
        className,
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  )
}

export function StatusDot({
  tone,
  label,
}: {
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
  label: string
}) {
  const dot = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
    info: 'bg-info',
    neutral: 'bg-muted-foreground',
  }[tone]

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn('size-2 shrink-0 rounded-full', dot)} />
      {label}
    </span>
  )
}

/* ---------------------------------------------------------- empty state -- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/* -------------------------------------------------------------- timeline -- */

export function Timeline({
  items,
}: {
  items: readonly {
    label: string
    date: string
    status: 'done' | 'active' | 'pending'
    detail?: string
  }[]
}) {
  return (
    <ol className="relative flex flex-col gap-7">
      <span
        aria-hidden="true"
        className="absolute top-2 bottom-2 left-[0.9375rem] w-px bg-border"
      />
      {items.map((item, index) => (
        // Keyed by position, not `item.label`: this is a chronological
        // history, not a filterable/reorderable list, and a candidate who
        // was reinstated revisits the same stage label twice — React saw
        // two "Physical interview" children with the same key and warned
        // that one could be silently dropped.
        <motion.li
          key={index}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: index * 0.09 }}
          className="relative flex gap-4"
        >
          <span
            className={cn(
              'z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ring-4 ring-card',
              item.status === 'done' && 'bg-success text-success-foreground',
              item.status === 'active' && 'bg-warning text-warning-foreground',
              item.status === 'pending' && 'bg-muted text-muted-foreground',
            )}
          >
            {item.status === 'active' && (
              <span className="absolute inset-0 animate-ping rounded-full bg-warning/40" />
            )}
            {index + 1}
          </span>

          <div className="flex flex-1 flex-col gap-1 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{item.label}</span>
              <Badge variant="outline" className="text-[0.7rem] font-normal">
                {item.date}
              </Badge>
            </div>
            {item.detail && (
              <span className="text-sm text-muted-foreground">{item.detail}</span>
            )}
          </div>
        </motion.li>
      ))}
    </ol>
  )
}
