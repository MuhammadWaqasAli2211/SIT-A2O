import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Infinite horizontal scroller.
 *
 * The children are rendered as two identical copies inside a track that
 * translates by exactly -50%. Because each copy is the same width, the second
 * lands precisely where the first began and the loop has no visible seam.
 * Pauses on hover so anything inside stays readable and clickable.
 */
export function Marquee({
  children,
  className,
  duration = '40s',
  reverse = false,
  pauseOnHover = true,
}: {
  children: ReactNode
  className?: string
  duration?: string
  reverse?: boolean
  pauseOnHover?: boolean
}) {
  return (
    <div
      className={cn(
        'group relative flex overflow-hidden',
        // Fade the edges so items enter and leave rather than being clipped.
        '[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]',
        className,
      )}
    >
      <div
        className={cn(
          'flex w-max animate-[marquee_linear_infinite]',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={{
          animationDuration: duration,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        {/* aria-hidden: the duplicate exists only to make the loop continuous. */}
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  )
}
