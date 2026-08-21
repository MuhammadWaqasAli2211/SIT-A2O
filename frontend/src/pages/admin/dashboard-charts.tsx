/**
 * The dashboard's Recharts panels, split into their own chunk.
 *
 * Recharts is a few hundred kilobytes and only the admin and super-admin
 * dashboards use it, so it is loaded lazily by the page rather than imported
 * at the top of it.
 */

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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/portal-ui'
import { CHART_COLORS, chartTooltipStyle } from '@/lib/chart-theme'
import type { BootcampStats } from '@/lib/types'
import { FileText, PieChart as PieIcon } from 'lucide-react'

const AXIS = {
  stroke: 'var(--color-muted-foreground)',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const

function shortDate(day: string) {
  return new Date(day).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

export default function DashboardCharts({ stats }: { stats: BootcampStats }) {
  /**
   * Running total reads better than a daily spike for an intake's progress.
   *
   * Summed from the slice rather than a counter carried across the map: a
   * mutable accumulator in render is impure, and the series is capped at 30
   * points so the extra passes cost nothing.
   */
  const trend = stats.applications_over_time.map((point, index, all) => ({
    date: shortDate(point.day),
    applications: all.slice(0, index + 1).reduce((sum, p) => sum + p.count, 0),
    daily: point.count,
  }))

  const split = stats.by_program.filter((row) => row.count > 0)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Applications over time</CardTitle>
          <CardDescription>Cumulative total across the last 30 days.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {trend.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No applications yet"
              description="The curve appears once candidates start applying."
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="applications" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" {...AXIS} />
                <YAxis {...AXIS} width={44} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="applications"
                  name="Total"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="url(#applications)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By program</CardTitle>
          <CardDescription>Which tracks applicants chose.</CardDescription>
        </CardHeader>
        <CardContent>
          {split.length === 0 ? (
            <EmptyState icon={PieIcon} title="Nothing to split yet" />
          ) : (
            // Fixed height on the wrapper, not the card: the legend below has
            // to sit outside the chart's responsive box or it gets clipped.
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={split}
                  dataKey="count"
                  nameKey="title"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {split.map((row, index) => (
                    <Cell
                      key={row.program_id}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}

          {split.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {split.map((row, index) => (
                <li key={row.program_id} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="flex-1 truncate text-muted-foreground">{row.title}</span>
                  <span className="font-medium tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
