/**
 * Onboarding an intake's cleared candidates into Agilytics.
 *
 * This is not an invitation and the wording throughout is careful not to call
 * it one. Their onboard endpoint makes each selected student an APPROVED
 * member of the workspace in the call itself — no token, no acceptance step,
 * nothing for the candidate to agree to. By the time this dialog closes they
 * are in, and the only thing they have not yet done is log in.
 *
 * Two consequences the screen has to be honest about:
 *
 * 1. **It cannot be undone from here.** There is no remove-member endpoint,
 *    so the confirm step is a real one rather than a formality.
 * 2. **An unmapped track fails silently.** Their API resolves a track name it
 *    does not recognise to no track at all and still reports the student as
 *    onboarded, so a program with no mapping is warned about *before* the
 *    call rather than discovered afterwards as a workspace full of ungrouped
 *    students.
 *
 * Eligibility is having cleared the Physical Interview. Deliberately nothing
 * to do with form or document progress — that is a separate track, and gating
 * on it would hold back candidates Agilytics is ready for.
 */

import { AlertTriangle, CheckCircle2, Send, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppLoader } from '@/components/shared/app-loader'
import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { agilyticsApi } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import type { AgilyticsCandidateRow } from '@/lib/types'
import { cn } from '@/lib/utils'

export function AgilyticsOnboardDialog({
  open,
  onOpenChange,
  bootcampId,
  bootcampName,
  onOnboarded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bootcampId: string
  bootcampName?: string
  onOnboarded: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[46rem] flex-col gap-0 p-0 sm:max-w-2xl">
        {/* Keyed on the intake so switching bootcamps refetches rather than
            showing the previous one's candidates for a frame. */}
        {open && (
          <Body
            key={bootcampId}
            bootcampId={bootcampId}
            bootcampName={bootcampName}
            onDone={() => {
              onOnboarded()
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  bootcampId,
  bootcampName,
  onDone,
  onCancel,
}: {
  bootcampId: string
  bootcampName?: string
  onDone: () => void
  onCancel: () => void
}) {
  const list = useAsync(() => agilyticsApi.eligible(bootcampId), [bootcampId])
  const [confirming, setConfirming] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const rows = list.data?.new ?? []
  const chosen = rows.filter((r) => !excluded.has(r.application_id))

  const send = useMutation(() =>
    agilyticsApi.onboard(bootcampId, {
      application_ids: chosen.map((r) => r.application_id),
    }),
  )

  async function confirm() {
    const out = await send.run()
    if (!out) return

    // Reported rather than summarised away: "12 onboarded" would be a lie
    // when four of them have no account on their side, and the ungrouped
    // count is the only visible trace of a track mapping that matched
    // nothing.
    const done = out.onboarded.length + out.skipped_already_member.length
    const parts = [
      done > 0 ? `${done} onboarded` : null,
      out.skipped_not_found.length > 0
        ? `${out.skipped_not_found.length} have no Agilytics account yet`
        : null,
      out.ungrouped > 0 ? `${out.ungrouped} placed in no track` : null,
      out.email_failed > 0 ? `${out.email_failed} email(s) failed` : null,
    ].filter(Boolean)

    if (done > 0) toast.success(`Agilytics: ${parts.join(' · ')}`)
    else toast.warning(`Agilytics: ${parts.join(' · ') || 'nobody was onboarded'}`)
    onDone()
  }

  const toggle = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-6 py-4">
        <DialogTitle>Onboard to Agilytics</DialogTitle>
        <DialogDescription>
          {bootcampName
            ? `Candidates in ${bootcampName} who have cleared the Physical Interview.`
            : 'Candidates who have cleared the Physical Interview.'}
        </DialogDescription>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {list.initialLoading ? (
          <div className="grid min-h-40 place-items-center">
            <AppLoader size="sm" label="Loading eligible candidates" />
          </div>
        ) : list.error ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{list.error}</AlertDescription>
          </Alert>
        ) : !list.data?.provisioned ? (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              This intake has not been provisioned in Agilytics yet. Provision it from the
              HR assessment screen first — students need an account there before they can
              be made members.
            </AlertDescription>
          </Alert>
        ) : rows.length === 0 ? (
          <EmptyState alreadyOnboarded={list.data.already_onboarded.length} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {chosen.length} candidate{chosen.length === 1 ? '' : 's'} to onboard
              </span>
              {list.data.already_onboarded.length > 0 && (
                <Badge variant="outline" className="font-normal">
                  {list.data.already_onboarded.length} already onboarded
                </Badge>
              )}
            </div>

            {/* Before the call, not after: their API treats an unrecognised
                track name as no track and still reports success, so this is
                the last point at which the gap is visible. */}
            {list.data.unmapped_programs.length > 0 && (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  No Agilytics track is mapped for{' '}
                  <strong>{list.data.unmapped_programs.join(', ')}</strong>. Those candidates
                  will still be onboarded, but placed in no track. Set the mapping on the
                  Programs screen first if that matters.
                </AlertDescription>
              </Alert>
            )}

            <ul className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <CandidateItem
                  key={row.application_id}
                  row={row}
                  included={!excluded.has(row.application_id)}
                  onToggle={() => toggle(row.application_id)}
                />
              ))}
            </ul>
          </div>
        )}

        {send.error && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="size-4" />
            <AlertDescription>{send.error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-6 py-4">
        {confirming ? (
          <>
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Onboard {chosen.length} candidate{chosen.length === 1 ? '' : 's'} to Agilytics?
                They become full members immediately — there is no invitation to accept —
                and each is emailed instructions for their first login. This cannot be
                undone from here.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={send.pending}>
                Back
              </Button>
              <Button onClick={confirm} disabled={send.pending}>
                <CheckCircle2 className="size-4" />
                <PendingLabel
                  idle={`Yes, onboard ${chosen.length}`}
                  pending="Onboarding…"
                  isPending={send.pending}
                />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={chosen.length === 0}>
              <Send className="size-4" />
              Onboard {chosen.length > 0 ? chosen.length : ''} to Agilytics
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

function CandidateItem({
  row,
  included,
  onToggle,
}: {
  row: AgilyticsCandidateRow
  included: boolean
  onToggle: () => void
}) {
  return (
    <li>
      <label
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors',
          included ? 'bg-card hover:border-primary/50' : 'bg-muted/40 opacity-60',
        )}
      >
        <Checkbox
          checked={included}
          onCheckedChange={onToggle}
          aria-label={`Include ${row.candidate_code}`}
        />
        <span className="font-mono text-xs whitespace-nowrap">{row.candidate_code}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {row.full_name ?? '—'}
        </span>
        {/* The track they will actually land in, per row — the aggregate
            warning above says which programs are unmapped, this says which
            candidate that means. */}
        {row.track_name ? (
          <Badge variant="outline" className="hidden font-normal sm:inline-flex">
            {row.track_name}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="hidden font-normal text-muted-foreground sm:inline-flex"
          >
            No track
          </Badge>
        )}
        <span className="hidden truncate text-xs text-muted-foreground md:block">
          {row.email}
        </span>
      </label>
    </li>
  )
}

function EmptyState({ alreadyOnboarded }: { alreadyOnboarded: number }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Users className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">Nobody left to onboard right now</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {alreadyOnboarded > 0
            ? `All ${alreadyOnboarded} candidate${alreadyOnboarded === 1 ? '' : 's'} who have cleared the Physical Interview are already in the workspace.`
            : 'Candidates appear here once they clear the Physical Interview.'}
        </p>
      </div>
    </div>
  )
}
