import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Mail,
  Percent,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Stagger, StaggerItem } from '@/components/motion/reveal'
import {
  AsyncSection,
  BootcampStatusBadge,
  BootcampSwitcher,
  BootcampGate,
} from '@/features/admin/components'
import { ApplicationHeatmap } from '@/features/admin/application-heatmap'
import { bootcampApi } from '@/features/admin/api'
import { FunnelWidget } from '@/features/admin/funnel-widget'
import { LiveIndicator } from '@/features/live/live-indicator'
import { useLiveResource } from '@/features/live/use-live-resource'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { EmptyState, PageHeader, StatCard } from '@/components/shared/portal-ui'
import { STAGE_LABEL, STAGE_ORDER, type ApplicationStage, type BootcampStats } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Same tone vocabulary as StageBadge/STAGE_STYLE in portal-ui.tsx, expressed
 * as bar fills instead of badge backgrounds — a reader who already knows
 * what "info" or "success" means for a stage elsewhere in the app gets that
 * for free here rather than learning a second colour language for one card.
 */
const STAGE_BAR: Record<ApplicationStage, string> = {
  APPLIED: 'bg-muted-foreground/35',
  INTERVIEW_SCHEDULED: 'bg-info',
  'AI-INTERVIEWED': 'bg-info',
  PHYSICAL_INTERVIEW: 'bg-success',
  FORM: 'bg-warning',
  ONBOARDED: 'bg-success',
  REJECTED: 'bg-destructive',
}

// Recharts is the heaviest thing the admin bundle pulls in; keep it out of the
// initial chunk so the dashboard shell paints before the charts arrive.
const DashboardCharts = lazy(() => import('@/pages/admin/dashboard-charts'))

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminDashboardPage() {
  const { selected, selectedId, loading: bootcampLoading } = useBootcamp()

  // Live rather than a one-shot fetch: an admin advancing a candidate from
  // the AI interview report screen (or any other screen) has no shared cache
  // to invalidate, so the dashboard needs to notice on its own. Backs off on
  // its own when the tab is hidden, same contract as the AI Interviews
  // screen.
  const { data, error, initialLoading, lastUpdated, live, refresh } = useLiveResource(
    () => (selectedId ? bootcampApi.stats(selectedId) : Promise.resolve(undefined)),
    [selectedId],
  )

  return (
    <>
      <PageHeader
        title="Bootcamp dashboard"
        description={
          bootcampLoading
            ? undefined
            : selected
              ? `Live figures for ${selected.name}.`
              : 'Pick an intake to see how it is tracking.'
        }
        actions={
          <>
            <BootcampSwitcher />
            <Button variant="outline" size="icon" onClick={refresh} aria-label="Refresh">
              <RefreshCw className="size-4" />
            </Button>
          </>
        }
      />

      <BootcampGate>
        {(_selectedId) => (
          <>
            <LiveIndicator lastUpdated={lastUpdated} live={live} className="mb-4" />
            <AsyncSection initialLoading={initialLoading} error={error} onRetry={refresh}>
              {data && <DashboardBody stats={data} />}
            </AsyncSection>
          </>
        )}
      </BootcampGate>
    </>
  )
}

function DashboardBody({ stats }: { stats: BootcampStats }) {
  /** Share of active candidates who have reached the end of the pipeline. */
  const conversion = useMemo(() => {
    if (!stats.total_applications) return 0
    return Math.round((stats.onboarded / stats.total_applications) * 1000) / 10
  }, [stats])

  const attendance = useMemo(() => {
    const held = stats.interviews_completed + stats.interviews_no_show
    if (!held) return null
    return Math.round((stats.interviews_completed / held) * 1000) / 10
  }, [stats])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <BootcampStatusBadge status={stats.status} />
        <Badge variant="outline" className="font-normal">
          Intake {String(stats.bootcamp_number).padStart(2, '0')}
        </Badge>
        {stats.applications_last_7_days > 0 && (
          <Badge variant="outline" className="gap-1 font-normal text-success">
            <TrendingUp className="size-3" />
            {stats.applications_last_7_days} this week
          </Badge>
        )}
      </div>

      {/* Two per row on mobile, not one: a full-width card per stat pushed
          the fourth one three screens down. `Stagger`/`StaggerItem` own the
          entrance now — StatCard no longer animates itself, so the row
          arrives in sequence instead of four cards appearing at once. */}
      <Stagger trigger="mount" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label="Total applications"
            value={stats.total_applications}
            icon={Users}
            hint={`${stats.active_applications} still active`}
            tone="primary"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Interviews completed"
            value={stats.interviews_completed}
            icon={UserCheck}
            hint={`${stats.interviews_scheduled} scheduled`}
            tone="info"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Onboarded"
            value={stats.onboarded}
            icon={CheckCircle2}
            hint={`${conversion}% of applicants`}
            tone="success"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Emails sent"
            value={stats.emails_sent}
            icon={Mail}
            hint="Delivered by the platform"
            tone="warning"
          />
        </StaggerItem>
      </Stagger>

      <Stagger trigger="mount" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StaggerItem>
          <MiniStat
            label="Average interview score"
            value={stats.average_score === null ? '—' : `${stats.average_score}`}
            hint={stats.average_score === null ? 'No scores recorded yet' : 'Out of 100'}
            icon={Percent}
          />
        </StaggerItem>
        <StaggerItem>
          <MiniStat
            label="Attendance rate"
            value={attendance === null ? '—' : `${attendance}%`}
            hint={
              attendance === null
                ? 'No interviews held yet'
                : `${stats.interviews_no_show} no-shows`
            }
            icon={CalendarCheck}
          />
        </StaggerItem>
        <StaggerItem>
          <MiniStat
            label="Rejected"
            value={String(stats.rejected_applications)}
            hint="Can be reinstated if needed"
            icon={XCircle}
            tone="muted"
          />
        </StaggerItem>
      </Stagger>

      {/* Replaces the old flat "New this week" count. Given its own
          full-width card rather than a quarter of a stat row: a 7-row grid
          squeezed into a 220px column had to use 11px cells to fit, which
          is what made it read as an afterthought. */}
      <ApplicationHeatmap points={stats.application_activity} />

      <FunnelWidget
        bootcampId={stats.bootcamp_id}
        physicalInterviewFunnel={stats.physical_interview_funnel}
      />

      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <DashboardCharts stats={stats} />
      </Suspense>

      <div className="grid gap-3 lg:grid-cols-2">
        <PipelineCard stats={stats} />
        <UpcomingCard stats={stats} />
      </div>
    </div>
  )
}

