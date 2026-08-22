/**
 * Section transition styled as a page turning.
 *
 * Built from CSS 3D transforms driven by Motion — no new dependency. The
 * outgoing section pivots away on its Y axis about the leading edge while a
 * gradient darkens across it, which is the light-catch that makes it read as
 * paper rather than a rotating rectangle. The incoming section settles in from
 * a shallower angle behind it.
 *
 * Only `transform` and `opacity` animate, so the whole thing stays on the
 * compositor. Rotation is applied to a single panel: a literal two-page book
 * spread with a visible reverse face costs far more for a form, and would put
 * the fields themselves on a surface that is briefly mirrored.
 *
 * `AnimatePresence mode="wait"` sequences the two rather than overlapping
 * them. Overlapping needs absolute positioning and a measured container
 * height, which fights a form whose sections are different lengths.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/** Positive turns forward (Next), negative turns back (Previous). */
export type FoldDirection = 1 | -1

const OUT_ANGLE = 105
const IN_ANGLE = 32

export function PageFold({
  sectionKey,
  direction,
  children,
}: {
  /** Changing this triggers the fold. */
  sectionKey: string
  direction: FoldDirection
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()

  return (
    // Perspective lives on the parent so the child's rotation has depth;
    // applied to the rotating element itself it would flatten.
    <div
      className="relative [perspective:1600px] [transform-style:preserve-3d]"
      style={{ perspective: '1600px' }}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={sectionKey}
          custom={direction}
          initial="enter"
          animate="settled"
          exit="leave"
          variants={
            reduceMotion
              ? {
                  enter: { opacity: 0 },
                  settled: { opacity: 1 },
                  leave: { opacity: 0 },
                }
              : {
                  enter: (dir: FoldDirection) => ({
                    opacity: 0,
                    rotateY: dir > 0 ? IN_ANGLE : -IN_ANGLE,
                    transformOrigin: dir > 0 ? 'left center' : 'right center',
                  }),
                  settled: {
                    opacity: 1,
                    rotateY: 0,
                    transition: { duration: 0.45, ease: [0.22, 0.61, 0.36, 1] },
                  },
                  leave: (dir: FoldDirection) => ({
                    opacity: 0,
                    rotateY: dir > 0 ? -OUT_ANGLE : OUT_ANGLE,
                    transformOrigin: dir > 0 ? 'left center' : 'right center',
                    transition: { duration: 0.34, ease: [0.55, 0, 0.68, 0.3] },
                  }),
                }
          }
          className="relative origin-left [backface-visibility:hidden] [transform-style:preserve-3d]"
        >
          {children}

          {/* The page catching light as it lifts. Pointer-events off so it
              never intercepts a click on a field underneath. */}
          {!reduceMotion && (
            <motion.span
              aria-hidden="true"
              custom={direction}
              variants={{
                enter: { opacity: 0.35 },
                settled: { opacity: 0, transition: { duration: 0.45 } },
                leave: { opacity: 0.55, transition: { duration: 0.34 } },
              }}
              className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-black/40 via-black/10 to-transparent"
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
