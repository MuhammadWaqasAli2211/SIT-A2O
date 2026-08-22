/**
 * Types text out character by character once it scrolls into view.
 *
 * Two details that are easy to get wrong:
 *
 * - **No layout shift.** The full string is rendered underneath at zero
 *   opacity to reserve its final height. Without it, a three-line quote starts
 *   one line tall and shoves the page down as it types.
 * - **Fires once.** The observer disconnects on first intersection, so
 *   scrolling back up does not restart a quote mid-read.
 */

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'

export interface TypewriterProps {
  text: string
  /** Milliseconds per character. ~28ms reads as brisk but natural. */
  speed?: number
  /** Delay after entering view before typing starts. */
  startDelay?: number
  /** Keep the caret blinking after the last character. */
  caretAfterDone?: boolean
  className?: string
}

export function Typewriter({
  text,
  speed = 28,
  startDelay = 250,
  caretAfterDone = false,
  className,
}: TypewriterProps) {
  const reduceMotion = useReducedMotion()
  const hostRef = useRef<HTMLSpanElement>(null)
  const [typed, setTyped] = useState(0)

  // Environments without IntersectionObserver (older test runners, very old
  // browsers) should show the text rather than an empty bubble, so they start
  // as already-triggered instead of waiting for a scroll event that cannot come.
  const [started, setStarted] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  // Reduced motion gets the finished string, derived rather than assigned, so
  // the effects below stay pure scheduling and nothing renders twice.
  const count = reduceMotion ? text.length : typed

  // Start only when visible.
  useEffect(() => {
    if (reduceMotion || started) return
    const host = hostRef.current
    if (!host) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [reduceMotion, started])

  // Type.
  useEffect(() => {
    if (!started || reduceMotion) return
    if (count >= text.length) return

    // The first character waits out startDelay so the bubble has settled
    // into place before anything appears inside it.
    const delay = count === 0 ? startDelay : speed
    const timer = setTimeout(() => setTyped((n) => n + 1), delay)
    return () => clearTimeout(timer)
  }, [started, reduceMotion, count, text.length, speed, startDelay])

  const done = count >= text.length
  const showCaret = !reduceMotion && started && (!done || caretAfterDone)

  return (
    <span ref={hostRef} className={cn('relative block', className)}>
      {/* Height reservation. aria-hidden so the quote is not announced twice. */}
      <span aria-hidden="true" className="invisible block">
        {text}
      </span>

      <span className="absolute inset-0 block">
        {/* Screen readers get the whole quote immediately; a partial string
            re-announced on every keystroke would be unusable. */}
        <span className="sr-only">{text}</span>
        <span aria-hidden="true">
          {reduceMotion ? text : text.slice(0, count)}
          {showCaret && (
            <span className="animate-caret ml-px inline-block w-px translate-y-[0.1em] border-l-2 border-primary align-baseline text-transparent select-none">
              &nbsp;
            </span>
          )}
        </span>
      </span>
    </span>
  )
}