/**
 * Second-tier stat: same data density as StatCard's row, and now the same
 * hover/border treatment, but a smaller icon chip and the uppercase label
 * voice FunnelStage already uses for secondary figures — the page still
 * reads top row = headline, second row = supporting detail, just not at
 * the cost of looking unfinished next to it.
 */
function MiniStat({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  tone?: 'default' | 'muted'
}) {
  return (
    <Card
      className={cn(
        'group h-full border-2 border-foreground/15 py-0',
        'transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/10',
        tone === 'muted' ? 'hover:border-muted-foreground/60' : 'hover:border-primary',
      )}
    >
      <CardContent className="flex items-start gap-2 p-3">
        <span
          className={cn(
            'mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg transition-all duration-200 ease-out group-hover:scale-105 group-hover:shadow-md sm:size-7',
            tone === 'muted'
              ? 'bg-muted-foreground/15 text-muted-foreground group-hover:bg-muted-foreground group-hover:text-background'
              : 'bg-primary/15 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
          <span className="text-base font-bold tracking-tight tabular-nums sm:text-lg">
            {value}
          </span>
          <span className="truncate text-[0.7rem] text-muted-foreground">{hint}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function PipelineCard({ stats }: { stats: BootcampStats }) {
  const total = stats.by_stage.reduce((sum, s) => sum + s.count, 0)
  const max = Math.max(...stats.by_stage.map((s) => s.count), 1)
  // Fixed funnel order rather than whatever the API returned, so a stage
  // with zero applicants still holds its place instead of the list
  // reshuffling as counts change.
  const rows = STAGE_ORDER.map(
    (stage) => stats.by_stage.find((s) => s.stage === stage) ?? { stage, count: 0 },
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline</CardTitle>
        <CardDescription>Where every applicant currently sits.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        {rows.map((row, index) => (
          <motion.div
            key={row.stage}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: index * 0.04 }}
          >
            <span className="w-32 shrink-0 truncate text-sm text-muted-foreground sm:w-36">
              {STAGE_LABEL[row.stage]}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn('h-full rounded-full', STAGE_BAR[row.stage])}
                initial={{ width: 0 }}
                animate={{ width: `${(row.count / max) * 100}%` }}
                transition={{
                  duration: 0.6,
                  delay: 0.1 + index * 0.04,
                  ease: 'easeOut',
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-sm font-medium tabular-nums">
              {row.count}
              {total > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {Math.round((row.count / total) * 100)}%
                </span>
              )}
            </span>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  )
}

function UpcomingCard({ stats }: { stats: BootcampStats }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">Next interviews</CardTitle>
          <CardDescription>The soonest scheduled slots.</CardDescription>
        </div>
        <Link to="/admin/interviews" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          <CalendarClock className="size-3.5" />
          Manage
        </Link>
      </CardHeader>
      <CardContent>
        {stats.upcoming_interviews.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled"
            description="Schedule a batch from the Interviews screen once screening opens."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {stats.upcoming_interviews.map((interview) => (
              <li key={interview.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {interview.candidate_name ?? interview.candidate_code}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {interview.candidate_code}
                    {interview.location ? ` · ${interview.location}` : ''}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(interview.scheduled_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
