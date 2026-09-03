/**
 * The two Recharts panels inside the hero's dashboard preview.
 *
 * Split into its own module and loaded lazily for the same reason
 * `pages/admin/dashboard-charts.tsx` is: Recharts is a few hundred kilobytes,
 * and it must not sit in the entry chunk of a marketing page that is the first
 * thing a visitor on a slow connection downloads. The hero renders a static
 * skeleton of the same height while this resolves, so nothing shifts.
 *
 * Numbers are illustrative — see the header of preview-data.ts for the exact
 * real/illustrative split and why.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PREVIEW_RANGES,
  PREVIEW_SPLIT,
  PREVIEW_TOTAL,
  TONE_COLOR,
  trendForRange,
  type PreviewRange,
} from '@/features/marketing/preview-data'
import { cn } from '@/lib/utils'

const AXIS = {
  stroke: 'var(--color-muted-foreground)',
  fontSize: 10,
  tickLine: false,
  axisLine: false,
} as const

export default function PreviewCharts() {
  return (
    // Container-relative, matching the card that owns it: side by side once
    // the card is wide enough to give the donut and its legend room, stacked
    // below that rather than squeezed.
    <div className="grid gap-3 @2xl:grid-cols-[1.55fr_1fr]">
      <TrendPanel />
      <SplitPanel />
    </div>
  )
}

/* ------------------------------------------------------------------ trend -- */

function TrendPanel() {
  const [range, setRange] = useState<PreviewRange>('This Month')
  const data = trendForRange(range)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[0.82rem] font-semibold">Applications Over Time</span>

        {/* A real control, not a painted one: changing it re-derives the
            series and the curve redraws. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background',
              'px-2 py-1 text-[0.68rem] font-medium text-muted-foreground',
              'transition-colors hover:bg-muted hover:text-foreground',
            )}
          >
            {range}
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            {PREVIEW_RANGES.map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => setRange(option)}
                className={cn('text-xs', option === range && 'font-medium text-primary')}
              >
                {option}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
            <defs>
              <linearGradient id="preview-applications" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" interval={0} {...AXIS} />
            <YAxis {...AXIS} width={38} allowDecimals={false} />
            <Tooltip
              // Inline rather than the shared `chartTooltipStyle`: this one has
              // to render at the preview's smaller scale, and it labels the
              // point "2,842 Applications" the way the reference does.
              cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
              content={<TrendTooltip />}
            />
            <Area
              type="monotone"
              dataKey="applications"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill="url(#preview-applications)"
              // The dot only appears under the cursor; 13 permanent dots on a
              // card this small reads as noise.
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--color-card)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface TooltipPayload {
  payload: { date: string; applications: number }
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayload[]
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg">
      <p className="text-[0.68rem] font-medium text-foreground">{point.date || 'Mid-week'}</p>
      <p className="flex items-center gap-1.5 text-[0.68rem] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-chart-1" />
        {point.applications.toLocaleString('en-US')} Applications
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ split -- */

function SplitPanel() {
  /**
   * Which slice the pointer is over. Held here rather than left to Recharts'
   * own active-shape handling so the *legend row* highlights in step with the
   * ring — hovering either one lights both, which is what makes the legend
   * feel like part of the chart rather than a caption under it.
   */
  const [active, setActive] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3.5">
      <span className="text-[0.82rem] font-semibold">Application Status</span>

      <div className="flex items-center gap-2">
        <div className="relative size-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[...PREVIEW_SPLIT]}
                dataKey="value"
                nameKey="label"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={2}
                strokeWidth={0}
                // Recharts' own entrance sweep, kept short so the ring is
                // settled by the time a visitor has read the heading.
                animationDuration={900}
                onMouseEnter={(_, index) => setActive(index)}
                onMouseLeave={() => setActive(null)}
              >
                {PREVIEW_SPLIT.map((slice, index) => (
                  <Cell
                    key={slice.label}
                    fill={TONE_COLOR[slice.tone]}
                    // Dimming the others reads more clearly at this size than
                    // growing the active one, which would clip the ring.
                    opacity={active === null || active === index ? 1 : 0.35}
                    style={{ transition: 'opacity 200ms' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Total, centred in the ring. Absolutely positioned rather than a
              Recharts label so it stays legible and selectable. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm leading-none font-bold tabular-nums">
              {PREVIEW_TOTAL.toLocaleString('en-US')}
            </span>
            <span className="text-[0.6rem] text-muted-foreground">Total</span>
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-1">
          {PREVIEW_SPLIT.map((slice, index) => {
            const percent = Math.round((slice.value / PREVIEW_TOTAL) * 100)
            return (
              <li
                key={slice.label}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  'flex items-start gap-1.5 rounded-md px-1 py-0.5 transition-colors',
                  active === index && 'bg-muted',
                )}
              >
                <span
                  className="mt-1 size-2 shrink-0 rounded-[3px]"
                  style={{ background: TONE_COLOR[slice.tone] }}
                />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[0.68rem] font-medium">{slice.label}</span>
                  <span className="text-[0.62rem] tabular-nums text-muted-foreground">
                    {slice.value.toLocaleString('en-US')} ({percent}%)
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
