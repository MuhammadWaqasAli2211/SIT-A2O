import { BarChart3, MapPin, RefreshCw } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { platformApi } from '@/features/admin/api'
import { AsyncSection } from '@/features/admin/components'
import { useAsync } from '@/hooks/use-async'
import { CHART_COLORS, chartTooltipStyle } from '@/lib/chart-theme'
import { STAGE_LABEL, type PlatformStats } from '@/lib/types'

const AXIS = {
  stroke: 'var(--color-muted-foreground)',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const

function shortDate(day: string) {
  return new Date(day).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

export default function SuperAdminAnalyticsPage() {
  const { data, error, initialLoading, loading, refetch } = useAsync(
    () => platformApi.stats(),
    [],
  )

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Applications, tracks, and reach across every intake."
        actions={
          <Button variant="outline" size="icon" onClick={refetch} aria-label="Refresh">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        }
      />

      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refetch}
      >
        {data && <Charts stats={data} />}
      </AsyncSection>
    </>
  )
}

function Charts({ stats }: { stats: PlatformStats }) {
  // Cumulative reads better than a daily spike for tracking reach. Summed from
  // the slice rather than a counter carried across the map — a mutable
  // accumulator in render is impure, and the series is capped at 30 points.
  const trend = stats.applications_over_time.map((point, index, all) => ({
    date: shortDate(point.day),
    total: all.slice(0, index + 1).reduce((sum, p) => sum + p.count, 0),
  }))

  const funnel = stats.by_stage.filter((row) => row.count > 0)
  const programs = stats.by_program.filter((row) => row.count > 0)

  const empty = stats.total_applications === 0

  if (empty) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing to chart yet"
        description="Analytics fill in once candidates start applying to an intake."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applications over time</CardTitle>
          <CardDescription>Cumulative across all intakes, last 30 days.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {trend.length === 0 ? (
            <EmptyState icon={BarChart3} title="No applications in the last 30 days" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="platform-apps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" {...AXIS} />
                <YAxis {...AXIS} width={44} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Applications"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="url(#platform-apps)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline funnel</CardTitle>
            <CardDescription>Where candidates sit across every intake.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnel.map((row) => ({ stage: STAGE_LABEL[row.stage], count: row.count }))}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 24, bottom: 4 }}
              >
                <XAxis type="number" {...AXIS} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" {...AXIS} width={110} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'var(--color-muted)' }} />
                <Bar dataKey="count" name="Candidates" radius={[0, 6, 6, 0]}>
                  {funnel.map((row, index) => (
                    <Cell key={row.stage} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By track</CardTitle>
            <CardDescription>Which programs applicants chose.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={programs}
                  dataKey="count"
                  nameKey="title"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {programs.map((row, index) => (
                    <Cell key={row.program_id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>

            <ul className="mt-3 flex flex-col gap-1.5">
              {programs.map((row, index) => (
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where applicants come from</CardTitle>
          <CardDescription>
            Top cities by application count. Candidates who have not filled in a city are not
            counted.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {stats.by_city.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No city data yet"
              description="City is collected on the candidate's profile; it fills in as applicants complete their details."
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.by_city} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
                <XAxis dataKey="city" {...AXIS} />
                <YAxis {...AXIS} width={44} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'var(--color-muted)' }} />
                <Bar
                  dataKey="count"
                  name="Applicants"
                  fill="var(--color-chart-2)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
