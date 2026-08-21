import { ArrowRight, CalendarClock, FileText, GraduationCap, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState, PageHeader, StageBadge, Timeline } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AsyncSection } from '@/features/admin/components'
import { candidateApi } from '@/features/candidate/api'
import { useAsync } from '@/hooks/use-async'
import { useAuth } from '@/hooks/use-auth'
import {
  STAGE_LABEL,
  STAGE_ORDER,
  type ApplicationDetail,
  type InterviewRow,
} from '@/lib/types'

/** How far through the pipeline a stage sits, for the progress read-out. */
function progressFor(application: ApplicationDetail): number {
  if (application.stage === 'REJECTED') return 100
  const index = STAGE_ORDER.indexOf(application.stage)
  // REJECTED is last in the enum but is not a step on the happy path.
  const steps = STAGE_ORDER.length - 1
  return Math.round(((index + 1) / steps) * 100)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CandidateDashboardPage() {
  const { profile } = useAuth()

  const { data, error, initialLoading, refetch } = useAsync(
    () => Promise.all([candidateApi.myApplications(), candidateApi.myInterviews()]),
    [],
  )

  const [applications, interviews] = data ?? []
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Where your application stands, and what happens next."
      />

      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refetch}
        skeleton={<Skeleton className="h-80 w-full rounded-xl" />}
      >
        {applications && applications.length === 0 ? (
          <NoApplication />
        ) : (
          <div className="flex flex-col gap-5">
            {(applications ?? []).map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                interviews={(interviews ?? []).filter(
                  (i) => i.application_id === application.id,
                )}
              />
            ))}
          </div>
        )}
      </AsyncSection>
    </>
  )
}

function NoApplication() {
  return (
    <EmptyState
      icon={Sparkles}
      title="You have not applied yet"
      description="Browse the intakes currently open for applications and pick the track you want to join."
      action={
        <Link to="/dashboard/application" className={buttonVariants()}>
          Apply now
          <ArrowRight className="size-4" />
        </Link>
      }
    />
  )
}

function ApplicationCard({
  application,
  interviews,
}: {
  application: ApplicationDetail
  interviews: InterviewRow[]
}) {
  const progress = progressFor(application)
  const rejected = application.status === 'REJECTED'

  // Only interviews still ahead matter on a dashboard.
  const next = interviews
    .filter((i) => i.status === 'SCHEDULED' && new Date(i.scheduled_at) >= new Date())
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0]

  const timeline = application.timeline.map((entry, index) => ({
    label: STAGE_LABEL[entry.to_stage],
    date: new Date(entry.created_at).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    status: (index === application.timeline.length - 1 ? 'active' : 'done') as 'active' | 'done',
    detail: entry.reason ?? undefined,
  }))

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-base">{application.program.title}</CardTitle>
            <CardDescription>{application.bootcamp_name}</CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono text-xs font-normal">
            {application.candidate_code}
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={application.stage} />
            {rejected && <Badge variant="outline">Not proceeding</Badge>}
          </div>

          {!rejected && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Your journey</h3>
            <Timeline items={timeline} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next step</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {next ? (
              <>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="size-4 text-primary" />
                  Interview scheduled
                </span>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(next.scheduled_at)}
                  {next.location ? ` · ${next.location}` : ''}
                </p>
                <Link
                  to="/dashboard/interview"
                  className={buttonVariants({ size: 'sm', variant: 'outline' })}
                >
                  Interview details
                </Link>
              </>
            ) : rejected ? (
              <p className="text-sm text-muted-foreground">
                Your application did not proceed this time. You are welcome to apply again for
                the next intake.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing is scheduled right now. We will email you at each stage — keep an eye on
                your inbox.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link
              to="/dashboard/application"
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              <FileText className="size-3.5" />
              My application
            </Link>
            <Link
              to="/dashboard/documents"
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              <GraduationCap className="size-3.5" />
              Documents
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
