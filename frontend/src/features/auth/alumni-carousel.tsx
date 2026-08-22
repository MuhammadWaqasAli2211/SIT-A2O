import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { ALUMNI, ROTATION_MS } from '@/features/auth/alumni'
import { cn } from '@/lib/utils'

/**
 * The rotating alumni quote on the auth pages' brand pane.
 *
 * Deliberately its own component with its own state. The auth pages hold live
 * form state (react-hook-form, submit errors), and a timer ticking every few
 * seconds in a shared parent would re-render the form pane along with it —
 * cheap per tick, but pointless work forever on a page a user may sit on
 * while typing a password. Nothing here is lifted, so the form never hears
 * about it.
 *
 * The animation is a CSS keyframe (`dial-flip` in index.css), not a JS
 * animation loop: `useReducedMotion` only picks *which* class to apply, then
 * the compositor does the rest.
 */
export function AlumniCarousel({ className }: { className?: string }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (paused || ALUMNI.length < 2) return

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ALUMNI.length)
    }, ROTATION_MS)

    return () => clearInterval(id)
  }, [paused])

  // Non-null: the modulo above cannot leave the array, but
  // `noUncheckedIndexedAccess` cannot know that.
  const alum = ALUMNI[index]!

  return (
    <figure
      className={cn('relative', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Pause for keyboard users too — a quote that swaps mid-read is just as
      // disruptive whether the pointer or the caret got there.
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      // The dial changes on its own, so a screen reader should hear the new
      // quote — but politely, never interrupting the form being filled in.
      aria-live="polite"
      aria-atomic="true"
      // Establishes the 3D space the flip hinges in. Without it the rotateX
      // reads as a vertical squash instead of a card tipping toward you.
      style={{ perspective: '1200px' }}
    >
      <div
        // Keyed on the index so React replaces the node on every advance,
        // which restarts the CSS animation. Re-triggering a keyframe on a
        // persistent element otherwise needs a reflow hack.
        key={index}
        className={cn(
          'rounded-2xl bg-card p-6 shadow-lg ring-1 ring-black/5 sm:p-7',
          'origin-top will-change-transform',
          reduce ? 'animate-dial-fade' : 'animate-dial-flip',
        )}
      >
        <span
          aria-hidden="true"
          className="block font-serif text-5xl leading-none text-primary"
        >
          &ldquo;
        </span>

        <blockquote className="mt-2 text-[0.95rem] leading-relaxed text-card-foreground">
          {alum.quote}
        </blockquote>

        <span
          aria-hidden="true"
          className="block text-right font-serif text-5xl leading-none text-primary"
        >
          &rdquo;
        </span>

        <figcaption className="mt-3 flex items-center gap-3 border-t border-border pt-4">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {alum.initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-card-foreground">
              {alum.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {alum.programme} · {alum.cohort}
            </span>
          </span>
        </figcaption>
      </div>

      {/* Dots double as controls: the rotation is decorative, but a reader who
          wants to go back to a quote should not have to wait a full cycle. */}
      <div className="mt-5 flex justify-center gap-2">
        {ALUMNI.map((entry, i) => (
          <button
            key={entry.name}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show quote from ${entry.name}`}
            aria-current={i === index}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === index
                ? 'w-6 bg-auth-pane-ink'
                : 'w-1.5 bg-auth-pane-ink/40 hover:bg-auth-pane-ink/70',
            )}
          />
        ))}
      </div>
    </figure>
  )
}
