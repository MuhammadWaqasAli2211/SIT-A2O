/**
 * The per-intake "Issue Candidate's ID Card" switch, and the validity dialog
 * that stands in front of it.
 *
 * Reaches only candidates selected at the physical interview — deliberately
 * earlier than onboarding completion, so a card can be in hand long before
 * the forms are. The count beside it says how many that is, because the
 * switch affects a whole intake at once and an admin should see the blast
 * radius before flipping it.
 *
 * Switching on never happens on the click alone: the card prints a validity
 * period, and nobody can be asked for it after the fact. Switching off is
 * immediate and is a genuine undo — the download stops being offered and the
 * route refuses it too. Cards already downloaded keep the dates they were
 * printed with; a PDF in a candidate's hands is a static file.
 */

import { CalendarRange, IdCard } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { idCardApi } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import { cn } from '@/lib/utils'

export function IdCardSwitch({ bootcampId }: { bootcampId: string }) {
  const state = useAsync(() => idCardApi.state(bootcampId), [bootcampId])
  const [asking, setAsking] = useState(false)
  const withdraw = useMutation(() => idCardApi.setIssued(bootcampId, false))

  const issued = state.data?.issued ?? false
  const eligible = state.data?.eligible_count ?? 0

  async function onChange(next: boolean) {
    if (next) {
      // The dates come first. The switch moves only once they are set.
      setAsking(true)
      return
    }
    const result = await withdraw.run()
    if (!result) return
    toast.success('ID cards withdrawn. The download is hidden again.')
    state.refetch()
  }

  // Nothing to show until we know the real state: a switch that renders off
  // and then flips to on reads as the admin having changed something.
  if (state.initialLoading || state.error) return null

  return (
    <>
      <label
        className={cn(
          'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm',
          issued ? 'border-success/40 bg-success/10' : 'border-border bg-muted/40',
        )}
      >
        <IdCard className={cn('size-4', issued ? 'text-success' : 'text-muted-foreground')} />
        <span className="flex flex-col leading-tight">
          <span className="font-medium">Issue Candidate's ID Card</span>
          <span className="text-xs text-muted-foreground">
            {issued && state.data?.valid_from && state.data?.valid_to
              ? `Valid ${formatDate(state.data.valid_from)} – ${formatDate(state.data.valid_to)}`
              : `${eligible} selected candidate${eligible === 1 ? '' : 's'}`}
          </span>
        </span>
        <Switch
          checked={issued}
          onCheckedChange={onChange}
          disabled={withdraw.pending}
          aria-label="Issue candidate ID cards for this intake"
        />
      </label>

      <ValidityDialog
        open={asking}
        onOpenChange={setAsking}
        bootcampId={bootcampId}
        eligible={eligible}
        onIssued={() => {
          setAsking(false)
          state.refetch()
        }}
      />
    </>
  )
}

function ValidityDialog({
  open,
  onOpenChange,
  bootcampId,
  eligible,
  onIssued,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bootcampId: string
  eligible: number
  onIssued: () => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const issue = useMutation(() =>
    idCardApi.setIssued(bootcampId, true, { valid_from: from, valid_to: to }),
  )

  const ordered = Boolean(from && to && to >= from)
  const ready = Boolean(from && to) && ordered

  async function confirm() {
    const result = await issue.run()
    if (!result) return
    toast.success(
      `ID cards issued — ${eligible} candidate${eligible === 1 ? '' : 's'} can download theirs.`,
    )
    onIssued()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col gap-1">
          <DialogTitle>Set the card's validity</DialogTitle>
          <DialogDescription>
            These dates are printed on the back of every card issued now. They cannot be
            added afterwards, so cards are not released until they are set.
          </DialogDescription>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="id-card-from">Valid from</Label>
            <Input
              id="id-card-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="id-card-to">Valid to</Label>
            <Input
              id="id-card-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>

        {/* Only once both are filled: complaining about ordering while the
            second field is still empty is noise, not help. */}
        {from && to && !ordered && (
          <Alert variant="destructive">
            <CalendarRange className="size-4" />
            <AlertDescription>The end date cannot be before the start date.</AlertDescription>
          </Alert>
        )}

        {issue.error && (
          <Alert variant="destructive">
            <CalendarRange className="size-4" />
            <AlertDescription>{issue.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={issue.pending}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!ready || issue.pending}>
            <IdCard className="size-4" />
            <PendingLabel idle="Issue ID cards" pending="Issuing…" isPending={issue.pending} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
