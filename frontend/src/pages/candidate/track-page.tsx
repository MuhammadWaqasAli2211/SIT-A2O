/**
 * The live application tracker.
 *
 * The stepper here is the same component the empty-state dashboard uses to
 * explain the process — mounted in `real` mode, where it stops sequencing and
 * takes its state from the candidate's actual stage instead.
 */

import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Copy, Hourglass, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'

import { Countdown } from '@/components/shared/countdown'
import { JourneyStepper } from '@/components/shared/journey-stepper'
import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { stageTimestamps, type ApplicationDetail } from '@/features/applications/api'
import {
  STAGE_GUIDANCE,
  TONE_ACCENT,
  TONE_CLASS,
} from '@/features/applications/stage-guidance'
import { useApplication } from '@/features/applications/application-context'
import { completedSteps, isRejected, STAGE_LABEL, TOTAL_STEPS } from '@/lib/stages'
import { cn } from '@/lib/utils'

export default function CandidateTrackPage() {
  const { application, loading, error } = useApplication()

  if (loading) return <TrackSkeleton />

  if (error) {
    return (
      <>
        <PageHeader title="Track application" />
        <EmptyState
          icon={Info}
          title="Could not load your application"
          description={error}
          action={
            <Button render={<Link to="/dashboard" />} variant="outline">
              Back to dashboard
            </Button>
          }
        />
      </>
    )
  }

  // Nothing to track yet, but the page should still earn the visit: the same
  // stepper in demo mode explains what tracking will look like, rather than
  // showing a dead end that reads as a broken feature.
  if (!application) {
    return (
      <>
        <PageHeader
          title="Track application"
          description="You have not registered for a bootcamp yet — here is what the process looks like."
        />

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">The journey, end to end</CardTitle>
                <Badge variant="outline" className="gap-1.5 text-[0.68rem]">
                  <Hourglass className="size-3" />
                  Not started
                </Badge>
              </div>
              <CardDescription>
                Once you register, this page shows your real position instead,
                with your candidate code and the dates you reached each step.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-hidden pt-2 pb-7">
              <JourneyStepper mode="demo" />
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Nothing to track yet</span>
                <span className="text-sm text-muted-foreground">
                  Registering for an open bootcamp is what starts the process
                  and issues your candidate code.
                </span>
              </div>
              <Button render={<Link to="/dashboard" />} variant="outline" className="shrink-0">
                Back to overview
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return <Tracker application={application} />
}

/* --------------------------------------------------------------- tracker -- */

function Tracker({ application }: { application: ApplicationDetail }) {
  const stage = application.stage
  const rejected = isRejected(stage)
  const halted = rejected || application.status !== 'ACTIVE'
  const guidance = STAGE_GUIDANCE[stage]
  const timestamps = stageTimestamps(application.timeline)

  /**
   * A rejected application has no position on the stepper, so the tracker
   * shows the furthest stage actually reached and marks it stopped — "you got
   * to the physical interview" is more use than a blank journey.
   */
  const displayStage = rejected ? lastReachedStage(application) : stage

  const done = completedSteps(displayStage) + (halted ? 0 : 1)
  const percent = Math.round((done / TOTAL_STEPS) * 100)

  const deadline = guidance.deadlinePhase
    ? application.phases.find((p) => p.phase === guidance.deadlinePhase)
    : undefined

  return (
    <>
      <PageHeader
        title="Track application"
        description={`${application.program.title} · ${application.bootcamp_name}`}
        actions={
          <Button render={<Link to="/dashboard" />} variant="outline">
            <ArrowLeft className="size-4" />
            Dashboard
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {/* --------------------------------------------------------- code -- */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
            <div
              aria-hidden="true"
              className="animate-aurora pointer-events-none absolute -top-16 -right-10 size-52 rounded-full bg-primary/15 blur-3xl"
            />
            <CardContent className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
              <CandidateCode code={application.candidate_code} />

              <div className="flex w-full max-w-xs flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{percent}%</span>
                </div>
                <Progress value={percent}>
                  <ProgressTrack>
                    <ProgressIndicator />
                  </ProgressTrack>
                </Progress>
                <span className="text-xs text-muted-foreground">
                  Step {Math.max(done, 1)} of {TOTAL_STEPS} ·{' '}
                  {STAGE_LABEL[stage]}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ------------------------------------------------------ stepper -- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your journey</CardTitle>
            <CardDescription>
              {halted
                ? 'This application is no longer progressing.'
                : 'The highlighted stage is where you are right now.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden pt-2 pb-7">
            <JourneyStepper
              mode="real"
              currentStage={displayStage}
              halted={halted}
              timestamps={timestamps}
            />
          </CardContent>
        </Card>

        {/* ---------------------------------------------------- what next -- */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
        >
          <Card className={cn('border', TONE_CLASS[guidance.tone])}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-semibold',
                    TONE_ACCENT[guidance.tone],
                  )}
                >
                  {STAGE_LABEL[stage]}
                </span>
                {guidance.waiting && (
                  <Badge variant="outline" className="gap-1.5 text-[0.68rem]">
                    <Hourglass className="size-3" />
                    Nothing needed from you
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-1.5 text-base">{guidance.headline}</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {guidance.body}
              </p>

              {(deadline?.deadline_at || guidance.action) && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    {deadline?.deadline_at ? (
                      <Countdown
                        deadline={deadline.deadline_at}
                        label={guidance.deadlineLabel ?? 'Closes in'}
                      />
                    ) : (
                      <span />
                    )}

                    {guidance.action && (
                      <Button render={<Link to={guidance.action.to} />}>
                        {guidance.action.label}
                        <ArrowRight className="size-4" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ------------------------------------------------------- history -- */}
        {application.timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stage history</CardTitle>
              <CardDescription>
                Every change to this application, most recent first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-4">
                {[...application.timeline]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((entry, index) => (
                    <li
                      key={`${entry.to_stage}-${entry.created_at}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
                    >
                      <span
                        className={cn(
                          'size-1.5 shrink-0 translate-y-[-2px] rounded-full',
                          index === 0 ? 'bg-primary' : 'bg-muted-foreground/40',
                        )}
                      />
                      <span className="font-medium">
                        {STAGE_LABEL[entry.to_stage]}
                      </span>
                      <span className="text-muted-foreground">
                        {formatFull(entry.created_at)}
                      </span>
                      {entry.reason && (
                        <span className="w-full pl-4.5 text-xs text-muted-foreground">
                          {entry.reason}
                        </span>
                      )}
                    </li>
                  ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ bits -- */

function CandidateCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Candidate code copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access is denied on insecure origins and in some browsers.
      // The code is on screen either way, so this is not worth an error toast.
      toast.info(`Your candidate code is ${code}`)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-widest text-primary uppercase">
        Your candidate code
      </span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-3xl font-semibold tracking-tight">{code}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={copy}
          aria-label="Copy candidate code"
          className="size-8"
        >
          <Copy className={cn('size-4', copied && 'text-success')} />
        </Button>
      </div>
      <span className="text-sm text-muted-foreground">
        Quote this in every email and bring it to the campus.
      </span>
    </div>
  )
}

function TrackSkeleton() {
  return (
    <>
      <PageHeader title="Track application" />
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    </>
  )
}

/** The furthest stage an application actually reached, ignoring REJECTED. */
function lastReachedStage(application: ApplicationDetail) {
  const reached = application.timeline
    .map((t) => t.to_stage)
    .filter((s) => !isRejected(s))
  return reached.at(-1) ?? 'APPLIED'
}

function formatFull(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
