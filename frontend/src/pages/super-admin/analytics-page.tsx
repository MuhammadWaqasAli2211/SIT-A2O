import { motion } from 'motion/react'
import { Download, Percent, TrendingUp, UserCheck, Users } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader, StatCard } from '@/components/shared/portal-ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { chartTooltipStyle } from '@/lib/chart-theme'
import {
  APPLICATIONS_OVER_TIME,
  CITY_SPLIT,
  FUNNEL,
  PROGRAM_SPLIT,
} from '@/lib/mock-data'

const CONVERSION_BY_BOOTCAMP = [
  { bootcamp: 'BC 04', applied: 401, selected: 250, rate: 62 },
  { bootcamp: 'BC 05', applied: 478, selected: 280, rate: 59 },
  { bootcamp: 'BC 06', applied: 512, selected: 300, rate: 59 },
  { bootcamp: 'BC 07', applied: 441, selected: 112, rate: 25 },
]

const QUALITY_RADAR = [
  { dimension: 'Communication', current: 82, previous: 74 },
  { dimension: 'Problem solving', current: 76, previous: 71 },
  { dimension: 'Motivation', current: 91, previous: 88 },
  { dimension: 'Technical aptitude', current: 68, previous: 64 },
  { dimension: 'Attendance', current: 88, previous: 79 },
]

export default function SuperAdminAnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Cross-bootcamp performance, conversion, and candidate quality."
        actions={
          <Button variant="outline">
            <Download className="size-4" />
            Export report
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total applications" value={1832} icon={Users} trend={19} hint="last 4 intakes" delay={0} />
        <StatCard label="Selected" value={942} icon={UserCheck} trend={7} delay={0.06} />
        <StatCard label="Conversion rate" value={51.4} decimals={1} suffix="%" icon={Percent} trend={-2} delay={0.12} />
        <StatCard label="Avg interview score" value={78.2} decimals={1} icon={TrendingUp} trend={4} delay={0.18} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
      >
        <Tabs defaultValue="volume">
          <TabsList className="mb-5">
            <TabsTrigger value="volume">Volume</TabsTrigger>
            <TabsTrigger value="conversion">Conversion</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="reach">Reach</TabsTrigger>
          </TabsList>

          {/* Volume */}
          <TabsContent value="volume">
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Applications & interviews</CardTitle>
                  <CardDescription>Cumulative across the current intake</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={APPLICATIONS_OVER_TIME} margin={{ left: -18, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="anApplications" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="anInterviews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                      <Tooltip {...chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="applications" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#anApplications)" name="Applications" />
                      <Area type="monotone" dataKey="interviews" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#anInterviews)" name="Interviews" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Selection funnel</CardTitle>
                  <CardDescription>Drop-off at each stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={FUNNEL} layout="vertical" margin={{ left: 12, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                      <YAxis type="category" dataKey="stage" tickLine={false} axisLine={false} width={84} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                      <Tooltip {...chartTooltipStyle} cursor={{ fill: 'var(--color-muted)' }} />
                      <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} name="Candidates" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Conversion */}
          <TabsContent value="conversion">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversion by bootcamp</CardTitle>
                <CardDescription>
                  Applied versus selected. Bootcamp 07 is still mid-cycle, so its rate is
                  not yet comparable.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={CONVERSION_BY_BOOTCAMP} margin={{ left: -18, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="bootcamp" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                    <Tooltip {...chartTooltipStyle} cursor={{ fill: 'var(--color-muted)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="applied" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} name="Applied" />
                    <Bar dataKey="selected" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} name="Selected" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quality */}
          <TabsContent value="quality">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Candidate quality</CardTitle>
                  <CardDescription>Average interview scores, this intake vs last</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <RadarChart data={QUALITY_RADAR}>
                      <PolarGrid stroke="var(--color-border)" />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                      <Tooltip {...chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Radar name="Bootcamp 07" dataKey="current" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.28} />
                      <Radar name="Bootcamp 06" dataKey="previous" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.18} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Applicants by program</CardTitle>
                  <CardDescription>Where demand is concentrated</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={PROGRAM_SPLIT} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={3} strokeWidth={0}>
                        {PROGRAM_SPLIT.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip {...chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>

                  <ul className="flex flex-col gap-2">
                    {PROGRAM_SPLIT.map((entry) => (
                      <li key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
                          <span className="truncate text-muted-foreground">{entry.name}</span>
                        </span>
                        <span className="font-medium tabular-nums">{entry.value}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Reach */}
          <TabsContent value="reach">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Geographic reach</CardTitle>
                <CardDescription>Applicants by city, current intake</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={CITY_SPLIT} margin={{ left: -18, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="city" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                    <Tooltip {...chartTooltipStyle} cursor={{ fill: 'var(--color-muted)' }} />
                    <Bar dataKey="applicants" radius={[6, 6, 0, 0]} name="Applicants">
                      {CITY_SPLIT.map((_, index) => (
                        <Cell key={index} fill={`var(--color-chart-${(index % 5) + 1})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </>
  )
}
