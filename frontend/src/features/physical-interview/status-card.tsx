/**
 * The candidate's own Physical Interview status — venue, date and time once
 * invited, and the outcome once an admin records one after the in-person
 * round. No internal rejection note ever reaches here: the backend's
 * `CandidatePhysicalInterviewStatus` has no field able to carry it.
 *
 * "Missed" is read the same way the AI interview's "expired" is: derived by
 * the backend at read time from the batch deadline, not a status anyone set.
 */

import { AlertTriangle, CalendarClock, CheckCircle2, MapPin, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/motion/reveal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { candidateApi } from '@/features/candidate/api'
import { useAsync } from '@/hooks/use-async'
import { cn } from '@/lib/utils'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function PhysicalInterviewCard() {
  const { data, initialLoading } = useAsync(() => candidateApi.myPhysicalInterview(), [])

  if (initialLoading) return <Skeleton className="h-40 w-full rounded-xl" />

  // Not yet invited: nothing to show. This card only appears once a
  // candidate has actually cleared the AI Interview and been called in.
  if (!data || data.status === 'not_invited') return null

  if (data.status === 'selected') {
    return (
      <Reveal>
        <Card className="border-success/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-success/12 text-success">
              <CheckCircle2 className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">You cleared the Physical Interview</CardTitle>
              <CardDescription>
                Your onboarding forms are unlocked — head to Student&apos;s Folder to continue.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/documents" className={buttonVariants({ size: 'sm' })}>
              Go to Student&apos;s Folder
            </Link>
          </CardContent>
        </Card>
      </Reveal>
    )
  }

  if (data.status === 'rejected') {
    return (
      <Reveal>
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-warning/12 text-warning">
              <XCircle className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Physical Interview — Not Selected</CardTitle>
              <CardDescription>
                Your application was not selected at the Physical Interview stage.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Reveal>
    )
  }

  if (data.status === 'missed') {
    return (
      <Reveal>
        <Card className="border-destructive/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">You missed your Physical Interview</CardTitle>
              <CardDescription>
                No result was recorded before the window closed. Your application has not been
                rejected — it is held at this stage until an administrator looks at it.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Reveal>
    )
  }

  // status === 'invited'
  return (
    <Reveal>
      <Card className="border-primary/40">
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <CalendarClock className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">You&apos;re invited to a Physical Interview</CardTitle>
            <CardDescription>Bring your CNIC/B-Form and your candidate code.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.venue && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-xs text-muted-foreground">Where</span>
                <span className="text-sm font-medium">{data.venue}</span>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            {data.interview_date && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Date</span>
                <span className="font-medium">{formatDate(data.interview_date)}</span>
              </div>
            )}
            {data.start_time && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Time</span>
                <span className="font-medium">{data.start_time}</span>
              </div>
            )}
          </div>
          {data.deadline_at && (
            <Alert className={cn('mt-1')}>
              <AlertDescription>
                An outcome must be recorded by{' '}
                {new Date(data.deadline_at).toLocaleString(undefined, {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                . If you cannot attend, contact the admissions team beforehand.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Reveal>
  )
}
