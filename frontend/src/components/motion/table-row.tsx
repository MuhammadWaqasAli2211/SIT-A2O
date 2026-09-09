/**
 * Staggered entrance for table rows.
 *
 * `Stagger`/`StaggerItem` cannot be used here: they render `motion.div`, and
 * a div between `<tbody>` and `<tr>` is invalid HTML that browsers silently
 * reparent, which breaks the table. So the same variants are applied to
 * `motion.tbody` and `motion.tr` directly, and the row wears `tableRowClass`
 * — the exact classes `TableRow` uses, imported rather than copied.
 *
 * Reduced motion is honoured by skipping the animation entirely rather than
 * shortening it: with many rows, even a fast cascade is still movement, and
 * "reduce motion" means the rows should simply be there.
 */

import { motion, useReducedMotion } from 'motion/react'
import type { MouseEventHandler, ReactNode } from 'react'

import { staggerContainerVariants, staggerItemVariants } from '@/components/motion/reveal'
import { TableBody, TableRow, tableRowClass } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export function MotionTableBody({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <TableBody className={className}>{children}</TableBody>
  }

  return (
    <motion.tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      variants={staggerContainerVariants}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.tbody>
  )
}

/**
 * Props are listed rather than spread from `ComponentProps<'tr'>`: React's
 * `onDrag` and motion's `onDrag` have incompatible signatures, so spreading
 * the full DOM prop set onto a `motion.tr` does not type-check. The handful
 * a table row actually needs is a short list anyway.
 */
export function MotionTableRow({
  className,
  children,
  onClick,
}: {
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLTableRowElement>
}) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <TableRow className={className} onClick={onClick}>
        {children}
      </TableRow>
    )
  }

  return (
    <motion.tr
      data-slot="table-row"
      className={cn(tableRowClass, className)}
      variants={staggerItemVariants}
      onClick={onClick}
    >
      {children}
    </motion.tr>
  )
}
