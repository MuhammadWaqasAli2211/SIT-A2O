import { motion, useReducedMotion, type Variants } from 'motion/react'
import { Children, cloneElement, isValidElement, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

const OFFSET: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 28 },
  down: { x: 0, y: -28 },
  left: { x: 32, y: 0 },
  right: { x: -32, y: 0 },
  none: { x: 0, y: 0 },
}

interface RevealProps {
  children: ReactNode
  className?: string
  direction?: Direction
  delay?: number
  duration?: number
  /** Play once when scrolled into view (default) or every time it re-enters. */
  once?: boolean
  as?: 'div' | 'section' | 'li' | 'span'
}

/**
 * Scroll-triggered entrance animation.
 *
 * Respects prefers-reduced-motion by rendering the content already settled —
 * the element still appears, it just does not travel.
 */
export function Reveal({
  children,
  className,
  direction = 'up',
  delay = 0,
  duration = 0.6,
  once = true,
  as = 'div',
}: RevealProps) {
  const reduce = useReducedMotion()
  const { x, y } = reduce ? OFFSET.none : OFFSET[direction]
  const MotionTag = motion[as]

  return (
    <MotionTag
      className={cn(className)}
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin: '-80px' }}
      transition={{
        duration: reduce ? 0 : duration,
        delay: reduce ? 0 : delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      {children}
    </MotionTag>
  )
}

/* -------------------------------------------------------------------------- */

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] },
  },
}

/**
 * Staggered list entrance. Wrap items in <StaggerItem> to opt each one in.
 * Children animate in sequence rather than all at once, which reads as
 * deliberate rather than as a single block flashing into place.
 */
export function Stagger({
  children,
  className,
  once = true,
  trigger = 'view',
}: {
  children: ReactNode
  className?: string
  once?: boolean
  /**
   * What starts the sequence.
   *
   * `view` (the default) waits for the group to scroll into view — right for
   * a marketing section below the fold. `mount` runs it as soon as the group
   * renders, which is what content already on screen needs: the viewport
   * trigger has nothing to cross for a block that is visible the instant it
   * mounts, so those groups were arriving already settled and never
   * animating at all.
   */
  trigger?: 'view' | 'mount'
}) {
  // `mount` drives each child by an explicit delay rather than by variant
  // propagation. Verified 2026-09-05 against the running app: the
  // container/child variant pair silently never applied — cards were fully
  // opaque and in position on the first painted frame after mount, even with
  // the timings cranked to a 3s duration, so nothing was animating at all.
  // Passing the index down and letting each item own a plain
  // `initial`/`animate` pair removes the dependency on that mechanism.
  if (trigger === 'mount') {
    return (
      <div className={cn(className)}>
        {Children.map(children, (child, index) =>
          isValidElement<{ index?: number }>(child) ? cloneElement(child, { index }) : child,
        )}
      </div>
    )
  }

  return (
    <motion.div
      className={cn(className)}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: '-60px' }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  index,
}: {
  children: ReactNode
  /**
   * Position in the sequence, injected by a `trigger="mount"` Stagger. When
   * absent the item animates through the parent's variants as before, so the
   * scroll-triggered marketing usage is untouched.
   */
  index?: number
  className?: string
}) {
  if (index !== undefined) {
    return (
      <div
        className={cn('stagger-rise', className)}
        style={{ animationDelay: `${(0.05 + index * 0.09).toFixed(2)}s` }}
      >
        {children}
      </div>
    )
  }

  return (
    <motion.div className={cn(className)} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
