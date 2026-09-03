/**
 * "Choose your track" — the fanned card stack and its detail panel.
 *
 * Replaces the old six-card programme grid on the home page; both carried the
 * same heading, and the design brief's H2 is that heading word for word.
 *
 * ## Where the content comes from
 *
 * `PROGRAMS` in site-data.ts, not the copy in the design handoff. The handoff
 * disagreed with live data on real facts — it had Cloud & DevOps at 5 months
 * and 150 seats against the live 4 months and 120 — and those same numbers are
 * what /programs and /programs/:slug advertise. One source of truth means this
 * section cannot quote a duration the programme page contradicts.
 *
 * ## Two layouts, not one scaled down
 *
 * At `lg` and up: the fan from the design — absolutely positioned cards,
 * 132px apart, alternating ±2.5deg, the active one straightened and lifted.
 * Below `lg`: a plain vertical list. The fan needs ~600px of width and a fixed
 * 720px column to work, and a phone has neither; rotated cards overlapping in
 * a 360px viewport is unreadable rather than merely small. Every card, and the
 * whole detail panel, is still present — only the geometry changes.
 *
 * The switch is done with CSS variables set inline and consumed by `lg:`
 * utilities, because the per-card offsets are computed per index and inline
 * styles cannot carry a breakpoint of their own.
 */

import { useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/motion/reveal'
import { Eyebrow } from '@/components/shared/section'
import { PROGRAMS, type Program } from '@/lib/site-data'
import { cn } from '@/lib/utils'

/** Card geometry from the design, in px. */
const CARD_OFFSET_Y = 132
const CARD_OFFSET_X = 18
const CARD_HEIGHT = 190

/**
 * Default selection.
 *
 * Index 1, per the handoff. It also happens to be the better default for a
 * fan: raising the second card shows the first card's full face above it and
 * the rest of the stack below, so the shape reads as a stack immediately.
 */
const DEFAULT_ACTIVE = 1

const trackNumber = (index: number) => String(index + 1).padStart(2, '0')

/** Stable ids so each tab can label the panel it controls. */
const PANEL_ID = 'track-detail-panel'
const tabId = (slug: string) => `track-tab-${slug}`

export function TrackSelector() {
  const [active, setActive] = useState(DEFAULT_ACTIVE)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const activeProgram = PROGRAMS[active] ?? PROGRAMS[0]

  if (!activeProgram) return null

  /**
   * Roving focus across the stack.
   *
   * The cards are a tablist, so arrow keys must move between them rather than
   * Tab — a keyboard user should reach the stack once, then pick within it,
   * not tab through five cards to get past the section.
   */
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const keys: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: PROGRAMS.length - 1,
    }
    const next = keys[event.key]
    if (next === undefined) return

    event.preventDefault()
    const wrapped = (next + PROGRAMS.length) % PROGRAMS.length
    setActive(wrapped)
    tabRefs.current[wrapped]?.focus()
  }

  return (
    <section id="programs" className="overflow-hidden bg-background py-24 sm:py-28">
      <div className="mx-auto max-w-[77.5rem] px-4 sm:px-6 lg:px-8">
        {/* Header block is centred; the text inside it is left-aligned, per
            the design reference. */}
        <Reveal className="mx-auto mb-16 max-w-[40rem] lg:mb-[4.5rem]">
          <Eyebrow>{PROGRAMS.length} tracks · All free</Eyebrow>

          {/*
            The design breaks the line after "fits". Done with a `sm:block`
            span rather than a `<br>` carrying display utilities: a <br> is
            only reliably a line break at its default display, and toggling
            one to `display:block` to "turn it on" is not something browsers
            agree about. A block-level span forces the same break honestly,
            and simply flows inline on a phone where the break would strand
            one word.
          */}
          <h2 className="mt-5 text-3xl leading-[1.12] font-extrabold tracking-[-0.01em] text-hero-ink sm:text-4xl lg:text-[2.75rem]">
            Choose the track that fits{' '}
            <span className="sm:block">
              where <span className="text-primary">you want to go.</span>
            </span>
          </h2>

          <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground sm:text-[1.0625rem]">
            Five specialisations, each built with hiring partners and taught by working
            practitioners. All of them free, always.
          </p>
        </Reveal>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* ------------------------------------------------------ stack -- */}
          <div
            role="tablist"
            aria-label="Bootcamp tracks"
            aria-orientation="vertical"
            className={cn(
              'flex flex-col gap-3',
              // The fan only exists at lg: it needs a fixed-height column to
              // absolutely position into.
              'lg:relative lg:block lg:h-[720px] lg:gap-0',
              // `isolate` opens a new stacking context here, so the cards'
              // z-index range (1–50, the active card) is only ever compared
              // against its four siblings — never against the rest of the
              // page. Without it, the active card's z-index:50 ties the
              // fixed header's z-50, and on a tie the later element in the
              // DOM (the card, inside <main>, after <PublicHeader/>) wins the
              // paint order — so scrolling the active card past the header
              // put it on top of the navbar instead of under it.
              'lg:isolate',
            )}
          >
            {PROGRAMS.map((program, index) => (
              <TrackCard
                key={program.slug}
                ref={(node) => {
                  tabRefs.current[index] = node
                }}
                program={program}
                index={index}
                isActive={index === active}
                onSelect={() => setActive(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
              />
            ))}
          </div>

          {/* ------------------------------------------------------ panel -- */}
          <DetailPanel program={activeProgram} index={active} />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ card -- */

function TrackCard({
  ref,
  program,
  index,
  isActive,
  onSelect,
  onKeyDown,
}: {
  ref: (node: HTMLButtonElement | null) => void
  program: Program
  index: number
  isActive: boolean
  onSelect: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
}) {
  // Alternating tilt, straightened when active. Even indices lean one way,
  // odd the other, so the stack fans rather than skews in one direction.
  const rotate = isActive ? -1 : index % 2 === 0 ? -2.5 : 2.5

  return (
    <button
      ref={ref}
      type="button"
      id={tabId(program.slug)}
      role="tab"
      aria-selected={isActive}
      aria-controls={PANEL_ID}
      // Roving tabindex: the stack is one tab stop, arrows move within it.
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      style={
        {
          '--card-top': `${index * CARD_OFFSET_Y}px`,
          '--card-left': `${index * CARD_OFFSET_X}px`,
          '--card-rotate': `${rotate}deg`,
          '--card-scale': isActive ? '1.03' : '1',
          '--card-height': `${CARD_HEIGHT}px`,
          zIndex: isActive ? 50 : index + 1,
        } as React.CSSProperties
      }
      className={cn(
        'relative w-full cursor-pointer rounded-[1.375rem] border border-border bg-card text-left',
        'transition-all duration-300 ease-out',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
        // Fanned geometry, lg and up only.
        'lg:absolute lg:top-[var(--card-top)] lg:left-[var(--card-left)] lg:h-[var(--card-height)] lg:w-[82%]',
        'lg:[transform:rotate(var(--card-rotate))_scale(var(--card-scale))]',
        isActive
          ? 'shadow-[0_24px_48px_-16px_rgb(0_0_0/0.22)]'
          : 'shadow-[0_8px_20px_-8px_rgb(0_0_0/0.10)] hover:shadow-[0_16px_32px_-12px_rgb(0_0_0/0.16)]',
      )}
    >
      {/*
        Inactive cards recede behind a wash. Card-coloured rather than white:
        a white veil lightens in light mode and would *brighten* an inactive
        card in dark mode, making it advance instead of recede.
      */}
      {!isActive && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[1.375rem] bg-card/20"
        />
      )}

      {/* The oversized track number, deliberately breaking the card's top-left
          corner. The card keeps overflow visible so it can. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute -top-2 -left-1 text-[3.5rem] leading-none font-black tracking-[-0.02em] transition-opacity duration-300',
          'lg:-top-3.5 lg:text-[5rem]',
          isActive ? 'opacity-100' : 'opacity-85',
        )}
        style={{ color: program.accentVar }}
      >
        {trackNumber(index)}
      </span>

      <span className="relative block py-6 pr-7 pl-[5.5rem] lg:py-[1.625rem] lg:pr-[1.875rem] lg:pl-[9.375rem]">
        <span
          className="mb-3 inline-flex items-center rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-[0.6875rem] font-bold tracking-[0.04em] uppercase"
          style={{ color: program.accentVar }}
        >
          {program.level}
        </span>

        <span
          className={cn(
            'block text-lg font-bold text-hero-ink transition-opacity duration-300 lg:text-[1.3125rem]',
            isActive ? 'opacity-100' : 'opacity-85',
          )}
        >
          {program.title}
        </span>

        <span
          className={cn(
            'mt-1.5 block max-w-[20rem] text-sm leading-[1.5] text-muted-foreground transition-opacity duration-300',
            isActive ? 'opacity-100' : 'opacity-85',
          )}
        >
          {program.tagline}
        </span>
      </span>
    </button>
  )
}

/* ----------------------------------------------------------------- panel -- */

function DetailPanel({ program, index }: { program: Program; index: number }) {
  const reduce = useReducedMotion()

  return (
    <div
      id={PANEL_ID}
      role="tabpanel"
      // Labelled by the tab that controls it, and deliberately NOT
      // aria-live: selecting a tab is already announced, and a live region
      // here would read the whole panel a second time on every click.
      aria-labelledby={tabId(program.slug)}
      style={{
        // The panel takes a wash of the active track's colour and fades to the
        // card surface. Mixing into `--color-card` rather than a literal white
        // is what makes this work in dark mode: the same 10% tint lands on a
        // dark ground instead of turning the panel into a white slab.
        background: `linear-gradient(135deg, color-mix(in srgb, ${program.accentVar} 10%, var(--color-card)) 0%, var(--color-card) 65%)`,
      }}
      className="relative min-h-[28.75rem] overflow-hidden rounded-[1.75rem] border border-border p-8 sm:p-12 lg:px-12 lg:py-14"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={program.slug}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduce ? 0 : 0.28, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="flex flex-col"
        >
          <span
            aria-hidden="true"
            className="text-[5rem] leading-none font-black tracking-[-0.02em] sm:text-[6.875rem]"
            style={{
              color: `color-mix(in srgb, ${program.accentVar} 16%, var(--color-card))`,
            }}
          >
            {trackNumber(index)}
          </span>

          <span
            className="mt-1 mb-6 inline-flex w-fit items-center rounded-full border border-border bg-card px-4 py-[0.4375rem] text-xs font-bold tracking-[0.04em] uppercase"
            style={{ color: program.accentVar }}
          >
            {program.level}
          </span>

          <h3 className="text-2xl font-extrabold tracking-[-0.01em] text-hero-ink sm:text-[2.125rem]">
            {program.title}
          </h3>

          <p className="mt-3.5 max-w-[27.5rem] text-base leading-[1.65] text-muted-foreground">
            {program.description}
          </p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {program.skills.map((skill) => (
              <li
                key={skill}
                className="rounded-full bg-card px-3.5 py-1.5 text-[0.8125rem] font-medium text-muted-foreground"
              >
                {skill}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
            <span>
              <strong className="font-semibold text-hero-ink">{program.duration}</strong> duration
            </span>
            <span>
              <strong className="font-semibold text-hero-ink">{program.seats}</strong> seats
            </span>
          </div>

          {/* The handoff left this as href="#"; the real per-track page
              already exists at /programs/:slug. */}
          <Link
            to={`/programs/${program.slug}`}
            className={cn(
              'group mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-6 py-3.5',
              'text-[0.9375rem] font-semibold text-primary-foreground transition-colors hover:bg-primary/90',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
            )}
          >
            View curriculum
            <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
