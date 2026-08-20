/**
 * Live countdown to a deadline.
 *
 * Ticks once a second and stops itself at zero rather than counting into
 * negatives. The deadline is authoritative on the server — this is a reminder,
 * not a gate, and the API rejects late submissions regardless of what the
 * clock here says.
 */

import { useEffect, useState } from 'react'
import { AlarmClock } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Remaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

function remainingUntil(target: number): Remaining {
  const ms = target - Date.now()
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }

  const seconds = Math.floor(ms / 1000)
  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3_600),
    minutes: Math.floor((seconds % 3_600) / 60),
    seconds: seconds % 60,
    expired: false,
  }
}

export function Countdown({
  deadline,
  label = 'Closes in',
  className,
}: {
  /** ISO 8601 timestamp. */
  deadline: string
  label?: string
  className?: string
}) {
  const target = new Date(deadline).getTime()
  const valid = !Number.isNaN(target)

  const [left, setLeft] = useState(() =>
    valid ? remainingUntil(target) : null,
  )

  useEffect(() => {
    if (!valid) return
    const tick = () => {
      const next = remainingUntil(target)
      setLeft(next)
      return next.expired
    }
    if (tick()) return

    const timer = setInterval(() => {
      if (tick()) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [target, valid])

  if (!valid || !left) return null

  if (left.expired) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive',
          className,
        )}
      >
        <AlarmClock className="size-4" />
        Deadline passed
      </span>
    )
  }

  // Seconds are noise once there is more than a day left, and a per-second
  // repaint of a number nobody is watching is wasted work.
  const units = left.days
    ? [
        { value: left.days, suffix: 'd' },
        { value: left.hours, suffix: 'h' },
        { value: left.minutes, suffix: 'm' },
      ]
    : [
        { value: left.hours, suffix: 'h' },
        { value: left.minutes, suffix: 'm' },
        { value: left.seconds, suffix: 's' },
      ]

  const urgent = left.days === 0

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {units.map((unit) => (
          <span
            key={unit.suffix}
            className={cn(
              'inline-flex min-w-11 flex-col items-center rounded-lg border px-2 py-1.5',
              urgent
                ? 'border-destructive/30 bg-destructive/8'
                : 'border-border bg-muted/50',
            )}
          >
            <span
              className={cn(
                'font-mono text-lg leading-none font-semibold tabular-nums',
                urgent && 'text-destructive',
              )}
            >
              {String(unit.value).padStart(2, '0')}
            </span>
            <span className="text-[0.6rem] text-muted-foreground uppercase">
              {unit.suffix}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
