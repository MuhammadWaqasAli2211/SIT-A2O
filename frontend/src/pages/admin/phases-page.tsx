import { AlertTriangle, CalendarRange, Lock, LockOpen, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/components/shared/portal-ui'
import { PendingLabel } from '@/components/shared/pending-label'
import { bootcampApi, phaseApi } from '@/features/admin/api'
import {
  AsyncSection,
  BootcampSwitcher,
  ConfirmDialog,
  BootcampGate,
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

/** Now, in the same `YYYY-MM-DDTHH:mm` local shape the input wants. */
function nowLocalInput(): string {
  return toLocalInput(new Date().toISOString())
}

/**
 * The four phases are gated by two different rules on the server, and this
 * screen has to tell them apart or it reports the wrong state.
 *
 * REGISTRATION and INTERVIEW are **opt-in**: `assert_phase_open` requires the
 * flag to be set *and* the clock to agree, so an untouched phase is shut.
 *
 * FORM and ONBOARDING are **opt-out**: `assert_phase_accepts` asks only
 * whether somebody has *decided* to shut it — an explicit close that has not
 * been undone, or a deadline that has passed. Every phase row is created with
 * `is_open = false`, so an untouched FORM phase is accepting submissions
 * despite its flag, and this screen used to call that "Manually closed" while
 * candidates were submitting through it.
 *
 * Mirrors bootcamp_service.is_phase_open / phase_closure. Those are the
 * authority; if they change, this changes with them.
 */
const OPT_OUT_PHASES: ReadonlySet<PhaseType> = new Set<PhaseType>(['FORM', 'ONBOARDING'])

type PhaseReason =
  | 'not-yet-open' // opt-in only: flag on, window has not started
  | 'window-passed' // deadline is in the past, whatever the flag says
  | 'never-opened' // opt-in only: nobody has opened it
  | 'manually-closed' // opt-out only: somebody closed it and has not reopened
  | null

interface PhaseState {
  /** Is the server accepting candidate activity for this phase right now? */
  open: boolean
  reason: PhaseReason
}

function phaseState(phase: Phase, now = Date.now()): PhaseState {
  const started = !phase.opens_at || now >= new Date(phase.opens_at).getTime()
  const expired = Boolean(phase.deadline_at && now > new Date(phase.deadline_at).getTime())

  if (OPT_OUT_PHASES.has(phase.phase)) {
    // `closed_at` set and not since reopened is the only "somebody decided"
    // signal; `opens_at` is deliberately not consulted, because the server
    // does not consult it either for these two.
    if (phase.closed_at && !phase.is_open) return { open: false, reason: 'manually-closed' }
    if (expired) return { open: false, reason: 'window-passed' }
    return { open: true, reason: null }
  }

  if (!phase.is_open) return { open: false, reason: 'never-opened' }
  if (!started) return { open: false, reason: 'not-yet-open' }
  if (expired) return { open: false, reason: 'window-passed' }
  return { open: true, reason: null }
}

/**
 * Where the switch sits — the admin's *intent*, which is not always the
 * effective state (a passed deadline shuts a phase whose flag is still on).
 *
 * For an opt-out phase the intent is "has anybody closed this?", not the raw
 * flag: an untouched FORM phase is open by intent as much as by behaviour,
 * and showing that switch off would misreport both.
 */
function switchIntent(phase: Phase): boolean {
  if (OPT_OUT_PHASES.has(phase.phase)) return !(phase.closed_at && !phase.is_open)
  return phase.is_open
}

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function AdminPhasesPage() {
  const { selected, selectedId, loading: bootcampLoading, refresh } = useBootcamp()

  const { data, error, initialLoading, refetch } = useAsync(
    () => (selectedId ? bootcampApi.detail(selectedId) : Promise.resolve(undefined)),
    [selectedId],
  )

  return (
    <>
      <PageHeader
        title="Phases"
        description={
          bootcampLoading
            ? undefined
            : selected
              ? `Control when each stage of ${selected.name} opens and closes.`
              : 'Pick an intake to manage its phases.'
        }
        actions={<BootcampSwitcher />}
      />

      <BootcampGate icon={ShieldCheck}>
        {(_selectedId) => (
          <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
            {data && (
              <div className="flex flex-col gap-5">
                {/* No summary banner above the grid. The intake's name is already
                  in the switcher and the page description, and its application
                  count belongs to the dashboard — repeating both here cost a
                  card's height and pushed the four phase cards into a scroll on
                  a laptop, which is the one thing this screen should not need. */}
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
      </BootcampGate>
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
  /**
   * A phase nobody has given an opening time yet starts with "now" filled in.
   *
   * A real value, not the `placeholder` attribute: `datetime-local` barely
   * renders one and submits nothing at all, so a placeholder could not become
   * the saved value by doing nothing — which is the whole point of the
   * convenience. The admin saves and the phase opens from now; typing over it
   * replaces it with no restriction; a phase that already has a saved opening
   * time shows that instead and never sees this.
   *
   * Computed once at mount rather than per render, so the field does not tick
   * forward under the cursor while somebody is reading it.
   */
  const neverConfigured = phase.opens_at === null
  const [suggestedOpensAt] = useState(nowLocalInput)

  // Seeded from the server values; the parent's key remounts this card when
  // those change, so there is no effect keeping the two in step.
  const [opensAt, setOpensAt] = useState(() =>
    neverConfigured ? suggestedOpensAt : toLocalInput(phase.opens_at),
  )
  const [deadlineAt, setDeadlineAt] = useState(() => toLocalInput(phase.deadline_at))
  const [confirmClose, setConfirmClose] = useState(false)

  // Still showing the untouched suggestion — worth saying so under the field,
  // and the reason "Unsaved changes" stays quiet below: the admin has not
  // changed anything, we filled it in for them.
  const showingSuggestion = neverConfigured && opensAt === suggestedOpensAt

  const dirty =
    opensAt !== toLocalInput(phase.opens_at) || deadlineAt !== toLocalInput(phase.deadline_at)
  const edited = dirty && !showingSuggestion

  const { open, reason } = phaseState(phase)
  const intent = switchIntent(phase)
  const optOut = OPT_OUT_PHASES.has(phase.phase)

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

  const toggle = useMutation((next: boolean) => phaseApi.setOpen(bootcamp.id, phase.phase, next))

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

  // Turning on flips the flag straight away; turning off still goes through
  // the confirm dialog below — `checked` stays true until that's confirmed,
  // since it reads server state directly rather than local optimistic state,
  // so a cancelled confirm leaves the switch exactly where it was.
  function onSwitchChange(next: boolean) {
    if (next) {
      void onToggle(true)
    } else {
      setConfirmClose(true)
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
              The deadline has passed — this phase is closed to candidates. Extend the deadline to
              reopen it.
            </AlertDescription>
          </Alert>
        )}
        {/* An opt-out phase ignores `opens_at` on the server, so a future one
            here would otherwise read as "not started yet" when candidates can
            already submit. Said plainly rather than left to be discovered. */}
        {optOut && open && phase.opens_at && Date.now() < new Date(phase.opens_at).getTime() && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              This phase is already accepting submissions. Its opening date is a note for your own
              planning — only the deadline and closing it by hand actually gate this stage.
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
              className={cn(showingSuggestion && 'text-muted-foreground')}
            />
            {/* Sized by the taller of the two states via the sibling field, so
                showing this line does not make the card grow. */}
            <span
              className={cn('text-xs text-muted-foreground', !showingSuggestion && 'invisible')}
            >
              Suggested — saving opens this phase now.
            </span>
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
            <CalendarRange className="size-4" />
            <PendingLabel idle="Save window" pending="Saving…" isPending={save.pending} />
          </Button>

          {/* The switch is the admin's *intent*, the badge above is the
              effective state, and the two legitimately differ once a deadline
              has passed — hence two different words rather than "Open"/
              "Closed" in both places, which read as a toggle that had failed
              to take.

              The wording splits by gate, because the same switch position
              means different things either side of it. Off on an opt-in phase
              is "nobody opened it", which is why it is shut; off on an opt-out
              phase is "somebody shut it", since not shutting it would have
              left it running. Saying "Manually closed" for both was the bug:
              it claimed an admin had closed a FORM phase nobody had touched,
              while candidates were submitting through it. */}
          <div className="flex items-center gap-2">
            <Switch
              checked={intent}
              onCheckedChange={onSwitchChange}
              disabled={toggle.pending}
              aria-label={intent ? 'Close phase' : 'Open phase'}
            />
            {/* The label carries the in-flight state itself. `reserve` holds
                the width of every string this can show — both resting labels
                and both verbs — so the switch, this text and the Save button
                beside it never move, in any state. */}
            <span className="text-sm text-muted-foreground">
              <PendingLabel
                isPending={toggle.pending}
                idle={
                  optOut
                    ? intent
                      ? 'Open to candidates'
                      : 'Closed by an admin'
                    : intent
                      ? 'Opened'
                      : 'Not opened'
                }
                pending={intent ? 'Closing…' : 'Opening…'}
                reserve={['Open to candidates', 'Closed by an admin', 'Opened', 'Not opened']}
              />
            </span>
          </div>

          {/* `edited`, not `dirty`: a card sitting on its suggested opening
              time is savable, but nobody has changed anything, and announcing
              unsaved changes on four untouched cards at page load would be
              noise that means nothing. */}
          {edited && (
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
        pendingLabel="Closing…"
        pending={toggle.pending}
        error={toggle.error}
        onConfirm={() => onToggle(false)}
      />
    </Card>
  )
}
