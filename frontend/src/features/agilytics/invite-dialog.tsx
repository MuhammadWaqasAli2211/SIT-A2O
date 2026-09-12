/**
 * Inviting an intake's cleared candidates into Agilytics.
 *
 * Two things about their API shape this screen has to be honest about, because
 * hiding either produces a UI that quietly lies:
 *
 * 1. `bulk-invite` takes no member list. It covers every pending member of the
 *    workspace and reports one aggregate count. The selection here therefore
 *    chooses whose membership we *confirm and record* afterwards, not who
 *    Agilytics invites — so the confirm step says so rather than implying a
 *    precision the call does not have.
 * 2. There is no add-member endpoint. Anyone who reached onboarding after the
 *    workspace was provisioned is not in it, comes back from the per-member
 *    lookup as absent, and is reported afterwards instead of being silently
 *    counted as invited.
 *
 * Eligibility is having cleared the Physical Interview. Deliberately nothing
 * to do with form or document progress — that is a separate track, and gating
 * the invite on it would hold back candidates Agilytics is ready for.
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

export function AgilyticsInviteDialog({
  open,
  onOpenChange,
  bootcampId,
  bootcampName,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bootcampId: string
  bootcampName?: string
  onInvited: () => void
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
              onInvited()
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
    agilyticsApi.invite(bootcampId, {
      application_ids: chosen.map((r) => r.application_id),
    }),
  )

  async function confirm() {
    const out = await send.run()
    if (!out) return

    // Reported rather than summarised away: "12 invited" would be a lie when
    // four of them are not in the workspace at all.
    const parts = [
      out.confirmed.length > 0 ? `${out.confirmed.length} confirmed` : null,
      out.not_in_workspace.length > 0
        ? `${out.not_in_workspace.length} not in the workspace`
        : null,
      out.check_failed.length > 0 ? `${out.check_failed.length} could not be checked` : null,
    ].filter(Boolean)

    if (out.confirmed.length > 0) toast.success(`Agilytics: ${parts.join(' · ')}`)
    else toast.warning(`Agilytics: ${parts.join(' · ') || 'nothing was confirmed'}`)
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
        <DialogTitle>Invitation to Agilytics</DialogTitle>
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
              HR assessment screen first — invites are staged against its workspace.
            </AlertDescription>
          </Alert>
        ) : rows.length === 0 ? (
          <EmptyState alreadyInvited={list.data.already_invited.length} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {chosen.length} new candidate{chosen.length === 1 ? '' : 's'} to invite
              </span>
              {list.data.already_invited.length > 0 && (
                <Badge variant="outline" className="font-normal">
                  {list.data.already_invited.length} already invited
                </Badge>
              )}
            </div>

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
                Invite {chosen.length} candidate{chosen.length === 1 ? '' : 's'} to Agilytics?
                This stages invitations for every pending member of the workspace — their
                endpoint cannot be narrowed to a selection — and cannot be undone from here.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={send.pending}>
                Back
              </Button>
              <Button onClick={confirm} disabled={send.pending}>
                <CheckCircle2 className="size-4" />
                <PendingLabel
                  idle={`Yes, invite ${chosen.length}`}
                  pending="Inviting…"
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
              Invite {chosen.length > 0 ? chosen.length : ''} to Agilytics
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
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          {row.email}
        </span>
      </label>
    </li>
  )
}

function EmptyState({ alreadyInvited }: { alreadyInvited: number }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Users className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">No new candidates to invite right now</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {alreadyInvited > 0
            ? `All ${alreadyInvited} candidate${alreadyInvited === 1 ? '' : 's'} who have cleared the Physical Interview have already been invited.`
            : 'Candidates appear here once they clear the Physical Interview.'}
        </p>
      </div>
    </div>
  )
}
