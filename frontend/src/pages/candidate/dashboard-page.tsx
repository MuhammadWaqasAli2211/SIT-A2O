/**
 * The candidate's landing page, in two states.
 *
 * Which one renders is decided by real data, not a flag: if `/applications/mine`
 * comes back empty the candidate has not applied, and they get the explainer.
 * Otherwise they get the summary, with the tracker one click away.
 */

import { motion } from 'motion/react'
import { ArrowRight, CalendarClock, FileText, Hourglass, Radar, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Countdown } from '@/components/shared/countdown'
import { PageHeader, StageBadge } from '@/components/shared/portal-ui'
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

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  // Only the first load blanks the page; a refetch leaves it on screen.
  if (initialLoading) return <DashboardSkeleton />

  if (error) {
    return (
      <>
        <PageHeader title={`Welcome, ${firstName}`} />
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
        <EmptyDashboard firstName={firstName} openBootcamps={openBootcamps} />
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

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`${application.program.title} · ${application.bootcamp_name}`}
        actions={
          <Button render={<Link to="/dashboard/application" />} variant="outline">
            <FileText className="size-4" />
            View application
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {/* The one thing this page exists to offer. Given the full width and
            the only filled button so it cannot be missed. */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Card className="group relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent transition-shadow duration-300 hover:shadow-lg">
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
        </motion.div>

        {/* ---------------------------------------------------- what next -- */}
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
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
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
          >
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
          </motion.div>
        </div>
      </div>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      </div>
    </>
  )
}
