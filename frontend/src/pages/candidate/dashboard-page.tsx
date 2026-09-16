/**
 * The candidate's landing page, in two states.
 *
 * Which one renders is decided by real data, not a flag: if `/applications/mine`
 * comes back empty the candidate has not applied, and they get the explainer.
 * Otherwise they get the summary, with the tracker one click away.
 */

import {
  ArrowRight,
  CalendarClock,
  FileText,
  Hourglass,
  ListChecks,
  Radar,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Stagger, StaggerItem } from '@/components/motion/reveal'
import { Countdown } from '@/components/shared/countdown'
import { PageHeader, StageBadge, StatCard } from '@/components/shared/portal-ui'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyDashboard } from '@/features/applications/empty-dashboard'
import { STAGE_GUIDANCE } from '@/features/applications/stage-guidance'
import { useApplication } from '@/features/applications/application-context'
import { useAuth } from '@/hooks/use-auth'
import { completedSteps, isRejected, STAGE_LABEL, TOTAL_STEPS } from '@/lib/stages'

export default function CandidateDashboardPage() {
  const { profile } = useAuth()
  const { application, initialLoading, error, openBootcamps, reload } = useApplication()

  // The whole name, not the first word of it. A name is how someone is
  // addressed; truncating it to "Muhammad" greets a different person.
  const displayName = profile?.full_name?.trim() || 'there'

  // Only the first load blanks the page; a refetch leaves it on screen.
  if (initialLoading) return <DashboardSkeleton />

  if (error) {
    return (
      <>
        <PageHeader title={`Welcome, ${displayName}`} />
        <Alert variant="destructive">
          <AlertTitle>Could not load your dashboard</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
          </AlertAction>
        </Alert>
      </>
    )
  }

  if (!application) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Everything about your bootcamp application lives here."
        />
        <EmptyDashboard displayName={displayName} openBootcamps={openBootcamps} />
      </>
    )
  }

  /* ------------------------------------------------------- applied state -- */

  const stage = application.stage
  const halted = isRejected(stage) || application.status !== 'ACTIVE'
  const guidance = STAGE_GUIDANCE[stage]
  const done = completedSteps(stage) + (halted ? 0 : 1)
  const percent = Math.round((done / TOTAL_STEPS) * 100)

  const deadline = guidance.deadlinePhase
    ? application.phases.find((p) => p.phase === guidance.deadlinePhase)
    : undefined

  // Whole days, rounded up, so "1 day left" means the deadline is still ahead
  // rather than technically 4 hours away. Negative is clamped to 0: a passed
  // deadline is handled by the guidance copy, not by a negative counter.
  const daysLeft = deadline?.deadline_at
    ? Math.max(
        0,
        Math.ceil((new Date(deadline.deadline_at).getTime() - Date.now()) / 86_400_000),
      )
    : null

  return (
    <>
      <PageHeader
        title={
          <>
            Welcome back,{' '}
            {/* The one decorative flourish on this screen. The display face is
                a script — legible at this size for a name and nothing else, so
                it never touches a number, a label, or a control. */}
            <span className="font-display text-2xl font-normal text-primary sm:text-3xl">
              {displayName}
            </span>
          </>
        }
        description={`${application.program.title} · ${application.bootcamp_name}`}
        actions={
          <Button render={<Link to="/dashboard/application" />} variant="outline">
            <FileText className="size-4" />
            View application
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {/* The candidate's own three numbers. Same component and the same
            tone system as the admin grid — a different role's dashboard should
            read as the same product, not as the same content. Deliberately not
            admin figures: a candidate has exactly one application, so counts of
            other people's would be noise. */}
        <Stagger trigger="mount" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StaggerItem>
            <StatCard
              label="Your step"
              value={Math.max(done, 1)}
              suffix={` of ${TOTAL_STEPS}`}
              icon={ListChecks}
              hint={STAGE_LABEL[stage]}
              tone="primary"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Progress"
              value={percent}
              suffix="%"
              icon={TrendingUp}
              hint={halted ? 'On hold' : 'Through the pipeline'}
              tone="info"
            />
          </StaggerItem>
          <StaggerItem>
            {/* Only a real deadline gets a countdown card. A "—" here would
                imply a date exists and we failed to load it. */}
            {daysLeft === null ? (
              <StatCard
                label="Deadline"
                value={0}
                suffix=" set"
                icon={CalendarClock}
                hint="Nothing due from you"
                tone="success"
              />
            ) : (
              <StatCard
                label="Days left"
                value={daysLeft}
                icon={CalendarClock}
                hint={guidance.deadlineLabel ?? 'Until this stage closes'}
                tone={daysLeft <= 3 ? 'warning' : 'success'}
              />
            )}
          </StaggerItem>
        </Stagger>

        {/* The one thing this page exists to offer. Given the full width and
            the only filled button so it cannot be missed.

            Its own Stagger rather than a bare StaggerItem: an item with no
            parent gets no index, falls back to the variant path, and sits at
            opacity 0 forever. */}
        <Stagger trigger="mount">
          <StaggerItem>
            <Card className="group relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/12 via-info/6 to-flow-500/12 transition-shadow duration-300 hover:shadow-lg">
            <div
              aria-hidden="true"
              className="animate-aurora pointer-events-none absolute -top-20 -right-12 size-60 rounded-full bg-primary/15 blur-3xl"
            />
            <CardContent className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-2xl font-semibold tracking-tight">
                    {application.candidate_code}
                  </span>
                  <StageBadge stage={stage} />
                </div>

                <p className="max-w-lg text-sm text-muted-foreground">
                  {guidance.headline}. See the full journey, your timestamps,
                  and what happens next.
                </p>

                <div className="flex max-w-sm flex-col gap-2 pt-1">
                  <Progress value={percent}>
                    <ProgressTrack>
                      <ProgressIndicator />
                    </ProgressTrack>
                  </Progress>
                  <span className="text-xs text-muted-foreground">
                    Step {Math.max(done, 1)} of {TOTAL_STEPS} · {STAGE_LABEL[stage]}
                  </span>
                </div>
              </div>

              <Button
                render={<Link to="/dashboard/track" />}
                size="lg"
                className="shrink-0"
              >
                <Radar className="size-4" />
                Track application
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Button>
            </CardContent>
            </Card>
          </StaggerItem>
        </Stagger>

        {/* ---------------------------------------------------- what next -- */}
        <Stagger
          trigger="mount"
          className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start"
        >
          <StaggerItem>
            <Card className="h-full">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{guidance.headline}</CardTitle>
                  {guidance.waiting && (
                    <Badge variant="outline" className="gap-1.5 text-[0.68rem]">
                      <Hourglass className="size-3" />
                      Nothing needed from you
                    </Badge>
                  )}
                </div>
                <CardDescription>What happens at this stage</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {guidance.body}
                </p>
                {guidance.action && (
                  <Button
                    render={<Link to={guidance.action.to} />}
                    variant="outline"
                    className="w-fit"
                  >
                    {guidance.action.label}
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <CalendarClock className="size-4" />
                  </span>
                  <CardTitle className="text-base">Deadline</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {deadline?.deadline_at ? (
                  <Countdown
                    deadline={deadline.deadline_at}
                    label={guidance.deadlineLabel ?? 'Closes in'}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No deadline applies to you right now. You will be emailed
                    when the next stage opens.
                  </p>
                )}
              </CardContent>
            </Card>
          </StaggerItem>
        </Stagger>
      </div>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="flex flex-col gap-6">
        {/* Mirrors the real layout, stat row included, so the page does not
            visibly re-flow the moment the data lands. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Skeleton className="h-[5.5rem] w-full rounded-xl" />
          <Skeleton className="h-[5.5rem] w-full rounded-xl" />
          <Skeleton className="h-[5.5rem] w-full rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      </div>
    </>
  )
}
