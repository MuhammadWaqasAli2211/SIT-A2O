import {
  animate,
  useInView,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

interface CounterProps {
  to: number
  from?: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

/**
 * Counts up to `to` when scrolled into view.
 *
 * The DOM always holds the final value for screen readers and for anyone with
 * reduced motion enabled; only the visual tween is conditional.
 */
export function Counter({
  to,
  from = 0,
  duration = 1.6,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduce = useReducedMotion()
  const [value, setValue] = useState(reduce ? to : from)

  useEffect(() => {
    if (!inView || reduce) return

    let controls: AnimationPlaybackControls | undefined
    controls = animate(from, to, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setValue(latest),
    })
    return () => controls?.stop()
  }, [inView, reduce, from, to, duration])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}
