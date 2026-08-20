import { motion } from 'motion/react'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Mail,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader, StageBadge, StatCard } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import {
  APPLICATIONS_OVER_TIME,
  CANDIDATES,
  FUNNEL,
  PHASES,
  PROGRAM_SPLIT,
} from '@/lib/mock-data'
import { chartTooltipStyle } from '@/lib/chart-theme'

export default function AdminDashboardPage() {
  const recent = CANDIDATES.slice(0, 6)

  return (
    <>
      <PageHeader
        title="Bootcamp 07 — Autumn 2026"
        description="Registration is open until 30 September. 441 applications received so far."
        actions={
          <>
            <Button variant="outline" render={<Link to="/admin/emails" />}>
              <Mail className="size-4" />
              Send batch email
            </Button>
            <Button render={<Link to="/admin/candidates" />}>
              <Users className="size-4" />
              Review candidates
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total applications" value={441} icon={Users} trend={18} hint="vs last intake" delay={0} />
        <StatCard label="Interviews completed" value={300} icon={UserCheck} trend={6} hint="of 441 invited" delay={0.06} />
        <StatCard label="Selected so far" value={112} icon={CheckCircle2} trend={-3} hint="of 300 seats" delay={0.12} />
        <StatCard label="Days to deadline" value={4} icon={CalendarClock} hint="closes 30 Sept" delay={0.18} />
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">Applications over time</CardTitle>
                  <CardDescription>Cumulative, September intake</CardDescription>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="size-3" />
                  +18%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={APPLICATIONS_OVER_TIME} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillApplications" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fillInterviews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                  />
                  <Tooltip {...chartTooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="applications"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    fill="url(#fillApplications)"
                    name="Applications"
                  />
                  <Area
                    type="monotone"
                    dataKey="interviews"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    fill="url(#fillInterviews)"
                    name="Interviews"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">By program</CardTitle>
              <CardDescription>Distribution of applicants</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={PROGRAM_SPLIT}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
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
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="truncate text-muted-foreground">{entry.name}</span>
                    </span>
                    <span className="font-medium tabular-nums">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Funnel + phases */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Selection funnel</CardTitle>
              <CardDescription>Where candidates drop off</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={FUNNEL} layout="vertical" margin={{ left: 12, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    tickLine={false}
                    axisLine={false}
                    width={84}
                    tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                  />
                  <Tooltip {...chartTooltipStyle} cursor={{ fill: 'var(--color-muted)' }} />
                  <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} name="Candidates" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.26 }}
        >
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">Phase status</CardTitle>
                  <CardDescription>Deadline-gated stages</CardDescription>
                </div>
                <Button variant="ghost" size="sm" render={<Link to="/admin/phases" />}>
                  Manage
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {PHASES.map((phase) => (
                <div key={phase.phase} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {phase.label}
                      {phase.isOpen ? (
                        <Badge className="bg-success/15 text-success">Open</Badge>
                      ) : (
                        <Badge variant="outline">Closed</Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Closes {new Date(phase.deadlineAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <Progress value={phase.progress}>
                    <ProgressTrack>
                      <ProgressIndicator />
                    </ProgressTrack>
                  </Progress>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent applicants */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">Recent applications</CardTitle>
                <CardDescription>Latest six submissions</CardDescription>
              </div>
              <Button variant="ghost" size="sm" render={<Link to="/admin/candidates" />}>
                View all
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {recent.map((candidate, index) => (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.34 + index * 0.05 }}
                className="flex items-center justify-between gap-4 rounded-lg border-b border-border p-3 last:border-0 hover:bg-muted/50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {candidate.name.split(' ').map((n) => n[0]).join('')}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{candidate.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {candidate.code} · {candidate.program}
                    </span>
                  </span>
                </span>
                <StageBadge stage={candidate.stage} />
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
