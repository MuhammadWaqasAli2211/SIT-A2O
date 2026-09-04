/**
 * The "Application Status" card that overlaps the bottom of the hero.
 *
 * The five steps come from `JOURNEY_STEPS` and are rendered by the same
 * `JourneyStepper` a candidate sees on their own tracking page — not a
 * re-typed copy. That matters more than it looks: the labels and blurbs here
 * are the ones tied to `ApplicationStage`, so when the stage enum changes,
 * this marketing card cannot quietly go on advertising a process the product
 * no longer runs.
 *
 * It runs in `demo` mode with `startOnView`, because the card sits below the
 * fold — without that gate the sequence plays out while the visitor is still
 * reading the headline and they arrive at a finished, static row.
 */

import { Route } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { JourneyStepper } from '@/components/shared/journey-stepper'
import { cn } from '@/lib/utils'

export function ApplicationFlowCard({
  bootcampLabel,
  className,
}: {
  /** e.g. "Bootcamp 07". Omitted while the open intake is still resolving. */
  bootcampLabel?: string
  className?: string
}) {
  return (
    <Reveal
      className={cn(
        'rounded-3xl border border-border/70 bg-card p-6 shadow-2xl shadow-primary/5 sm:p-8',
        className,
      )}
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        {/* --------------------------------------------------- heading -- */}
        <div className="flex shrink-0 gap-3 lg:max-w-[17rem]">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Route className="size-5" />
          </span>
          <div className="flex flex-col gap-2">
            <h2 className="text-base leading-tight font-semibold tracking-tight">
              Application Status
              {bootcampLabel && (
                <span className="text-muted-foreground"> — {bootcampLabel}</span>
              )}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Five steps from application to first class. Each one opens on a deadline,
              and you are emailed the moment it does.
            </p>
          </div>
        </div>

        {/* --------------------------------------------------- stepper -- */}
        <JourneyStepper
          mode="demo"
          numbered
          startOnView
          className="min-w-0 flex-1"
        />
      </div>
    </Reveal>
  )
}
