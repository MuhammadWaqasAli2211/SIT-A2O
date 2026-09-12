/**
 * One candidate's Agilytics membership status.
 *
 * Their workspace-wide response enumerates leads but reports students as
 * counts, so most rows have no status in the batch the table already
 * fetched. Fetching each one up front would be a request per row — exactly
 * the cost this screen's lazy-fetch discipline exists to avoid — so a row we
 * do not already know about offers a Check affordance and fetches only when
 * asked.
 *
 * The unknown state is left honestly blank rather than guessed at. Everyone
 * in onboarding at provisioning time is in the workspace, but anyone who
 * reached onboarding afterwards is not, and rendering "In workspace" for
 * both would state something we have not checked.
 */

import { Search } from 'lucide-react'
import { useState } from 'react'

import { PendingLabel } from '@/components/shared/pending-label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { agilyticsApi } from '@/features/admin/api'
import { useMutation } from '@/hooks/use-async'
import type { AgilyticsWorkspaceState } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Their member statuses, toned the way the rest of the portal tones state. */
const TONE: Record<string, string> = {
  APPROVED: 'border-success/40 text-success',
  PENDING: 'text-warning-foreground dark:text-warning',
  REJECTED: 'border-destructive/40 text-destructive',
  REVOKED: 'border-destructive/40 text-destructive',
  LEFT: 'text-muted-foreground',
}

export function AgilyticsCell({
  bootcampId,
  email,
  workspace,
}: {
  bootcampId: string
  email: string | null
  workspace: AgilyticsWorkspaceState | undefined
}) {
  const known = email ? workspace?.members[email.trim().toLowerCase()] : undefined
  const [fetched, setFetched] = useState<string | null>(null)

  const check = useMutation(async () => {
    if (!email) return
    const member = await agilyticsApi.memberStatus(bootcampId, email)
    setFetched(member.status ?? 'Unknown')
  })

  if (!workspace?.provisioned) {
    return <span className="text-xs text-muted-foreground">Not provisioned</span>
  }

  const status = known?.status ?? fetched
  if (status) {
    return (
      <Badge variant="outline" className={cn('font-normal', TONE[status] ?? '')}>
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </Badge>
    )
  }

  // A 404 from their side is the real answer "not in this workspace", not a
  // failure worth a red alert — it is how a candidate who reached onboarding
  // after provisioning legitimately looks.
  if (check.error) {
    return <span className="text-xs text-muted-foreground">Not a member</span>
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-xs"
      onClick={() => void check.run()}
      disabled={check.pending || !email}
      aria-label={`Check Agilytics status for ${email ?? 'this candidate'}`}
    >
      <Search className="size-3" />
      <PendingLabel idle="Check" pending="Checking…" isPending={check.pending} />
    </Button>
  )
}
