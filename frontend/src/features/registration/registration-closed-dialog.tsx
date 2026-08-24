/**
 * Shown instead of the registration form when the window is shut.
 *
 * "Shut" is not a separate judgement made here. It comes from
 * `/bootcamps/open`, which is filtered by `is_phase_open()` on the server —
 * the registration flag **and** the clock against `opens_at` / `deadline_at`.
 * The same function backs `assert_phase_open()`, so what this dialog says and
 * what a submission would be allowed to do cannot disagree.
 *
 * Deliberately not an error. A closed intake is the normal state for most of
 * the year, so the tone is "not yet" rather than "something went wrong" — red
 * enough to be unambiguous, without a destructive alert's framing.
 */

import { motion, useReducedMotion } from 'motion/react'
import { CircleX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

export function RegistrationClosedDialog({
  open,
  onOpenChange,
  onDismiss,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  /** Runs on the dismiss button — used to navigate away from the route guard. */
  onDismiss?: () => void
}) {
  const reduceMotion = useReducedMotion()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <motion.span
            // Scale and opacity only, so the icon settles onto the compositor
            // rather than reflowing the dialog it sits in.
            initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 320, delay: 0.05 }}
            className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"
          >
            <CircleX className="size-8" strokeWidth={2.25} />
          </motion.span>

          <div className="flex flex-col gap-1.5">
            <DialogTitle className="text-lg">Registration closed</DialogTitle>
            <DialogDescription>
              Applications for this bootcamp are no longer being accepted. You
              are welcome to apply in the next intake — follow our website for
              updates.
            </DialogDescription>
          </div>

          <Button
            onClick={() => {
              onDismiss?.()
              onOpenChange?.(false)
            }}
            className="mt-1 w-full"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
