/**
 * A GitHub-contribution-style calendar heatmap, adapted to a bootcamp
 * intake's actual shape rather than copied wholesale.
 *
 * Drawn the way GitHub draws a contribution grid, but with the *window*
 * measured rather than fixed: the container's real width decides how many
 * week-columns fit at the target cell size, and exactly that many weeks are
 * rendered. A fixed count left the grid at its natural size in the corner
 * of a much wider card; measuring means it stretches across the card at
 * every breakpoint and reaches further back in time on a wider screen,
 * while never needing to scroll on a narrow one. Fed by
 * `application_activity` (see `_ACTIVITY_DAYS` in `dashboard_service.py`),
 * sliced from the same single query that still yields the line chart's
 * 30-day series.
 *
 * Colour is the `--brand-300 → --brand-900` ramp, in solid steps rather than
 * opacity tints of one colour. Four washes of the same pale green were
 * indistinguishable from each other at a glance, which defeats the point of
 * an intensity scale; the ramp gives four genuinely separate steps and
 * reverses correctly in dark mode (where brand-300 is the dim end and
 * brand-900 the bright one), so "more" always reads as "stronger".
 */

import { motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { CalendarRange, Flame } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Counter } from '@/components/motion/counter'
import type { DailyCount } from '@/lib/types'
import { cn } from '@/lib/utils'

const DAY_MS = 86_400_000
const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* --- grid geometry, in px, matching the classes the cells are drawn with -- */
const CELL = 12 // size-3
const GAP = 3 // gap-[3px]
/** Weekday label column plus the gap-2 between it and the grid. */
const GUTTER = 34

/**
 * How many week-columns are shown is measured, not fixed.
 *
 * A fixed count left the grid sitting at its natural size in the corner of
 * a much wider card. Instead the container's real width is measured and the
 * window is whatever number of weeks fills it at the target cell size, so
 * the grid stretches across the card at every breakpoint and reaches
 * further back in time on a wider screen.
 */
const MIN_WEEKS = 6
/**
 * The ceiling, matching what the backend fetches. A year (53 weeks) was not
 * quite enough: a 1920px card has room for ~65 columns, and capping at 53
 * left a tenth of the width empty — the exact problem this measuring is
 * meant to solve.
 */
const MAX_WEEKS = 70

function weeksThatFit(width: number) {
  if (width <= 0) return MIN_WEEKS
  // n columns occupy n * CELL + (n - 1) * GAP.
  const usable = width - GUTTER
  const n = Math.floor((usable + GAP) / (CELL + GAP))
  return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, n))
}

interface HeatCell {
  date: Date
  key: string
  count: number
  /** 0 = no applications that day; 1-4 = increasing share of the busiest day. */
  bucket: 0 | 1 | 2 | 3 | 4
}

