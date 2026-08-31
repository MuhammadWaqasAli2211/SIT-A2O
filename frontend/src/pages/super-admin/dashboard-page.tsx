import {
  BarChart3,
  Building2,
  CalendarClock,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState, PageHeader, StatCard } from '@/components/shared/portal-ui'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { platformApi } from '@/features/admin/api'
import {
  AsyncSection,
  BootcampStatusBadge,
  CardsSkeleton,
} from '@/features/admin/components'
import { LiveIndicator } from '@/features/live/live-indicator'
import { useLiveResource } from '@/features/live/use-live-resource'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { STAGE_LABEL, type PlatformStats } from '@/lib/types'

export default function SuperAdminDashboardPage() {
  // Live rather than a one-shot fetch: a stage change made from any admin
  // screen has no shared cache to invalidate, so the platform view needs to
  // notice on its own rather than only showing what was true at mount. Backs
  // off on its own when the tab is hidden, same contract as the AI
  // Interviews screen.
  const { data, error, initialLoading, lastUpdated, live, refresh } = useLiveResource(
    () => platformApi.stats(),
    [],
  )

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Every intake, every administrator, across the whole platform."
        actions={
          <>
            <Link to="/super-admin/analytics" className={buttonVariants({ variant: 'outline' })}>
              <BarChart3 className="size-4" />
              Analytics
            </Link>
            <Button variant="outline" size="icon" onClick={refresh} aria-label="Refresh">
              <RefreshCw className="size-4" />
            </Button>
          </>
        }
      />

      <LiveIndicator lastUpdated={lastUpdated} live={live} className="mb-4" />
      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refresh}
        skeleton={<CardsSkeleton />}
      >
        {data && <Body stats={data} />}
      </AsyncSection>
    </>
  )
}

function Body({ stats }: { stats: PlatformStats }) {
  const { select } = useBootcamp()

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bootcamps"
          value={stats.total_bootcamps}
          icon={Building2}
          hint={`${stats.active_bootcamps} currently running`}
        />
        <StatCard
          label="Candidates"
          value={stats.total_candidates}
          icon={Users}
          hint={`${stats.total_applications} applications`}
          delay={0.05}
        />
        <StatCard
          label="Interviews"
          value={stats.total_interviews}
          icon={UserCheck}
          hint="Scheduled across all intakes"
          delay={0.1}
        />
        <StatCard
          label="Administrators"
          value={stats.total_admins}
          icon={ShieldCheck}
          hint="Including super admins"
          delay={0.15}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="text-base">Intakes</CardTitle>
              <CardDescription>Every bootcamp and how far along it is.</CardDescription>
            </div>
            <Link
              to="/super-admin/bootcamps"
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {stats.bootcamps.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No bootcamps yet"
                description="Create the first intake to get started."
                action={
                  <Link
                    to="/super-admin/bootcamps"
                    className={buttonVariants({ size: 'sm' })}
                  >
                    New bootcamp
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {stats.bootcamps.map((bootcamp) => (
                  <li
                    key={bootcamp.id}
                    className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{bootcamp.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {bootcamp.application_count} application
                        {bootcamp.application_count === 1 ? '' : 's'}
                        {bootcamp.admin_names.length > 0
                          ? ` · ${bootcamp.admin_names.join(', ')}`
                          : ' · no administrator'}
                      </span>
                    </div>
                    <BootcampStatusBadge status={bootcamp.status} />
                    {/* Selecting here means the admin tools open on this intake. */}
                    <Link
                      to="/admin"
                      onClick={() => select(bootcamp.id)}
                      className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline</CardTitle>
            <CardDescription>Across every intake.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(() => {
              const max = Math.max(...stats.by_stage.map((s) => s.count), 1)
              return stats.by_stage.map((row) => (
                <div key={row.stage} className="flex items-center gap-2.5">
                  <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">
                    {STAGE_LABEL[row.stage]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${(row.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums">
                    {row.count}
                  </span>
                </div>
              ))
            })()}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Mail} label="Emails delivered" value={stats.emails_sent} />
        <Tile icon={CalendarClock} label="Interviews held" value={stats.total_interviews} />
        <Tile
          icon={Building2}
          label="Active intakes"
          value={stats.active_bootcamps}
        />
        <Tile icon={Users} label="Total applications" value={stats.total_applications} />
      </div>
    </div>
  )
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs text-muted-foreground">{label}</span>
          <span className="text-lg font-semibold tabular-nums">{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}
