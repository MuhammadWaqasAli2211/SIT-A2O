/**
 * Shared pieces of the admin surface.
 *
 * These exist because all five admin screens are the same shape: pick an
 * intake, load a page of rows, act on one, confirm anything destructive. Each
 * page owning its own copy is how the five drift apart.
 */

import { AlertTriangle, Building2, Loader2, RefreshCw, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { BOOTCAMP_STATUS_LABEL, type BootcampStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------ bootcamp switcher -- */

export function BootcampSwitcher() {
  const { bootcamps, selectedId, select, loading } = useBootcamp()

  if (loading && bootcamps.length === 0) return <Skeleton className="h-9 w-56" />

  if (bootcamps.length === 0) {
    return (
      <Badge variant="outline" className="gap-1.5 py-1.5 font-normal">
        <Building2 className="size-3.5" />
        No intake assigned
      </Badge>
    )
  }

  return (
    <Select
      value={selectedId ?? ''}
      // Base UI hands back null when a selection is cleared; there is no
      // "no intake" state to fall back to, so ignore it.
      onValueChange={(value) => value && select(value)}
      // Without `items`, Select.Value can only show a label once its
      // matching Item has actually mounted — which only happens after the
      // popup has been opened once. `selectedId` is restored from
      // localStorage before that ever happens, so the trigger showed the
      // raw bootcamp uuid until the admin opened the dropdown themselves.
      items={bootcamps.map((bootcamp) => ({ value: bootcamp.id, label: bootcamp.name }))}
    >
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue placeholder="Select a bootcamp" />
      </SelectTrigger>
      <SelectContent>
        {bootcamps.map((bootcamp) => (
          <SelectItem key={bootcamp.id} value={bootcamp.id}>
            {bootcamp.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ------------------------------------------------------------ status pill -- */

const STATUS_TONE: Record<BootcampStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  REG_OPEN: 'bg-success/12 text-success',
  REG_CLOSED: 'bg-warning/15 text-warning-foreground dark:text-warning',
  INTERVIEWING: 'bg-info/12 text-info',
  ASSESSING: 'bg-info/12 text-info',
  ONBOARDING: 'bg-primary/12 text-primary',
  COMPLETED: 'bg-muted text-muted-foreground',
  ARCHIVED: 'bg-muted text-muted-foreground',
}

export function BootcampStatusBadge({ status }: { status: BootcampStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_TONE[status],
      )}
    >
      {BOOTCAMP_STATUS_LABEL[status]}
    </span>
  )
}

/* --------------------------------------------------------- async wrapper -- */

/**
 * One place that decides what a screen shows while loading or after a failure.
 *
 * `initialLoading` rather than `loading` drives the skeleton so that a
 * background refresh leaves the current rows on screen instead of flashing.
 */
export function AsyncSection({
  initialLoading,
  error,
  onRetry,
  skeleton,
  children,
}: {
  initialLoading: boolean
  error: string | null
  onRetry?: () => void
  skeleton?: ReactNode
  children: ReactNode
}) {
  if (initialLoading) {
    return <>{skeleton ?? <TableSkeleton />}</>
  }

  if (error) {
    return (
      <Alert variant="destructive" className="items-center">
        <AlertTriangle className="size-4" />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- prompt -- */

/**
 * Confirmation for anything irreversible.
 *
 * `destructive` is not decoration: deletes here remove candidate history, so
 * the affirmative button has to look different from a routine save.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  destructive?: boolean
  pending?: boolean
  error?: string | null
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Small hook so a page can drive ConfirmDialog without five useStates. */
export function useConfirm<T>() {
  const [target, setTarget] = useState<T | null>(null)
  return {
    target,
    open: target !== null,
    ask: setTarget,
    close: () => setTarget(null),
  }
}

/* ------------------------------------------------------------ pagination -- */

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number
  limit: number
  offset: number
  onChange: (offset: number) => void
}) {
  if (total <= limit) return null

  const page = Math.floor(offset / limit) + 1
  const pages = Math.ceil(total / limit)

  return (
    <div className="flex items-center justify-between gap-4 pt-1">
      <span className="text-sm text-muted-foreground">
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <span className="grid place-items-center px-2 text-sm text-muted-foreground">
          {page} / {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- no selection -- */

export function NoBootcampSelected({ icon: Icon = Building2 }: { icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">No bootcamp selected</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          You are not assigned to any intake yet. A super admin can assign one from the
          Bootcamps screen.
        </p>
      </div>
    </div>
  )
}