function dateKey(d: Date) {
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/**
 * The backend only returns rows for days that had at least one application
 * (a plain `GROUP BY`, no zero-fill) — so a quiet day is simply absent from
 * `points`, not a zero row. Rebuilding the full run here, defaulting
 * absent days to 0, is what makes a heatmap possible at all: a grid needs
 * every day to have a cell, not just the days something happened.
 */
function buildCells(points: DailyCount[], weeks: number): HeatCell[] {
  const byDay = new Map(points.map((p) => [p.day.slice(0, 10), p.count]))
  const max = Math.max(...points.map((p) => p.count), 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Start on the Sunday `weeks - 1` weeks back, so the run is whole weeks
  // and lands exactly `weeks` columns wide — the last one being the current,
  // still-incomplete week.
  const start = new Date(today.getTime() - (today.getDay() + (weeks - 1) * 7) * DAY_MS)
  const days = Math.round((today.getTime() - start.getTime()) / DAY_MS) + 1

  const cells: HeatCell[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * DAY_MS)
    const count = byDay.get(dateKey(date)) ?? 0
    const bucket: HeatCell['bucket'] =
      count === 0
        ? 0
        : max <= 1
          ? 4
          : count <= max * 0.25
            ? 1
            : count <= max * 0.5
              ? 2
              : count <= max * 0.75
                ? 3
                : 4
    cells.push({ date, key: dateKey(date), count, bucket })
  }
  return cells
}

/** Chunk the run into weekday-aligned columns, GitHub's own layout. */
function buildColumns(cells: HeatCell[]): (HeatCell | null)[][] {
  const columns: (HeatCell | null)[][] = []
  let column: (HeatCell | null)[] = []

  const first = cells[0]
  if (first) {
    for (let d = 0; d < first.date.getDay(); d++) column.push(null)
  }

  for (const cell of cells) {
    column.push(cell)
    if (cell.date.getDay() === 6) {
      columns.push(column)
      column = []
    }
  }
  if (column.length) {
    while (column.length < 7) column.push(null)
    columns.push(column)
  }
  return columns
}

/**
 * Steps 300/500/700/900 rather than 100/300/500/700: `--brand-100` is
 * oklch 0.94 in light mode, near enough to white that the lowest step was
 * indistinguishable from an empty day, which is the one distinction this
 * scale most has to make. Starting at 300 and anchoring on 900 spreads the
 * four steps across the visible range and gives "More" a dark end to land
 * on, the way GitHub's does.
 */
const BUCKET_STYLE: Record<HeatCell['bucket'], string> = {
  0: 'bg-muted',
  1: 'bg-brand-300',
  2: 'bg-brand-500',
  3: 'bg-brand-700',
  4: 'bg-brand-900',
}

const MONTH_LABEL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * A month name above the first column that month appears in.
 *
 * Keyed off the column's first real cell rather than its index, so the
 * label lands on the week the month actually starts in even when the run
 * begins mid-week. The first column is skipped when it holds only a few
 * days of the outgoing month — a label there would sit half off the left
 * edge with nothing under it.
 */
function buildMonthLabels(columns: (HeatCell | null)[][]): (string | null)[] {
  const labels: (string | null)[] = []
  let previous = -1
  columns.forEach((column, index) => {
    const first = column.find((c): c is HeatCell => c !== null)
    if (!first) {
      labels.push(null)
      return
    }
    const month = first.date.getMonth()
    const changed = month !== previous
    previous = month
    labels.push(changed && index > 0 ? (MONTH_LABEL[month] ?? null) : null)
  })
  return labels
}

function formatCellDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

/**
 * One figure beside the grid.
 *
 * Boxed on mobile and plain on desktop: stacked in a narrow column these
 * were three runs of unstyled text with nothing separating them, so below
 * `lg` each one gets its own bordered tile in a row and the icon is
 * dropped, which is what makes three short figures read as a set rather
 * than as a paragraph.
 */
function Figure({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Flame
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-2.5 lg:flex-row lg:items-start lg:gap-2.5 lg:rounded-none lg:border-0 lg:p-0">
      <span className="hidden shrink-0 place-items-center rounded-lg bg-primary/15 text-primary lg:grid lg:size-8">
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase lg:text-[0.65rem]">
          {label}
        </span>
        <span className="text-sm font-bold tracking-tight tabular-nums lg:text-base">{value}</span>
        <span className="truncate text-[0.65rem] text-muted-foreground lg:text-[0.7rem]">
          {detail}
        </span>
      </div>
    </div>
  )
}

export function ApplicationHeatmap({ points }: { points: DailyCount[] }) {
  const reduce = useReducedMotion()

  // Measured, not guessed. The observed element is `flex-1 min-w-0`, so its
  // width comes from the flex row rather than from the grid inside it —
  // there is no feedback loop between what is drawn and what is measured.
  const gridRef = useRef<HTMLDivElement>(null)
  const [weeks, setWeeks] = useState(MIN_WEEKS)

  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => setWeeks(weeksThatFit(el.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const cells = buildCells(points, weeks)
  const columns = buildColumns(cells)
  const monthLabels = buildMonthLabels(columns)
  const total = cells.reduce((sum, c) => sum + c.count, 0)
  const activeDays = cells.filter((c) => c.count > 0).length

  // A plain forward scan rather than a reduce, so no non-null-asserted
  // `cells[0]` is needed as a seed.
  let busiest = cells[0] ?? null
  for (const cell of cells) {
    if (busiest === null || cell.count > busiest.count) busiest = cell
  }

  return (
    <Card className="overflow-hidden border-2 border-foreground/15">
      <CardHeader>
        <CardTitle className="text-base">Application activity</CardTitle>
        <CardDescription>
          Every day of the last {weeks} weeks, shaded by how many candidates applied.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div
          role="img"
          aria-label={`${total} applications over the last ${weeks} weeks across ${activeDays} active days${
            busiest && busiest.count > 0
              ? `, busiest ${formatCellDate(busiest.date)} with ${busiest.count}`
              : ''
          }`}
          ref={gridRef}
          className="flex min-w-0 flex-1 flex-col gap-3"
        >
          {/* No scroll container of any kind: the window is sized so the
              whole grid fits the card at every width, so there is nothing
              to scroll to. */}
          <div>
            <div className="flex items-stretch gap-2">
              <div className="flex shrink-0 flex-col gap-[3px] pt-[15px] text-[0.65rem] leading-3 text-muted-foreground">
                {WEEKDAY_LABEL.map((label, i) => (
                  <span key={label} className="h-3">
                    {i % 2 === 1 ? label : ''}
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-[3px]">
                {/* Month ruler. A label sits above the first column whose
                    month differs from the column before it, so it lands on
                    the week that month actually starts in. */}
                <div className="flex gap-[3px] text-[0.65rem] leading-3 text-muted-foreground">
                  {columns.map((_column, columnIndex) => (
                    <span key={columnIndex} className="w-3 shrink-0 overflow-visible whitespace-nowrap">
                      {monthLabels[columnIndex] ?? ''}
                    </span>
                  ))}
                </div>

                <div className="flex gap-[3px]">
                  {columns.map((column, columnIndex) => (
                    <div key={columnIndex} className="flex flex-col gap-[3px]">
                      {column.map((cell, rowIndex) =>
                        cell ? (
                          <Tooltip key={cell.key}>
                            <TooltipTrigger
                              render={
                                <motion.div
                                  initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{
                                    duration: 0.25,
                                    // Across 53 columns a per-column delay
                                    // would run for seconds, so the sweep is
                                    // compressed to finish in well under one.
                                    delay: reduce ? 0 : columnIndex * 0.008 + rowIndex * 0.01,
                                    ease: [0.21, 0.47, 0.32, 0.98],
                                  }}
                                  className={cn(
                                    'size-3 cursor-pointer rounded-[3px] ring-1 ring-foreground/5 transition-transform duration-150 hover:scale-125 hover:ring-2 hover:ring-primary',
                                    BUCKET_STYLE[cell.bucket],
                                  )}
                                />
                              }
                            />
                            <TooltipContent side="top">
                              <span className="font-medium">
                                {cell.count} application{cell.count === 1 ? '' : 's'}
                              </span>
                              {' · '}
                              {formatCellDate(cell.date)}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div key={rowIndex} className="size-3" />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
            <span>Less</span>
            {([0, 1, 2, 3, 4] as const).map((bucket) => (
              <span
                key={bucket}
                className={cn(
                  'size-3 rounded-[3px] ring-1 ring-foreground/5',
                  BUCKET_STYLE[bucket],
                )}
              />
            ))}
            <span>More</span>
          </div>
        </div>

        {/* Uses the width the grid leaves over rather than letting the card
            run half empty — all three figures come from the same array the
            grid is drawn from, so nothing here is a second source. */}
        {/* A three-up grid of tiles on mobile, a bordered column on desktop. */}
        <div className="grid shrink-0 grid-cols-3 gap-2 lg:flex lg:w-52 lg:flex-col lg:gap-4 lg:border-l lg:border-border lg:pl-6">
          <div className="flex flex-col gap-1 rounded-lg border border-border p-2.5 lg:gap-0.5 lg:rounded-none lg:border-0 lg:p-0">
            <span className="text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase lg:text-[0.65rem]">
              Applications
            </span>
            <span className="text-lg font-bold tracking-tight tabular-nums lg:text-2xl">
              <Counter to={total} />
            </span>
            <span className="text-[0.65rem] text-muted-foreground lg:text-xs">
              Last {weeks} weeks
            </span>
          </div>

          <Figure
            icon={Flame}
            label="Busiest day"
            value={busiest && busiest.count > 0 ? String(busiest.count) : '—'}
            detail={
              busiest && busiest.count > 0 ? formatCellDate(busiest.date) : 'No applications yet'
            }
          />

          <Figure
            icon={CalendarRange}
            label="Active days"
            value={`${activeDays}`}
            detail={activeDays === 0 ? 'Nothing yet' : 'At least one'}
          />
        </div>
      </CardContent>
    </Card>
  )
}
