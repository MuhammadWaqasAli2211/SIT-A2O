import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Suspense, type ReactNode } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'

import { AppLoader } from '@/components/shared/app-loader'

/**
 * Shown while a lazily-loaded route chunk is still downloading.
 *
 * Sits inside the keyed element below, so it belongs to the *incoming* route:
 * the outgoing view stays painted until its replacement is ready, and the
 * loader takes over the outlet rather than the whole window. That is what
 * removes the blank frame between two routes — there is never a moment where
 * neither view is rendered.
 */
function RouteFallback() {
  return <AppLoader size="lg" />
}

/**
 * Cross-fades the routed view on navigation.
 *
 * Keyed on pathname so React treats each route as a distinct element and
 * AnimatePresence can run an exit animation before the next one mounts.
 * `useOutlet()` is captured per render, which keeps the outgoing view rendered
 * while it fades rather than unmounting it instantly.
 *
 * Suspense sits inside the keyed element so a lazy chunk's loading state
 * belongs to the incoming route rather than replacing the whole layout.
 */
export function PageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const reduce = useReducedMotion()

  if (reduce) return <Suspense fallback={<RouteFallback />}>{outlet}</Suspense>

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: [0.21, 0.47, 0.32, 0.98] }}
      >
        <Suspense fallback={<RouteFallback />}>{outlet}</Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

/** Same treatment for content that is not a router outlet. */
export function FadeIn({
  children,
  keyValue,
}: {
  children: ReactNode
  keyValue: string | number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={keyValue}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
