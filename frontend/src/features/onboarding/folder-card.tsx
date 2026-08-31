/**
 * A large, folder-shaped entry card for the Student's Folder landing —
 * one per section (Onboarding Form, Documents Hub).
 *
 * The "folder" is two stacked shapes (a back tab, a front panel) rather
 * than a literal file-icon glyph, so it scales cleanly at this size and
 * takes the section's own icon in the middle instead of being generic.
 */
import { Lock, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export type FolderTone = 'idle' | 'partial' | 'complete'

const BADGE_TONE: Record<FolderTone, string> = {
  idle: 'bg-muted text-muted-foreground',
  partial: 'bg-warning/15 text-warning-foreground dark:text-warning',
  complete: 'bg-success/15 text-success',
}

export function FolderCard({
  to,
  icon: Icon,
  title,
  description,
  badgeLabel,
  tone = 'idle',
  locked = false,
}: {
  to: string
  icon: LucideIcon
  title: string
  description: string
  badgeLabel: string
  tone?: FolderTone
  locked?: boolean
}) {
  const className = cn(
    'group relative flex flex-col items-center gap-4 rounded-3xl border border-border bg-card px-6 pt-10 pb-6 text-center transition-all duration-300',
    locked
      ? 'cursor-not-allowed opacity-60'
      : 'cursor-pointer hover:-translate-y-1.5 hover:border-primary/35 hover:shadow-xl hover:shadow-primary/10',
  )

  const content = (
    <>
      {/* The folder shape */}
      <span className="relative grid h-24 w-28 shrink-0 place-items-center">
        <span
          aria-hidden="true"
          className="absolute inset-x-3 top-2 h-16 -rotate-6 rounded-2xl bg-primary/15 transition-transform duration-300 group-hover:-rotate-9"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[4.5rem] rounded-2xl bg-primary shadow-md shadow-primary/20 transition-transform duration-300 group-hover:-translate-y-1"
        >
          <span className="absolute -top-2 left-3 h-3 w-10 rounded-t-md bg-primary" aria-hidden="true" />
        </span>
        <Icon className="relative z-10 mt-5 size-8 text-primary-foreground" />
      </span>

      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="max-w-[20ch] text-xs text-muted-foreground">{description}</p>
      </div>

      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          locked ? BADGE_TONE.idle : BADGE_TONE[tone],
        )}
      >
        {locked && <Lock className="size-3" />}
        {badgeLabel}
      </span>
    </>
  )

  if (locked) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    )
  }

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  )
}
