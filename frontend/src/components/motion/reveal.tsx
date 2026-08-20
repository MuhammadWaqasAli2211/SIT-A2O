import { motion, useReducedMotion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'

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
}: {
  children: ReactNode
  className?: string
  once?: boolean
}) {
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
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div className={cn(className)} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
