/**
 * The "this is not sourced" line that sits under unverified marketing claims.
 *
 * Components rather than strings pasted at each call site, because what is
 * being promised here is that *every* surface showing these figures or these
 * quotes carries the caveat. That promise is only checkable if there is one
 * thing to check.
 *
 * Visible text, deliberately — not a `title`, not an aria-label, not a
 * tooltip. A caveat only assistive technology can reach is not a caveat; it
 * is a caveat-shaped compliance gesture. Same reasoning as the hero's
 * dashboard preview, which carries its own on-card line for the same reason.
 *
 * Both of these come out the moment real data replaces what they cover — and
 * not before. See `STATS` and `TESTIMONIALS` in site-data.ts for what is
 * unsubstantiated and why.
 */

import { Info } from 'lucide-react'

import { ILLUSTRATIVE_NOTE, TESTIMONIAL_NOTE } from '@/lib/site-data'
import { cn } from '@/lib/utils'

function Caveat({ children, className }: { children: string; className?: string }) {
  return (
    <p
      className={cn(
        'mt-6 flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-muted-foreground/70',
        className,
      )}
    >
      <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span className="max-w-xl">{children}</span>
    </p>
  )
}

/** For any surface rendering `STATS` or the Success Stories outcome figures. */
export function StatCaveat({ className }: { className?: string }) {
  return <Caveat className={className}>{ILLUSTRATIVE_NOTE}</Caveat>
}

/** For any surface rendering graduate quotes. */
export function TestimonialCaveat({ className }: { className?: string }) {
  return <Caveat className={className}>{TESTIMONIAL_NOTE}</Caveat>
}
