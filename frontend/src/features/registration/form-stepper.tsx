/**
 * Progress indicator for the four registration sections.
 *
 * Deliberately *not* `JourneyStepper`. That component is typed to recruitment
 * concepts — `ApplicationStage`, stage-to-step mapping, per-stage timestamps,
 * a halted flag — none of which mean anything to a form, and its demo mode
 * advances on a timer, which is precisely wrong for something that must only
 * move when the user says so. Sharing the code would mean a third mode and a
 * generic step type, making a component that does one job well do two badly.
 *
 * What *is* shared is the design language: node sizing, checkmark on
 * completion, a rotating ring on the active node, connectors filled by
 * transform. If a third consumer ever appears, that is the moment to extract a
 * primitive.
 */

import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface FormStep {
  key: string
  label: string
  /** Shown under the label on wider screens. */
  hint: string
}

export function FormStepper({
  steps,
  current,
  furthestReached,
  onStepSelect,
  className,
}: {
  steps: readonly FormStep[]
  /** Zero-based index of the section on screen. */
  current: number
  /** Highest section reached, so completed steps stay clickable. */
  furthestReached: number
  onStepSelect?: (index: number) => void
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <ol className={cn('flex items-start', className)}>
      {steps.map((step, index) => {
        const complete = index < current
        const active = index === current
        // Only backwards. Jumping ahead would skip the validation that gates
        // each Next, letting somebody reach section 4 with section 2 empty.
        const selectable = index < current && index <= furthestReached

        return (
          <li key={step.key} className="relative flex flex-1 flex-col items-center gap-2 text-center">
            {index > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-5 right-1/2 h-0.5 w-full overflow-hidden rounded-full bg-border sm:top-6"
              >
                <span
                  className={cn(
                    'block size-full origin-left rounded-full bg-success transition-transform duration-500 ease-out',
                    index <= current ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </span>
            )}

            <button
              type="button"
              disabled={!selectable}
              onClick={selectable ? () => onStepSelect?.(index) : undefined}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${index + 1}: ${step.label}${
                complete ? ' (completed)' : active ? ' (current)' : ''
              }`}
              className={cn(
                'relative z-10 grid size-10 place-items-center rounded-full sm:size-12',
                selectable && 'cursor-pointer',
                !selectable && 'cursor-default',
              )}
            >
              {active && !reduceMotion && (
                <span
                  aria-hidden="true"
                  className="animate-ring absolute -inset-[3px] rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,var(--color-primary)_90deg,var(--color-brand-300)_180deg,transparent_300deg)]"
                />
              )}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute -inset-2 rounded-full bg-primary/25 blur-md"
                />
              )}

              <motion.span
                animate={{ scale: active && !reduceMotion ? 1.06 : 1 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'relative grid size-10 place-items-center rounded-full border-2 text-sm font-semibold transition-colors duration-400 sm:size-12',
                  complete && 'border-success bg-success text-success-foreground',
                  active && 'border-transparent bg-primary text-primary-foreground shadow-lg shadow-primary/25',
                  !complete && !active && 'border-dashed border-border bg-card text-muted-foreground/40',
                )}
              >
                {complete ? <Check className="size-5" strokeWidth={3} /> : index + 1}
              </motion.span>
            </button>

            <div className="flex flex-col gap-0.5 px-1">
              <span
                className={cn(
                  'text-xs leading-tight font-medium transition-colors sm:text-sm',
                  complete || active ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                {step.label}
              </span>
              <span
                className={cn(
                  'hidden text-[0.7rem] leading-snug transition-colors sm:block',
                  complete || active ? 'text-muted-foreground' : 'text-muted-foreground/40',
                )}
              >
                {step.hint}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
