/**
 * The candidate journey stepper — one component, two modes.
 *
 * `demo`  explains the process to somebody who has not applied. It plays the
 *         five steps through once on mount and then stops.
 * `real`  reflects an actual application. Nothing sequences; the node matching
 *         the candidate's stage carries a persistent rotating ring, and the
 *         timeline either side of it is derived from that step's index.
 *
 * Built as one component rather than two because the geometry — node sizing,
 * the connector-between-centres trick, the responsive axis flip — is the hard
 * part and is identical either way. Only the *state* of each node differs, and
 * that is a single `stepState()` call.
 *
 * Callers pass a stored `ApplicationStage`, not a step index. Mapping the two
 * interview sub-stages onto one node happens here, so no page has to know that
 * the database is finer-grained than the stepper.
 */

import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  JOURNEY_STEPS,
  STEP_INDEX,
  type ApplicationStage,
  type JourneyStep,
} from '@/lib/stages'
import { cn } from '@/lib/utils'

/** Gap between one node lighting up and the next, in demo mode. */
const DEMO_STEP_MS = 620

type StepState = 'complete' | 'current' | 'upcoming'

export interface JourneyStepperProps {
  mode: 'demo' | 'real'
  /** Required in `real` mode; ignored in `demo`. */
  currentStage?: ApplicationStage
  /**
   * Stop the journey at `currentStage` without the in-progress ring — used
   * when an application was rejected or withdrawn part-way.
   */
  halted?: boolean
  /**
   * ISO timestamps keyed by stored stage. A node showing several stages takes
   * the earliest — you reached "Interview" when you were first scheduled, not
   * when you finished it.
   */
  timestamps?: Partial<Record<ApplicationStage, string>>
  /** Override the steps, e.g. to render a shortened journey. */
  steps?: readonly JourneyStep[]
  /** Show each stage's one-line explanation. Defaults on in demo mode. */
  showBlurbs?: boolean
  className?: string
}

export function JourneyStepper({
  mode,
  currentStage,
  halted = false,
  timestamps,
  steps = JOURNEY_STEPS,
  showBlurbs = mode === 'demo',
  className,
}: JourneyStepperProps) {
  const reduceMotion = useReducedMotion()

  /**
   * How far the demo sequence has advanced. `-1` is "nothing lit yet";
   * `steps.length` means the run finished and every node is settled.
   *
   * `real` mode never touches this — its progress comes from `currentStage`.
   */
  const [ticked, setTicked] = useState(-1)

  useEffect(() => {
    // Reduced motion is handled below by deriving the finished state, so no
    // timer is started and nothing animates.
    if (mode !== 'demo' || reduceMotion) return

    let index = -1
    const timer = setInterval(() => {
      index += 1
      setTicked(index)
      if (index >= steps.length) clearInterval(timer)
    }, DEMO_STEP_MS)

    return () => clearInterval(timer)
    // Every dependency is stable for the life of the mount, so this runs once
    // per mount — a re-render cannot restart the sequence.
  }, [mode, reduceMotion, steps.length])

  // Reduced motion jumps straight to the settled state: the same information,
  // none of the choreography. Derived rather than assigned in the effect so
  // there is no extra render pass, and no state to keep in step.
  const played = reduceMotion ? steps.length : ticked
  const demoFinished = played >= steps.length
  const currentIndex = currentStage ? STEP_INDEX[currentStage] : -1

  function stepState(index: number): StepState {
    if (mode === 'demo') {
      if (demoFinished || index < played) return 'complete'
      return index === played ? 'current' : 'upcoming'
    }
    if (index < currentIndex) return 'complete'
    return index === currentIndex ? 'current' : 'upcoming'
  }

  /** The connector *entering* `index`, i.e. drawn from index-1 to index. */
  function isConnectorFilled(index: number): boolean {
    return mode === 'demo' ? demoFinished || index <= played : index <= currentIndex
  }

  // The ring reads as "work is happening here". Neither a finished demo nor a
  // halted application is in progress, so neither one spins.
  const ringActive = mode === 'demo' ? !demoFinished : !halted

  return (
    <ol
      className={cn(
        'flex flex-col gap-0 lg:flex-row lg:items-start',
        className,
      )}
    >
      {steps.map((step, index) => {
        const state = stepState(index)
        const reached = state !== 'upcoming'
        const stamp = earliestStamp(step, timestamps)

        return (
          <motion.li
            key={step.key}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: reduceMotion ? 0 : index * 0.07 }}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'relative flex min-w-0 flex-1 gap-4',
              // Vertical below lg: node left, text right. Horizontal at lg:
              // node on top, text centred beneath.
              'lg:flex-col lg:items-center lg:gap-3 lg:text-center',
              // Room for the connector to run down to the next node.
              index < steps.length - 1 && 'pb-8 lg:pb-0',
            )}
          >
            {index > 0 && (
              <Connector
                filled={isConnectorFilled(index)}
                halted={halted && index > currentIndex}
              />
            )}

            <Node
              step={step}
              state={state}
              ringActive={ringActive}
              halted={halted}
              reduceMotion={Boolean(reduceMotion)}
            />

            <div className="flex min-w-0 flex-col gap-1 pt-1.5 lg:items-center lg:pt-0">
              <span
                className={cn(
                  'text-sm leading-tight font-medium transition-colors duration-300 lg:text-[0.78rem]',
                  reached ? 'text-foreground' : 'text-muted-foreground/70',
                )}
              >
                {step.label}
              </span>

              {showBlurbs && (
                <span
                  className={cn(
                    'text-xs leading-snug transition-colors duration-300 lg:max-w-[15ch]',
                    reached ? 'text-muted-foreground' : 'text-muted-foreground/45',
                  )}
                >
                  {step.blurb}
                </span>
              )}

              {stamp && reached && (
                <span className="text-[0.7rem] text-muted-foreground/80">
                  {formatStamp(stamp)}
                </span>
              )}

              <span className="sr-only">
                {state === 'complete'
                  ? 'Completed'
                  : state === 'current'
                    ? halted
                      ? 'Stopped at this stage'
                      : 'In progress'
                    : 'Not started'}
              </span>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ node -- */

function Node({
  step,
  state,
  ringActive,
  halted,
  reduceMotion,
}: {
  step: JourneyStep
  state: StepState
  ringActive: boolean
  halted: boolean
  reduceMotion: boolean
}) {
  const Icon = step.icon
  const isCurrent = state === 'current'
  const showRing = isCurrent && ringActive
  const stopped = isCurrent && halted

  return (
    <span className="relative z-10 grid size-11 shrink-0 place-items-center lg:size-12">
      {/* Rotating gradient ring. Sits *behind* an opaque node, so only the
          3px it protrudes is visible — a moving border without a mask. */}
      {showRing && (
        <span
          aria-hidden="true"
          className="animate-ring absolute -inset-[3px] rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,var(--color-primary)_90deg,var(--color-brand-300)_180deg,transparent_300deg)]"
        />
      )}

      {/* Soft halo. Pulses only while something is genuinely in progress. */}
      {isCurrent && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute -inset-2 rounded-full blur-md',
            stopped ? 'bg-destructive/25' : 'bg-primary/30',
            showRing && !reduceMotion && 'animate-pulse',
          )}
        />
      )}

      <motion.span
        // Scale only — never width/height, which would reflow seven nodes and
        // their connectors on every frame.
        animate={{ scale: isCurrent && !reduceMotion ? 1.06 : 1 }}
        transition={{ duration: 0.35 }}
        className={cn(
          'relative grid size-11 place-items-center rounded-full border-2 transition-colors duration-500 lg:size-12',
          state === 'complete' && 'border-success bg-success text-success-foreground',
          isCurrent &&
            !stopped &&
            'border-transparent bg-primary text-primary-foreground shadow-lg shadow-primary/25',
          stopped && 'border-transparent bg-destructive text-destructive-foreground',
          state === 'upcoming' &&
            'border-dashed border-border bg-card text-muted-foreground/40',
        )}
      >
        {state === 'complete' ? (
          <Check className="size-5" strokeWidth={3} />
        ) : (
          <Icon className="size-5" />
        )}
      </motion.span>
    </span>
  )
}

