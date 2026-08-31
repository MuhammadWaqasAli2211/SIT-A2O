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
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </motion.div>
  )
}

/* ------------------------------------------------------------- stat card -- */

export function StatCard({
  label,
  value,
  suffix = '',
  decimals = 0,
  icon: Icon,
  trend,
  hint,
  delay = 0,
}: {
  label: string
  value: number
  suffix?: string
  decimals?: number
  icon: LucideIcon
  /** Percentage change; positive renders as an uptick, negative as a downtick. */
  trend?: number
  hint?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
    >
      <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4.5" />
            </span>
          </div>

          <span className="text-3xl font-semibold tracking-tight">
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
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
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
        <motion.li
          key={item.label}
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
