import { AlertTriangle, CalendarRange, Loader2, Lock, LockOpen, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/portal-ui'
import { bootcampApi, phaseApi } from '@/features/admin/api'
import {
  AsyncSection,
  BootcampStatusBadge,
  BootcampSwitcher,
  ConfirmDialog,
  NoBootcampSelected,
} from '@/features/admin/components'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { PHASE_LABEL, type BootcampDetail, type Phase, type PhaseType } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The order phases actually run in.
 *
 * Not derived from the API response: the backend returns them in insertion
 * order, which is not guaranteed to be chronological.
 */
const PHASE_ORDER: PhaseType[] = ['REGISTRATION', 'INTERVIEW', 'FORM', 'ONBOARDING']

const PHASE_HINT: Record<PhaseType, string> = {
  REGISTRATION: 'Candidates can submit applications while this is open.',
  INTERVIEW: 'Screening interviews are scheduled and conducted in this window.',
  FORM: 'Shortlisted candidates complete their onboarding details.',
  ONBOARDING: 'Final enrolment and class allocation.',
}

/** `datetime-local` needs `YYYY-MM-DDTHH:mm` in *local* time, not an ISO string. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

/** A phase is genuinely open only if the flag is set and the clock agrees. */
function effectivelyOpen(phase: Phase, now = Date.now()): boolean {
  if (!phase.is_open) return false
  if (phase.opens_at && now < new Date(phase.opens_at).getTime()) return false
  if (phase.deadline_at && now > new Date(phase.deadline_at).getTime()) return false
  return true
}

/**
 * Why a flagged-open phase is nonetheless closed right now — distinct from
 * `effectivelyOpen`'s plain boolean because "hasn't started yet" and "its
 * deadline passed" are different situations an admin needs to tell apart,
 * not one generic "expired" state.
 */
function closedReason(phase: Phase, now = Date.now()): 'not-yet-open' | 'window-passed' | null {
  if (!phase.is_open) return null
  if (phase.opens_at && now < new Date(phase.opens_at).getTime()) return 'not-yet-open'
  if (phase.deadline_at && now > new Date(phase.deadline_at).getTime()) return 'window-passed'
  return null
}

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdminPhasesPage() {
  const { selected, selectedId, refresh } = useBootcamp()

  const { data, error, initialLoading, refetch } = useAsync(
    () => (selectedId ? bootcampApi.detail(selectedId) : Promise.resolve(undefined)),
    [selectedId],
  )

  return (
    <>
      <PageHeader
        title="Phases"
        description={
          selected
            ? `Control when each stage of ${selected.name} opens and closes.`
            : 'Pick an intake to manage its phases.'
        }
        actions={<BootcampSwitcher />}
      />

      {!selectedId ? (
        <NoBootcampSelected icon={ShieldCheck} />
      ) : (
        <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
          {data && (
            <div className="flex flex-col gap-5">
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{data.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {data.application_count} application
                      {data.application_count === 1 ? '' : 's'} received
                    </span>
                  </div>
                  <BootcampStatusBadge status={data.status} />
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                {PHASE_ORDER.map((type) => {
                  const phase = data.phases.find((p) => p.phase === type)
                  return phase ? (
                    <PhaseCard
                      // Keyed on the server's own values so a save (or another
                      // admin's edit) remounts the card with fresh inputs,
                      // rather than syncing form state through an effect.
                      key={`${type}:${phase.opens_at}:${phase.deadline_at}`}
                      bootcamp={data}
                      phase={phase}
                      onChanged={() => {
                        refetch()
                        // The registration gate drives the bootcamp's headline
                        // status, so the switcher's copy has to be refreshed too.
                        if (type === 'REGISTRATION') refresh()
                      }}
                    />
                  ) : null
                })}
              </div>
            </div>
          )}
        </AsyncSection>
      )}
    </>
  )
}

function PhaseCard({
  bootcamp,
  phase,
  onChanged,
}: {
  bootcamp: BootcampDetail
  phase: Phase
  onChanged: () => void
}) {
  // Seeded from the server values; the parent's key remounts this card when
  // those change, so there is no effect keeping the two in step.
  const [opensAt, setOpensAt] = useState(() => toLocalInput(phase.opens_at))
  const [deadlineAt, setDeadlineAt] = useState(() => toLocalInput(phase.deadline_at))
  const [confirmClose, setConfirmClose] = useState(false)

  const dirty =
    opensAt !== toLocalInput(phase.opens_at) || deadlineAt !== toLocalInput(phase.deadline_at)

  const open = effectivelyOpen(phase)
  const reason = closedReason(phase)

  const save = useMutation(async () => {
    // Only the changed keys are sent, so editing the open date cannot clear
    // the deadline. An explicit null is how a date actually gets removed.
    const payload: { opens_at?: string | null; deadline_at?: string | null } = {}
    if (opensAt !== toLocalInput(phase.opens_at)) payload.opens_at = fromLocalInput(opensAt)
    if (deadlineAt !== toLocalInput(phase.deadline_at)) {
      payload.deadline_at = fromLocalInput(deadlineAt)
    }
    return phaseApi.update(bootcamp.id, phase.phase, payload)
  })

  const toggle = useMutation((next: boolean) =>
    phaseApi.setOpen(bootcamp.id, phase.phase, next),
  )

  async function onSave() {
    if (await save.run()) {
      toast.success(`${PHASE_LABEL[phase.phase]} window updated`)
      onChanged()
    }
  }

  async function onToggle(next: boolean) {
    if (await toggle.run(next)) {
      toast.success(`${PHASE_LABEL[phase.phase]} ${next ? 'opened' : 'closed'}`)
      setConfirmClose(false)
      onChanged()
    }
  }

  return (
    <Card className={cn(open && 'border-success/40')}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            {PHASE_LABEL[phase.phase]}
            {open ? (
              <Badge className="bg-success/12 text-success hover:bg-success/12">Open</Badge>
            ) : (
              <Badge variant="outline">Closed</Badge>
            )}
          </CardTitle>
          <CardDescription>{PHASE_HINT[phase.phase]}</CardDescription>
        </div>
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg',
            open ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground',
          )}
        >
          {open ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
        </span>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {reason === 'not-yet-open' && phase.opens_at && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              This phase hasn't opened yet — opens at {formatMoment(phase.opens_at)}.
            </AlertDescription>
          </Alert>
        )}
        {reason === 'window-passed' && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              The flag is on, but the window has passed — this phase is closed to candidates.
              Extend the deadline to reopen it.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${phase.id}-opens`}>Opens</Label>
            <Input
              id={`${phase.id}-opens`}
              type="datetime-local"
              value={opensAt}
              onChange={(event) => setOpensAt(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${phase.id}-deadline`}>Deadline</Label>
            <Input
              id={`${phase.id}-deadline`}
              type="datetime-local"
              value={deadlineAt}
              onChange={(event) => setDeadlineAt(event.target.value)}
            />
          </div>
        </div>

        {(save.error || toggle.error) && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{save.error ?? toggle.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onSave} disabled={!dirty || save.pending}>
            {save.pending && <Loader2 className="size-4 animate-spin" />}
            <CalendarRange className="size-4" />
            Save window
          </Button>

          {phase.is_open ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmClose(true)}
              disabled={toggle.pending}
            >
              <Lock className="size-4" />
              Close phase
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onToggle(true)}
              disabled={toggle.pending}
            >
              {toggle.pending && <Loader2 className="size-4 animate-spin" />}
              <LockOpen className="size-4" />
              Open phase
            </Button>
          )}

          {dirty && (
            <span className="self-center text-xs text-muted-foreground">Unsaved changes</span>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={`Close ${PHASE_LABEL[phase.phase].toLowerCase()}?`}
        description={
          phase.phase === 'REGISTRATION'
            ? 'Candidates will immediately stop being able to apply to this intake, and the bootcamp status moves to Registration closed.'
            : 'This stage will stop accepting activity until it is reopened.'
        }
        confirmLabel="Close phase"
        pending={toggle.pending}
        error={toggle.error}
        onConfirm={() => onToggle(false)}
      />
    </Card>
  )
}
