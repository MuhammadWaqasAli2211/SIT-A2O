/**
 * "This is current" — a small marker for any screen driven by the live layer.
 *
 * Exists because a screen that quietly refreshes itself is indistinguishable
 * from one that has frozen. Without a signal, the reasonable response to a
 * dashboard that has not changed in a minute is to reload it, which is the
 * behaviour the live layer was meant to remove.
 */

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

function ago(from: Date, now: number): string {
  const seconds = Math.max(0, Math.round((now - from.getTime()) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return from.toLocaleTimeString()
}

export function LiveIndicator({
  lastUpdated,
  live,
  className,
}: {
  lastUpdated: Date | null
  live: boolean
  className?: string
}) {
  // Re-rendered on its own timer so "12s ago" keeps counting up between
  // refreshes rather than freezing until the next one lands.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])

  if (!lastUpdated) return null

  return (
    <span
      className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      // Polite: it updates continuously and must not interrupt a screen
      // reader mid-sentence to say the time changed.
      aria-live="polite"
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          live ? 'bg-success animate-pulse motion-reduce:animate-none' : 'bg-muted-foreground/40',
        )}
      />
      {live ? 'Live' : 'Paused'} · updated {ago(lastUpdated, now)}
    </span>
  )
}
