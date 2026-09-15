/**
 * The full candidate record, and the place stage changes actually happen.
 *
 * A sheet rather than a route so an admin working a list of 400 can open,
 * act, and close without losing their scroll position or their filters.
 */

import {
  AlertTriangle,
  CalendarClock,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { StageBadge, Timeline } from '@/components/shared/portal-ui'
import { applicationApi } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useAuth } from '@/hooks/use-auth'
import {
  INTERVIEW_STATUS_LABEL,
  STAGE_LABEL,
  STAGE_ORDER,
  UserRole,
  type AdminApplicationDetail,
  type ApplicationStage,
  type InterviewRow,
} from '@/lib/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CandidateSheet({
  applicationId,
  onClose,
  onChanged,
}: {
  applicationId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const { data, error, initialLoading, refetch } = useAsync(
    () =>
      applicationId
        ? Promise.all([
            applicationApi.detail(applicationId),
            applicationApi.interviews(applicationId),
          ])
        : Promise.resolve(undefined),
    [applicationId],
  )

  const [application, interviews] = data ?? []

  return (
    <Sheet open={applicationId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        {initialLoading && (
          <div className="flex flex-col gap-4 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {error && (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription className="flex items-center justify-between gap-3">
                {error}
                <Button size="sm" variant="outline" onClick={refetch}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {application && (
          <Body
            application={application}
            interviews={interviews ?? []}
            onChanged={() => {
              refetch()
              onChanged()
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function Body({
  application,
  interviews,
  onChanged,
}: {
  application: AdminApplicationDetail
  interviews: InterviewRow[]
  onChanged: () => void
}) {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN

  const [target, setTarget] = useState<ApplicationStage>(application.stage)
  const [reason, setReason] = useState('')

  const isClosed = application.status !== 'ACTIVE'

  const move = useMutation(async () => {
    if (isClosed) {
      return applicationApi.reinstate(application.id, target, reason || undefined)
    }
    return applicationApi.advanceStage(application.id, target, reason || undefined)
  })

  async function submit() {
    const done = await move.run()
    if (done) {
      toast.success(
        isClosed
          ? `${application.candidate_code} reinstated at ${STAGE_LABEL[target]}`
          : `${application.candidate_code} moved to ${STAGE_LABEL[target]}`,
      )
      setReason('')
      onChanged()
    }
  }

  const timeline = application.timeline.map((entry, index) => ({
    label: STAGE_LABEL[entry.to_stage],
    date: formatDateTime(entry.created_at),
    status: (index === application.timeline.length - 1 ? 'active' : 'done') as 'active' | 'done',
    detail: entry.reason ?? undefined,
  }))

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {application.full_name ?? 'Candidate'}
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {application.candidate_code}
          </span>
        </SheetTitle>
        <SheetDescription>
          {application.program.title} · {application.bootcamp_name}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 p-6 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={application.stage} />
          {isClosed && <Badge variant="outline">{application.status}</Badge>}
          <Badge variant="outline" className="font-normal">
            Applied {formatDate(application.applied_at)}
          </Badge>
        </div>

        <section className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <Field icon={Mail} value={application.email} />
          {application.phone && <Field icon={Phone} value={application.phone} />}
          {application.city && (
            <Field
              icon={MapPin}
              value={[application.city, application.education].filter(Boolean).join(' · ')}
            />
          )}
        </section>

        {application.statement && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-medium">Statement of purpose</h3>
            <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              {application.statement}
            </p>
          </section>
        )}

        {/* -------------------------------------------------- stage control --
            Super admin only (2026-09-03). This control can put any
            application at any stage, skipping every gate the ordinary flow
            enforces — including the AI interview announcement, which is what
            moves candidates on now. An ADMIN does not need it: announcing
            results and recording a Physical Interview outcome both move
            stages as a consequence of a real decision. The backend refuses
            these two routes for anyone else independently; this only stops
            the click. */}
        {isSuperAdmin && (
        <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {isClosed ? 'Reinstate candidate' : 'Move to another stage'}
            </h3>
            {isClosed && <RotateCcw className="size-4 text-muted-foreground" />}
          </div>

          {isClosed && (
            <p className="text-xs text-muted-foreground">
              This application is {application.status.toLowerCase()}. Reinstating reopens it at
              the stage you choose and makes it active again.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="stage">Stage</Label>
            <Select
              value={target}
              onValueChange={(value) => value && setTarget(value as ApplicationStage)}
            >
              <SelectTrigger id="stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_ORDER.filter(
                  // Reinstating *to* REJECTED is a contradiction the API refuses.
                  (stage) => !(isClosed && stage === 'REJECTED'),
                ).map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {STAGE_LABEL[stage]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Recorded on the candidate's timeline."
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {move.error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{move.error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={submit}
            disabled={move.pending || (!isClosed && target === application.stage)}
          >
            <PendingLabel
              isPending={move.pending}
              idle={isClosed ? 'Reinstate' : `Move to ${STAGE_LABEL[target]}`}
              pending="Moving…"
            />
          </Button>
        </section>
        )}

        {/* ---------------------------------------------------- interviews -- */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Interviews ({interviews.length})</h3>
          {interviews.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No interview scheduled yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {interviews.map((interview) => (
                <li
                  key={interview.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <CalendarClock className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">
                      {formatDateTime(interview.scheduled_at)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {INTERVIEW_STATUS_LABEL[interview.status]}
                      {interview.location ? ` · ${interview.location}` : ''}
                      {interview.interviewer_name ? ` · ${interview.interviewer_name}` : ''}
                    </span>
                  </div>
                  {interview.score !== null && (
                    <Badge variant="outline" className="shrink-0 tabular-nums">
                      {interview.score}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ------------------------------------------------------ timeline -- */}
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium">History</h3>
          <Timeline items={timeline} />
        </section>
      </div>
    </>
  )
}

function Field({
  icon: Icon,
  value,
}: {
  icon: typeof Mail
  value: string
}) {
  return (
    <span className="flex items-center gap-2.5 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </span>
  )
}
