/**
 * Sending Agilytics invites, and telling the selected candidates about them.
 *
 * The dialog is explicit about something that would otherwise be a nasty
 * surprise: **the selection does not narrow the Agilytics invite.** Their
 * bulk-invite endpoint takes no member list and covers every PENDING member
 * of the workspace, verified against their live API on 2026-09-05. An admin
 * who ticks three rows and presses send has invited everyone who is pending,
 * and needs to know that before they press it, not after.
 *
 * What the selection does control is our covering email. That exists because
 * their response returns no tokens — only `invitesIssued` and `expiresAt` —
 * so there is no accept URL we could put in a message of our own even if we
 * wanted to write theirs. Ours says the invitation is coming and what it is
 * for; theirs carries the link.
 *
 * The body is editable and merge-field aware, the same composer vocabulary
 * as every other admin-composed email, because the wording of a message to
 * candidates is an admin's call and not something to hardcode.
 */

import { AlertTriangle, Loader2, Send } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { AGILYTICS_MESSAGE_TEMPLATE, MERGE_FIELDS } from '@/features/admin/email-merge-fields'
import type { AgilyticsWorkspaceState, HrAssessmentRow } from '@/lib/types'

export function SendInvitesDialog({
  open,
  onOpenChange,
  selected,
  workspace,
  pending,
  error,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selected: HrAssessmentRow[]
  workspace: AgilyticsWorkspaceState | undefined
  pending: boolean
  error: string | null
  onSend: (payload: { subject: string; body_html: string } | null) => void
}) {
  const [alsoEmail, setAlsoEmail] = useState(true)
  const [subject, setSubject] = useState('Your Agilytics workspace invitation')
  const [body, setBody] = useState(AGILYTICS_MESSAGE_TEMPLATE)

  const emailable = selected.filter((row) => row.email)
  const willEmail = alsoEmail && emailable.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border p-5">
          <DialogTitle>Send Agilytics invites</DialogTitle>
          <DialogDescription>
            Agilytics issues the invitation; the covering email below is ours.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* The thing an admin must not discover afterwards. */}
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              <strong>Agilytics invites every pending member of the workspace</strong>
              {workspace?.pending ? <> — {workspace.pending} right now</> : null}. Their API
              takes no member list, so ticking rows cannot narrow it. Existing unexpired
              invites are reissued rather than duplicated.
            </AlertDescription>
          </Alert>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
            <Checkbox
              checked={alsoEmail}
              onCheckedChange={(next) => setAlsoEmail(next === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Also email the {emailable.length} selected candidate
                {emailable.length === 1 ? '' : 's'} from us
              </span>
              <span className="text-xs text-muted-foreground">
                This is the part your selection controls. Agilytics&apos; own invitation
                carries the activation link; ours tells them it is coming.
              </span>
            </span>
          </label>

          {willEmail && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="agilytics-subject" className="text-sm font-medium">
                  Subject
                </label>
                <Input
                  id="agilytics-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="agilytics-body" className="text-sm font-medium">
                  Message
                </label>
                <textarea
                  id="agilytics-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  Filled per recipient:
                  {MERGE_FIELDS.map((field) => (
                    <Badge key={field} variant="outline" className="font-mono font-normal">
                      {field}
                    </Badge>
                  ))}
                </p>
              </div>

              {emailable.length < selected.length && (
                <p className="text-xs text-warning-foreground dark:text-warning">
                  {selected.length - emailable.length} selected candidate
                  {selected.length - emailable.length === 1 ? ' has' : 's have'} no email
                  address on file and will be skipped.
                </p>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => onSend(willEmail ? { subject, body_html: body } : null)}
            disabled={pending || (willEmail && !subject.trim())}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {willEmail ? `Send invites and email ${emailable.length}` : 'Send invites only'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
