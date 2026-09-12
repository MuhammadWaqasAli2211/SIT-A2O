/**
 * The intake's Agilytics workspace: whether it exists, what is in it, and the
 * two actions that change that.
 *
 * Both actions are deliberate button presses. Provisioning is not idempotent
 * on their side — calling it twice creates two workspaces, and their API
 * exposes no delete — so it happens because an admin decided it should, not
 * because a candidate crossed a stage boundary while nobody was watching.
 * The backend refuses a second provision independently; this only stops the
 * click.
 *
 * The confirm step names the staff whose accounts will be created on their
 * side. That is not decoration: provisioning sends our admins' names and
 * email addresses to a third party, and the person pressing the button
 * should see whose before they do.
 *
 * Intake-scoped only. There is one workspace per intake, so this has nothing
 * coherent to show in the platform-wide view — that page renders the roster
 * without it rather than inventing a cross-intake aggregate.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Send,
  Sparkles,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Reveal } from '@/components/motion/reveal'
import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { agilyticsApi } from '@/features/admin/api'
import { ConfirmDialog } from '@/features/admin/components'
import type { useAsync } from '@/hooks/use-async'
import { useMutation } from '@/hooks/use-async'
import type { AgilyticsProvisionResult, AgilyticsWorkspaceState } from '@/lib/types'

export function AgilyticsStrip({
  bootcampId,
  bootcampName,
  state,
  onSendInvites,
}: {
  bootcampId: string
  bootcampName?: string
  /** Owned by the panel: the per-row Agilytics column reads the same fetch,
   *  and both need to refresh together after a provision. */
  state: ReturnType<typeof useAsync<AgilyticsWorkspaceState | undefined>>
  /** Opens the panel's send dialog, so there is one sending flow rather than
   *  a second one here that would drift from it. */
  onSendInvites: () => void
}) {
  const [confirming, setConfirming] = useState<AgilyticsProvisionResult | null>(null)

  // The preview is only fetched when the admin asks to provision — there is
  // no reason to compute what would be sent on every page load.
  const openConfirm = useMutation(async () => {
    setConfirming(await agilyticsApi.preview(bootcampId))
  })

  const provision = useMutation(async () => {
    const result = await agilyticsApi.provision(bootcampId)
    toast.success(`Workspace created — ${result.students} student(s) provisioned`)
    setConfirming(null)
    state.refetch()
  })

  if (state.initialLoading) return <Skeleton className="h-24 w-full rounded-xl" />
  if (!state.data) return null

  return (
    <>
      <Reveal>
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <WorkspaceSummary state={state.data} />

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!state.data.provisioned ? (
                <Button onClick={() => void openConfirm.run()} disabled={openConfirm.pending}>
                  <Sparkles className="size-4" />
                  <PendingLabel
                    idle="Provision in Agilytics"
                    pending="Provisioning…"
                    isPending={openConfirm.pending}
                  />
                </Button>
              ) : (
                <Button variant="outline" onClick={onSendInvites}>
                  <Send className="size-4" />
                  Send pending invites
                </Button>
              )}
            </div>
          </CardContent>

          {openConfirm.error && (
            <CardContent className="pt-0">
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{openConfirm.error}</AlertDescription>
              </Alert>
            </CardContent>
          )}
        </Card>
      </Reveal>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Provision ${bootcampName ?? 'this intake'} in Agilytics?`}
        confirmLabel="Provision workspace"
        pending={provision.pending}
        error={provision.error}
        onConfirm={() => void provision.run()}
        description={confirming && <ProvisionSummary preview={confirming} />}
      />
    </>
  )
}

function WorkspaceSummary({ state }: { state: AgilyticsWorkspaceState }) {
  if (!state.provisioned) {
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" />
          Not provisioned in Agilytics
        </span>
        <span className="text-xs text-muted-foreground">
          Creates the workspace, its tracks, and everyone currently in onboarding.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="size-4 text-success" />
        {state.workspace_name ?? 'Agilytics workspace'}
        <Badge variant="outline" className="font-normal">
          {state.total_members ?? 0} member{state.total_members === 1 ? '' : 's'}
        </Badge>
        {state.approved !== null && (
          <Badge variant="outline" className="border-success/40 font-normal text-success">
            {state.approved} approved
          </Badge>
        )}
        {state.pending ? (
          <Badge variant="outline" className="font-normal text-warning-foreground dark:text-warning">
            {state.pending} pending
          </Badge>
        ) : null}
      </span>
      <span className="font-mono text-xs text-muted-foreground">{state.workspace_id}</span>
    </div>
  )
}

function ProvisionSummary({ preview }: { preview: AgilyticsProvisionResult }) {
  return (
    <span className="flex flex-col gap-3">
      <span>
        Creates one workspace containing <strong>{preview.students}</strong> student
        {preview.students === 1 ? '' : 's'} across{' '}
        <strong>{preview.tracks.length || 'no'}</strong> track
        {preview.tracks.length === 1 ? '' : 's'}
        {preview.tracks.length > 0 && <> ({preview.tracks.join(', ')})</>}.
      </span>

      {preview.leads > 0 && (
        <span className="rounded-lg border border-border p-3 text-xs">
          <strong>
            {preview.leads} workspace lead{preview.leads === 1 ? '' : 's'}
          </strong>{' '}
          will be created for this intake&apos;s admins. This gives their names and email
          addresses to Agilytics and creates accounts for them there:
          <span className="mt-1 block font-mono">{preview.lead_emails.join(', ')}</span>
        </span>
      )}

      <span className="text-xs text-muted-foreground">
        This cannot be undone from here — Agilytics has no delete endpoint, and provisioning
        again would create a second workspace rather than updating this one.
      </span>
    </span>
  )
}
