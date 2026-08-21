/**
 * The candidate's own interview schedule.
 *
 * Deliberately shows no score. Interview scores are an internal admin signal —
 * the candidate sees the schedule and their stage progression, never the mark.
 * The API returns `score` on this row type; rendering it here would be the bug.
 */

import { CalendarClock, CheckCircle2, Clock, MapPin, Video, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AsyncSection } from '@/features/admin/components'
import { candidateApi } from '@/features/candidate/api'
import { useAsync } from '@/hooks/use-async'
import { INTERVIEW_STATUS_LABEL, type InterviewRow, type InterviewStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<InterviewStatus, string> = {
  SCHEDULED: 'bg-info/12 text-info',
  COMPLETED: 'bg-success/12 text-success',
  CANCELLED: 'bg-muted text-muted-foreground',
  NO_SHOW: 'bg-destructive/12 text-destructive',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CandidateInterviewPage() {
  const { data, error, initialLoading, refetch } = useAsync(
    () => candidateApi.myInterviews(),
    [],
  )

  // The clock is read once at mount rather than on each render: re-reading it
  // is impure, and an interview crossing its start time mid-session should not
  // silently jump between the two lists under the reader.
  const [now] = useState(() => Date.now())

  const { upcoming, past } = useMemo(() => {
    const rows = data ?? []
    const ahead = rows.filter(
      (i) => i.status === 'SCHEDULED' && new Date(i.scheduled_at).getTime() >= now,
    )
    return { upcoming: ahead, past: rows.filter((i) => !ahead.includes(i)) }
  }, [data, now])

  const interviews = data ?? []

  return (
    <>
      <PageHeader
        title="Interview"
        description="Your screening interview schedule and what to bring."
      />

      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refetch}
        skeleton={<Skeleton className="h-64 w-full rounded-xl" />}
      >
        {interviews.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No interview scheduled yet"
            description="Once registration closes, we schedule screening interviews in batches. You will get an email with your slot."
            action={
              <Link
                to="/dashboard"
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
              >
                Back to overview
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-5">
            {upcoming.length > 0 && (
              <>
                <Alert>
                  <CalendarClock className="size-4" />
                  <AlertTitle>You have an interview coming up</AlertTitle>
                  <AlertDescription>
                    Bring your CNIC and your candidate code. Arrive ten minutes early.
                  </AlertDescription>
                </Alert>

                {upcoming.map((interview) => (
                  <InterviewCard key={interview.id} interview={interview} highlight />
                ))}
              </>
            )}

            {past.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-muted-foreground">Earlier</h2>
                {past.map((interview) => (
                  <InterviewCard key={interview.id} interview={interview} />
                ))}
              </div>
            )}
          </div>
        )}
      </AsyncSection>
    </>
  )
}

function InterviewCard({
  interview,
  highlight,
}: {
  interview: InterviewRow
  highlight?: boolean
}) {
  const online = interview.mode === 'ONLINE'

  return (
    <Card className={cn(highlight && 'border-primary/40')}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">{formatDateTime(interview.scheduled_at)}</CardTitle>
          <CardDescription>
            {interview.duration_minutes} minutes · {online ? 'Online' : 'On-site'}
          </CardDescription>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
            STATUS_TONE[interview.status],
          )}
        >
          {INTERVIEW_STATUS_LABEL[interview.status]}
        </span>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {interview.location && (
          <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              {online ? <Video className="size-4" /> : <MapPin className="size-4" />}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-xs text-muted-foreground">
                {online ? 'Meeting link' : 'Where'}
              </span>
              {online ? (
                <a
                  href={interview.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm font-medium text-primary hover:underline"
                >
                  {interview.location}
                </a>
              ) : (
                <span className="text-sm font-medium">{interview.location}</span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="font-mono text-xs font-normal">
            {interview.candidate_code}
          </Badge>
          {interview.batch_label && (
            <Badge variant="outline" className="font-normal">
              {interview.batch_label}
            </Badge>
          )}
        </div>

        {interview.status === 'SCHEDULED' && (
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <Checklist icon={Clock} text="Arrive ten minutes before your slot." />
            <Checklist icon={CheckCircle2} text="Bring your original CNIC." />
            <Checklist icon={CheckCircle2} text="Know your candidate code." />
          </ul>
        )}

        {interview.status === 'NO_SHOW' && (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertDescription>
              You were marked absent for this interview. Contact the admissions team if you
              believe this is wrong.
            </AlertDescription>
          </Alert>
        )}

        {interview.status === 'CANCELLED' && (
          <Alert>
            <XCircle className="size-4" />
            <AlertDescription>
              This slot was cancelled. If a new one is scheduled you will be emailed.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function Checklist({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      {text}
    </li>
  )
}