/* ------------------------------------------------------------- connector -- */

/**
 * The line entering a node, drawn from the previous node's centre.
 *
 * Anchored at 50% of this cell and stretched a full cell backwards, which
 * lands exactly on the previous centre because the cells are equal width
 * (`flex-1`). No measurement, no resize observer.
 *
 * The fill is a transform, so filling costs no layout. The axis flips at `lg`,
 * which is why both scale axes are pinned at both breakpoints — leaving one
 * unset would collapse the bar in the other orientation.
 */
function Connector({ filled, halted }: { filled: boolean; halted: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute overflow-hidden rounded-full bg-border/70',
        // Vertical: runs up from this node's centre to the one above.
        'bottom-1/2 left-[1.375rem] h-full w-0.5 -translate-x-1/2',
        // Horizontal at lg: runs left from this node's centre.
        'lg:top-6 lg:bottom-auto lg:left-auto lg:right-1/2 lg:h-0.5 lg:w-full lg:translate-x-0 lg:-translate-y-1/2',
      )}
    >
      <span
        className={cn(
          'block size-full rounded-full transition-transform duration-500 ease-out',
          halted ? 'bg-border' : 'bg-success',
          'origin-top lg:origin-left',
          filled
            ? 'scale-y-100 lg:scale-x-100'
            : 'scale-y-0 lg:scale-y-100 lg:scale-x-0',
        )}
      />
    </span>
  )
}

/* ----------------------------------------------------------------- dates -- */

/**
 * When a node was reached: the earliest timestamp among the stages it covers.
 *
 * Only matters for the Interview node, which spans two stored stages. Being
 * scheduled is what puts a candidate on that step, so that is the date shown.
 */
function earliestStamp(
  step: JourneyStep,
  timestamps: Partial<Record<ApplicationStage, string>> | undefined,
): string | undefined {
  if (!timestamps) return undefined
  return step.stages
    .map((stage) => timestamps[stage])
    .filter((value): value is string => Boolean(value))
    .sort()[0]
}

function formatStamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
