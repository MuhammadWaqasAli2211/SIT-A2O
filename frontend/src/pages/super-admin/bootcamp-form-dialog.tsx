/**
 * Create or edit an intake.
 *
 * Creation and editing share this dialog because the fields are nearly the
 * same; the two differences are enforced rather than styled: `bootcamp_number`
 * is create-only (it drives the permanent candidate-code prefix), and `status`
 * is edit-only (a new intake always starts as DRAFT).
 */

import { AlertTriangle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { bootcampApi, programApi } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import {
  BOOTCAMP_STATUS_LABEL,
  type BootcampStatus,
  type BootcampSummary,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUSES = Object.keys(BOOTCAMP_STATUS_LABEL) as BootcampStatus[]

export function BootcampFormDialog({
  open,
  onOpenChange,
  bootcamp,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Null creates a new intake; a value edits that one. */
  bootcamp: BootcampSummary | null
  onSaved: () => void
}) {
  // The body is keyed on what it is editing, so opening the dialog for a
  // different intake remounts it with fresh state instead of syncing every
  // field through an effect. Unmounted while closed, so it also resets.
  if (!open) return null

  return (
    <FormBody
      key={bootcamp?.id ?? 'new'}
      open={open}
      onOpenChange={onOpenChange}
      bootcamp={bootcamp}
      onSaved={onSaved}
    />
  )
}

function FormBody({
  open,
  onOpenChange,
  bootcamp,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bootcamp: BootcampSummary | null
  onSaved: () => void
}) {
  const isEdit = bootcamp !== null

  // Seeded from the target; the parent's key guarantees a remount when it
  // changes, so these initialisers are the only place state is set from props.
  const [number, setNumber] = useState(() =>
    bootcamp ? String(bootcamp.bootcamp_number) : '',
  )
  const [name, setName] = useState(bootcamp?.name ?? '')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState(bootcamp?.starts_at ?? '')
  const [status, setStatus] = useState<BootcampStatus>(bootcamp?.status ?? 'DRAFT')
  const [programIds, setProgramIds] = useState<string[]>([])
  // Guards the one-shot seed below: the detail request resolves after mount,
  // and re-applying it would discard edits made while it was in flight.
  const [seeded, setSeeded] = useState(false)

  const { data: programs, initialLoading: loadingPrograms } = useAsync(
    () => (open ? programApi.listPublic() : Promise.resolve(undefined)),
    [open],
  )

  // Editing needs the current programme set, which the summary row doesn't
  // carry — fetch the detail only when a specific intake is being edited.
  const { data: detail } = useAsync(
    () => (open && bootcamp ? bootcampApi.detail(bootcamp.id) : Promise.resolve(undefined)),
    [open, bootcamp?.id],
  )

  // Derived during render rather than through an effect: the detail arrives
  // once, and `seeded` makes this a one-shot fill instead of a sync loop.
  if (detail && !seeded) {
    setDescription(detail.description ?? '')
    setProgramIds(detail.programs.map((p) => p.id))
    setSeeded(true)
  }

  const save = useMutation(async () => {
    if (isEdit) {
      return bootcampApi.update(bootcamp.id, {
        name,
        description: description || null,
        starts_at: startsAt || null,
        status,
        program_ids: programIds,
      })
    }
    return bootcampApi.create({
      bootcamp_number: Number(number),
      name,
      description: description || null,
      starts_at: startsAt || null,
      program_ids: programIds,
    })
  })

  async function submit() {
    if (await save.run()) {
      toast.success(isEdit ? `Updated ${name}` : `Created ${name}`)
      onOpenChange(false)
      onSaved()
    }
  }

  const numberValid = isEdit || (Number(number) >= 1 && Number(number) <= 99)
  const canSave = name.trim().length >= 3 && numberValid && !save.pending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit bootcamp' : 'New bootcamp'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Change the details of this intake. Its number cannot change — candidate codes already use it.'
              : 'Creating an intake also creates its four phases, all closed. Open registration from the Phases screen once the dates are set.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bc-number">Bootcamp number</Label>
              <Input
                id="bc-number"
                type="number"
                min={1}
                max={99}
                value={number}
                disabled={isEdit}
                onChange={(event) => setNumber(event.target.value)}
                placeholder="7"
              />
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? 'Fixed — candidate codes depend on it.'
                  : 'Drives the candidate code: 7 produces B07-001.'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bc-start">Starts on</Label>
              <Input
                id="bc-start"
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bc-name">Name</Label>
            <Input
              id="bc-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Bootcamp 07 — Autumn 2026"
              maxLength={150}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bc-description">Description</Label>
            <textarea
              id="bc-description"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bc-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => value && setStatus(value as BootcampStatus)}
              >
                <SelectTrigger id="bc-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {BOOTCAMP_STATUS_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Opening or closing registration updates this automatically.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Tracks offered</Label>
            {loadingPrograms ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(programs ?? []).map((program) => {
                  const selected = programIds.includes(program.id)
                  return (
                    <button
                      key={program.id}
                      type="button"
                      onClick={() =>
                        setProgramIds((current) =>
                          selected
                            ? current.filter((id) => id !== program.id)
                            : [...current, program.id],
                        )
                      }
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {program.title}
                    </button>
                  )
                })}
              </div>
            )}
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                A track that applicants already chose cannot be removed.
              </p>
            )}
          </div>

          {save.error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{save.error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            {save.pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create bootcamp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
