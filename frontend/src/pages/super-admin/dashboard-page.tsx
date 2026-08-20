import { motion } from 'motion/react'
import {
  ArrowRight,
  Building2,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader, StatCard, StatusDot } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { chartTooltipStyle } from '@/lib/chart-theme'
import { ADMINS, APPLICATIONS_OVER_TIME, BOOTCAMPS, CITY_SPLIT } from '@/lib/mock-data'

const STATUS_TONE = {
  REG_OPEN: 'success',
  INTERVIEWING: 'warning',
  COMPLETED: 'neutral',
  DRAFT: 'info',
} as const

const STATUS_LABEL = {
  REG_OPEN: 'Registration open',
  INTERVIEWING: 'Interviewing',
  COMPLETED: 'Completed',
  DRAFT: 'Draft',
} as const

export default function SuperAdminDashboardPage() {
  const totalApplicants = BOOTCAMPS.reduce((sum, b) => sum + b.applicants, 0)
  const activeBootcamps = BOOTCAMPS.filter(
    (b) => b.status === 'REG_OPEN' || b.status === 'INTERVIEWING',
  ).length

  return (
    <>
      <PageHeader
        title="Global overview"
        description="Every bootcamp, every administrator, across all campuses."
        actions={
          <>
            <Button variant="outline" render={<Link to="/super-admin/analytics" />}>
              <TrendingUp className="size-4" />
              Full analytics
            </Button>
            <Button render={<Link to="/super-admin/bootcamps" />}>
              <Building2 className="size-4" />
              Manage bootcamps
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total applicants" value={totalApplicants} icon={Users} trend={22} hint="all bootcamps" delay={0} />
        <StatCard label="Active bootcamps" value={activeBootcamps} suffix={` of ${BOOTCAMPS.length}`} icon={Building2} delay={0.06} />
        <StatCard label="Administrators" value={ADMINS.length} icon={ShieldCheck} hint="3 active" delay={0.12} />
        <StatCard label="Students enrolled" value={1130} icon={GraduationCap} trend={9} hint="current cohorts" delay={0.18} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Application volume</CardTitle>
              <CardDescription>Across all active intakes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={APPLICATIONS_OVER_TIME} margin={{ left: -18, right: 8, top: 8 }}>
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
                  <Line
                    type="monotone"
                    dataKey="applications"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name="Applications"
                  />
                  <Line
                    type="monotone"
                    dataKey="interviews"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name="Interviews"
                  />
                </LineChart>
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
              <CardTitle className="text-base">Applicants by city</CardTitle>
              <CardDescription>Geographic reach this intake</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={CITY_SPLIT} margin={{ left: -18, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="city"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                  />
                  <Tooltip {...chartTooltipStyle} cursor={{ fill: 'var(--color-muted)' }} />
                  <Bar
                    dataKey="applicants"
                    fill="var(--color-chart-1)"
                    radius={[6, 6, 0, 0]}
                    name="Applicants"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* Bootcamps */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.22 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">All bootcamps</CardTitle>
                  <CardDescription>Status and capacity across intakes</CardDescription>
                </div>
                <Button variant="ghost" size="sm" render={<Link to="/super-admin/bootcamps" />}>
                  View all
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {BOOTCAMPS.map((bootcamp, index) => {
                const fill = Math.min(
                  100,
                  Math.round((bootcamp.applicants / bootcamp.seats) * 100),
                )

                return (
                  <motion.div
                    key={bootcamp.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.26 + index * 0.06 }}
                    className="flex flex-col gap-2.5 rounded-xl border border-border p-4 transition-colors hover:border-primary/35"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{bootcamp.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Admin: {bootcamp.admin}
                        </span>
                      </span>
                      <StatusDot
                        tone={STATUS_TONE[bootcamp.status]}
                        label={STATUS_LABEL[bootcamp.status]}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Progress value={fill} className="flex-1">
                        <ProgressTrack>
                          <ProgressIndicator />
                        </ProgressTrack>
                      </Progress>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {bootcamp.applicants} / {bootcamp.seats}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Admins */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.28 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">Administrators</CardTitle>
                  <CardDescription>Who is managing what</CardDescription>
                </div>
                <Button variant="ghost" size="sm" render={<Link to="/super-admin/admins" />}>
                  Manage
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {ADMINS.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/35"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {admin.name.split(' ').map((n) => n[0]).join('')}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{admin.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {admin.bootcamps.length
                          ? admin.bootcamps.join(', ')
                          : 'No bootcamps assigned'}
                      </span>
                    </span>
                  </span>
                  <Badge
                    variant={admin.status === 'active' ? 'secondary' : 'outline'}
                    className="shrink-0 text-[0.68rem]"
                  >
                    {admin.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  )
}
