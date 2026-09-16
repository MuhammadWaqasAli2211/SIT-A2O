/**
 * Sending an HOD a ZIP of candidates' onboarding records.
 *
 * Two tabs over one fetch. "All candidates" is everyone whose paperwork is
 * finished; "Not yet sent" is the same rows with no `exported_at`. They are
 * filtered from a single response rather than fetched separately, so the two
 * cannot disagree about who exists — and re-sending somebody already sent is
 * deliberately allowed, which is the only reason the first tab exists.
 *
 * Eligibility is every required document approved, not merely "forms filled":
 * an HOD should not receive a folder an admin has not finished reviewing.
 *
 * The send returns immediately. Building the archive takes minutes at
 * realistic sizes, so the server answers 202 and does the work in the
 * background — this dialog closes on the acknowledgement, not on completion,
 * and says so rather than implying the email has already gone.
 */

import { AlertTriangle, CheckCircle2, Mail, Send, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { AppLoader } from '@/components/shared/app-loader'
import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { documentExportApi } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import type { DocumentExportCandidate } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Matches the backend's EmailStr well enough to catch a typo in the modal
 *  rather than in a background task nobody is watching. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function DocumentExportDialog({
  open,
  onOpenChange,
  bootcampId,
  bootcampName,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bootcampId: string
  bootcampName?: string
  onSent: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[86vh] max-h-[52rem] flex-col gap-0 p-0 sm:max-w-3xl">
        {/* Keyed on the intake so switching bootcamps refetches rather than
            showing the previous one's candidates for a frame. */}
        {open && (
          <Body
            key={bootcampId}
            bootcampId={bootcampId}
            bootcampName={bootcampName}
            onDone={() => {
              onSent()
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
  const list = useAsync(() => documentExportApi.eligible(bootcampId), [bootcampId])
  const [tab, setTab] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [recipient, setRecipient] = useState('')
  const [senderName, setSenderName] = useState('')
  const [confirming, setConfirming] = useState(false)

  const all = useMemo(() => list.data?.candidates ?? [], [list.data])
  const unsent = useMemo(() => all.filter((c) => !c.exported_at), [all])
  const visible = tab === 'unsent' ? unsent : all

  const send = useMutation(() =>
    documentExportApi.send(bootcampId, {
      application_ids: [...selected],
      recipient_email: recipient.trim(),
      sender_name: senderName.trim(),
    }),
  )

  // Only what is on screen: a selection hidden behind the other tab must not
  // be sent invisibly, and the count on the button has to mean what it says.
  const chosen = useMemo(
    () => visible.filter((c) => selected.has(c.application_id)),
    [visible, selected],
  )
  const allVisibleSelected = visible.length > 0 && chosen.length === visible.length

  const emailValid = EMAIL.test(recipient.trim())
  const nameValid = senderName.trim().length >= 2
  const ready = chosen.length > 0 && emailValid && nameValid

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visible.forEach((c) => next.delete(c.application_id))
      else visible.forEach((c) => next.add(c.application_id))
      return next
    })
  }

  async function confirm() {
    const out = await send.run()
    if (!out) return
    toast.success(out.message)
    onDone()
  }

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-6 py-4">
        <DialogTitle>Export documents</DialogTitle>
        <DialogDescription>
          {bootcampName
            ? `Send a ZIP of candidate records from ${bootcampName} to a head of department.`
            : 'Send a ZIP of candidate records to a head of department.'}
        </DialogDescription>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {list.initialLoading ? (
          <div className="grid min-h-40 place-items-center">
            <AppLoader size="sm" label="Loading candidates" />
          </div>
        ) : list.error ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{list.error}</AlertDescription>
          </Alert>
        ) : all.length === 0 ? (
          <EmptyState />
        ) : (
          <Tabs value={tab} onValueChange={(next) => next && setTab(next)}>
            <TabsList>
              <TabsTrigger value="all">All candidates ({all.length})</TabsTrigger>
              <TabsTrigger value="unsent">Not yet sent ({unsent.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={tab}>
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all candidates in view"
                      disabled={visible.length === 0}
                    />
                    Select all
                  </label>
                  <span className="text-sm text-muted-foreground">
                    {chosen.length} selected
                  </span>
                </div>

                {visible.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Every eligible candidate has already been sent.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {visible.map((candidate) => (
                      <CandidateItem
                        key={candidate.application_id}
                        candidate={candidate}
                        checked={selected.has(candidate.application_id)}
                        onToggle={() => toggle(candidate.application_id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>
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
                Send documents for {chosen.length} candidate
                {chosen.length === 1 ? '' : 's'} to <strong>{recipient.trim()}</strong>? The
                download link works for 24 hours and does not require them to log in, so
                treat it as the documents themselves.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={send.pending}
              >
                Back
              </Button>
              <Button onClick={confirm} disabled={send.pending}>
                <CheckCircle2 className="size-4" />
                <PendingLabel
                  idle={`Yes, send ${chosen.length}`}
                  pending="Queueing…"
                  isPending={send.pending}
                />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-recipient">Recipient email</Label>
                <Input
                  id="export-recipient"
                  type="email"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="thewaqasali59@gmail.com"
                />
                <span
                  className={cn(
                    'text-xs text-destructive',
                    (emailValid || recipient.trim() === '') && 'invisible',
                  )}
                >
                  That does not look like an email address.
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-sender">Your name</Label>
                <Input
                  id="export-sender"
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  placeholder="e.g. Adeel Ahmed Satti"
                />
                {/* Says where it lands, because it is not the From address —
                    Gmail sends as the configured mailbox either way. */}
                <span className="text-xs text-muted-foreground">
                  Shown in the email as the sender and sign-off.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => setConfirming(true)} disabled={!ready}>
                <Send className="size-4" />
                Export {chosen.length > 0 ? chosen.length : ''} to HOD
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function CandidateItem({
  candidate,
  checked,
  onToggle,
}: {
  candidate: DocumentExportCandidate
  checked: boolean
  onToggle: () => void
}) {
  return (
    <li>
      <label
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors',
          checked ? 'bg-card hover:border-primary/50' : 'bg-muted/40',
        )}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`Include ${candidate.candidate_code}`}
        />
        <span className="font-mono text-xs whitespace-nowrap">{candidate.candidate_code}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {candidate.full_name ?? '—'}
        </span>
        <Badge variant="outline" className="hidden font-normal sm:inline-flex">
          {candidate.documents_approved} approved
        </Badge>
        {/* Shown on both tabs, not just the first: on "All candidates" it is
            what tells an admin they are about to re-send. */}
        {candidate.exported_at ? (
          <Badge variant="outline" className="border-success/40 whitespace-nowrap text-success">
            Sent {new Date(candidate.exported_at).toLocaleDateString()}
          </Badge>
        ) : (
          <Badge variant="outline" className="whitespace-nowrap text-muted-foreground">
            Not sent
          </Badge>
        )}
      </label>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Users className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">Nobody is ready to export yet</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          A candidate appears here once all four onboarding forms are in and every required
          document has been approved.
        </p>
      </div>
    </div>
  )
}

/** Kept beside the dialog so the button and what it opens stay together. */
export function DocumentExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      <Mail className="size-4" />
      Export documents
    </Button>
  )
}
