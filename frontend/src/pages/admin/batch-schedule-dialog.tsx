/**
 * Batch interview scheduling.
 *
 * The workflow this exists for: 300 applicants are split into sittings of
 * 50/50/25, each candidate given a slot a fixed interval after the last. Doing
 * that one form at a time is the thing admins actually complain about.
 *
 * The API call is all-or-nothing, so a clash anywhere rolls the whole batch
 * back rather than leaving an admin guessing which half was booked.
 */

import { AlertTriangle, CalendarPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { applicationApi, interviewApi } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import { ApplicationStage, STAGE_LABEL, type InterviewMode } from '@/lib/types'

/** Candidates worth inviting: those who have applied but not yet been booked. */
const ELIGIBLE_STAGE: ApplicationStage = ApplicationStage.APPLIED
const MAX_BATCH = 200

export function BatchScheduleDialog({
  open,
  onOpenChange,
  bootcampId,
  onScheduled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bootcampId: string
  onScheduled: () => void
}) {
  const [size, setSize] = useState('50')
  const [startAt, setStartAt] = useState('')
  const [gap, setGap] = useState('15')
  const [duration, setDuration] = useState('30')
  const [mode, setMode] = useState<InterviewMode>('ONSITE')
  const [location, setLocation] = useState('')
  const [label, setLabel] = useState('')

  // Only fetched while the dialog is open, so opening the Interviews page does
  // not pull a candidate list nobody asked for.
  const { data, initialLoading, error } = useAsync(
    () =>
      open
        ? applicationApi.listForBootcamp(bootcampId, {
            stage: ELIGIBLE_STAGE,
            limit: MAX_BATCH,
            offset: 0,
          })
        : Promise.resolve(undefined),
    [open, bootcampId],
  )

  const eligible = useMemo(() => data?.items ?? [], [data])
  const batchSize = Math.min(Number(size) || 0, eligible.length)

  /** Slots run back-to-back from the start time, `gap` minutes apart. */
  const slots = useMemo(() => {
    if (!startAt || batchSize === 0) return []
    const begin = new Date(startAt).getTime()
    const step = (Number(gap) || 0) * 60_000

    return eligible.slice(0, batchSize).map((row, index) => ({
      application_id: row.id,
      scheduled_at: new Date(begin + index * step).toISOString(),
      candidate: row,
    }))
  }, [startAt, batchSize, gap, eligible])

  const schedule = useMutation(() =>
    interviewApi.bulkSchedule(bootcampId, {
      slots: slots.map(({ application_id, scheduled_at }) => ({ application_id, scheduled_at })),
      duration_minutes: Number(duration) || 30,
      mode,
      location: location || null,
      batch_label: label || null,
      advance_stage: true,
    }),
  )

  async function submit() {
    const created = await schedule.run()
    if (created) {
      toast.success(`Scheduled ${created.length} interviews`)
      onOpenChange(false)
      onScheduled()
    }
  }

  const last = slots.at(-1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule an interview batch</DialogTitle>
          <DialogDescription>
            Books a slot for each candidate still at “{STAGE_LABEL[ELIGIBLE_STAGE]}”, spaced
            evenly from your start time, and moves them to Interview scheduled.
          </DialogDescription>
        </DialogHeader>

        {initialLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : eligible.length === 0 ? (
          <Alert>
            <Users className="size-4" />
            <AlertDescription>
              No candidates are waiting to be scheduled. Everyone who applied has already been
              booked or moved on.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-4">
            <Badge variant="outline" className="w-fit gap-1.5 font-normal">
              <Users className="size-3.5" />
              {eligible.length} candidate{eligible.length === 1 ? '' : 's'} waiting
            </Badge>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Batch size" htmlFor="batch-size">
                <Input
                  id="batch-size"
                  type="number"
                  min={1}
                  max={eligible.length}
                  value={size}
                  onChange={(event) => setSize(event.target.value)}
                />
              </Field>

              <Field label="Batch label" htmlFor="batch-label">
                <Input
                  id="batch-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Batch 1"
                  maxLength={60}
                />
              </Field>

              <Field label="First slot starts" htmlFor="batch-start">
                <Input
                  id="batch-start"
                  type="datetime-local"
                  value={startAt}
                  onChange={(event) => setStartAt(event.target.value)}
                />
              </Field>

              <Field label="Minutes between slots" htmlFor="batch-gap">
                <Input
                  id="batch-gap"
                  type="number"
                  min={0}
                  max={480}
                  value={gap}
                  onChange={(event) => setGap(event.target.value)}
                />
              </Field>

              <Field label="Slot length (min)" htmlFor="batch-duration">
                <Input
                  id="batch-duration"
                  type="number"
                  min={5}
                  max={480}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </Field>

              <Field label="Mode" htmlFor="batch-mode">
                <Select
                  value={mode}
                  onValueChange={(value) => value && setMode(value as InterviewMode)}
                >
                  <SelectTrigger id="batch-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONSITE">On-site</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              label={mode === 'ONLINE' ? 'Meeting link' : 'Room or campus'}
              htmlFor="batch-location"
            >
              <Input
                id="batch-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={
                  mode === 'ONLINE' ? 'https://meet.example.com/...' : 'Bahadurabad Campus, Room 204'
                }
              />
            </Field>

            {slots.length > 0 && last && (
              <Alert>
                <CalendarPlus className="size-4" />
                <AlertDescription>
                  {slots.length} slot{slots.length === 1 ? '' : 's'}, from{' '}
                  <strong>{new Date(slots[0]!.scheduled_at).toLocaleString()}</strong> to{' '}
                  <strong>{new Date(last.scheduled_at).toLocaleString()}</strong>.
                </AlertDescription>
              </Alert>
            )}

            {schedule.error && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{schedule.error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={schedule.pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={slots.length === 0 || schedule.pending}>
            <PendingLabel
              isPending={schedule.pending}
              idle={`Schedule ${slots.length > 0 ? slots.length : ''} interview${
                slots.length === 1 ? '' : 's'
              }`}
              pending="Scheduling…"
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
