/**
 * Bulk Physical Interview invites: venue, date, day and time filled in by the
 * admin at send time — not pre-set, not per-candidate. One venue/date/time
 * per batch; a candidate's own assigned slot comes from whichever batch they
 * were invited in, so running this dialog again with a different date/venue
 * for a different group is how multiple batches work, not a rigid slot
 * system.
 *
 * Recipients are pulled only from candidates already at the PHYSICAL_INTERVIEW
 * stage — that stage is the eligibility gate, set when an admin advances
 * someone out of the AI Interview screen. Unlike the AI-invite dialog there is
 * no manual-rows tab: a Physical Interview candidate always has an
 * application, and no eligibility gate beyond the stage itself (no CNIC/course
 * check — those already happened to reach this stage).
 */

import {
  CalendarRange,
  Eye,
  FileText,
  MapPin,
  Pencil,
  Send,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/portal-ui'
import { applicationApi, physicalInterviewApi } from '@/features/admin/api'
import { RecordResultDialog } from '@/features/physical-interview/record-result-dialog'
import { ConfirmDialog } from '@/features/admin/components'
import {
  MERGE_FIELDS,
  PHYSICAL_INTERVIEW_MERGE_FIELDS,
  PHYSICAL_INTERVIEW_MESSAGE_TEMPLATE,
} from '@/features/admin/email-merge-fields'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useDebounced } from '@/hooks/use-debounced'
import {
  ApplicationStage,
  type PhysicalInterviewBatch,
  type PhysicalInterviewInviteRow,
  type PhysicalInterviewRowStatus,
} from '@/lib/types'
import { cn } from '@/lib/utils'

// The applicants endpoint caps `limit` at 100 (bootcamps.py's list_applicants).
// Asking for more is a 422 that surfaces as a bare "Some fields are invalid"
// where the candidate list should be.
const PAGE_SIZE = 100
const CONFIRM_THRESHOLD = 25

const ROW_STATUS_LABEL: Record<PhysicalInterviewRowStatus, string> = {
  pending: 'Awaiting result',
  selected: 'Selected',
  rejected: 'Not selected',
  missed: 'Missed',
}

const ROW_STATUS_TONE: Record<PhysicalInterviewRowStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  selected: 'bg-success/12 text-success',
  rejected: 'bg-destructive/12 text-destructive',
  missed: 'bg-warning/15 text-warning-foreground dark:text-warning',
}

export function PhysicalInterviewInviteDialog({
  open,
  onOpenChange,
  bootcampId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bootcampId: string
}) {
  const [tab, setTab] = useState<'send' | 'batches'>('send')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-h-[52rem] flex-col p-0 sm:max-w-4xl">
        <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-6 py-4">
          <DialogTitle>Physical Interview invites</DialogTitle>
          <DialogDescription>
            Invite candidates who have cleared the AI Interview, with a venue, date and time.
          </DialogDescription>
        </div>

        <Tabs value={tab} onValueChange={(v) => v && setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-6 mt-3 w-fit">
            <TabsTrigger value="send">Send invites</TabsTrigger>
            <TabsTrigger value="batches">Batch history</TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <SendPanel
              bootcampId={bootcampId}
              onSent={() => setTab('batches')}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="batches" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <BatchHistory bootcampId={bootcampId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function SendPanel({
  bootcampId,
  onSent,
  onClose,
}: {
  bootcampId: string
  onSent: () => void
  onClose: () => void
}) {
  const [venue, setVenue] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('17:00')
  const [subject, setSubject] = useState('Physical Interview Invitation')
  const [message, setMessage] = useState(PHYSICAL_INTERVIEW_MESSAGE_TEMPLATE)
  const [previewing, setPreviewing] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 300)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  const { data, initialLoading, error } = useAsync(
    () =>
      applicationApi.listForBootcamp(bootcampId, {
        stage: ApplicationStage.PHYSICAL_INTERVIEW,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
      }),
    [bootcampId, debouncedSearch],
  )
  const candidates = useMemo(() => data?.items ?? [], [data])
  const allSelected = candidates.length > 0 && candidates.every((c) => selected.has(c.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) candidates.forEach((c) => next.delete(c.id))
      else candidates.forEach((c) => next.add(c.id))
      return next
    })
  }

  const deadlineIso = useMemo(() => {
    if (!deadlineDate) return undefined
    const at = new Date(`${deadlineDate}T${deadlineTime || '00:00'}`)
    return Number.isNaN(at.getTime()) ? undefined : at.toISOString()
  }, [deadlineDate, deadlineTime])

  const send = useMutation(() =>
    physicalInterviewApi.sendBulk(bootcampId, {
      venue,
      interview_date: interviewDate,
      start_time: startTime || undefined,
      deadline_at: deadlineIso ?? '',
      subject,
      message,
      application_ids: Array.from(selected),
    }),
  )

  const canSend =
    venue.trim().length >= 2 &&
    Boolean(interviewDate) &&
    Boolean(deadlineIso) &&
    subject.trim().length >= 3 &&
    message.trim().length > 0 &&
    selected.size > 0

  async function submit() {
    setConfirming(false)
    const batch = await send.run()
    if (batch) {
      toast.success(`Sent ${batch.invite_count} Physical Interview invite(s)`)
      onSent()
    }
  }

  function onSubmitClick() {
    if (selected.size > CONFIRM_THRESHOLD) setConfirming(true)
    else void submit()
  }

  const previewFields: Record<string, string> = {
    $venue: venue || '(venue)',
    $interview_date: interviewDate || '(date)',
    $interview_day: interviewDate ? new Date(`${interviewDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' }) : '(day)',
    $interview_time: startTime || '(time)',
    $deadline: deadlineIso ? new Date(deadlineIso).toLocaleString() : '(deadline)',
    $candidate_name: 'Ayesha Khan',
    $candidate_code: 'B08-042',
    $program: 'Data Science & AI',
    $bootcamp: 'Bootcamp 8',
    $email: 'ayesha.khan@example.com',
  }
  const rendered = useMemo(
    () => Object.entries(previewFields).reduce((body, [field, v]) => body.split(field).join(v), message),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [message, venue, interviewDate, startTime, deadlineIso],
  )

  function insert(field: string) {
    setMessage((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${field}`)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pi-venue">Venue</Label>
          <Input
            id="pi-venue"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Zaitoon Ashraf IT Park, Room 3"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pi-date">Interview date</Label>
          <Input
            id="pi-date"
            type="date"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pi-time">Start time (optional)</Label>
          <Input id="pi-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pi-subject">Email subject</Label>
          <Input id="pi-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Result-recording deadline</Label>
          <p className="text-xs text-muted-foreground">
            A candidate with no Selected/Rejected result recorded by this time shows as Missed.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
            <Input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="pi-message" className="text-sm font-medium">
            Covering email
          </Label>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewing((p) => !p)}>
              {previewing ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
              {previewing ? 'Edit' : 'Preview'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMessage(PHYSICAL_INTERVIEW_MESSAGE_TEMPLATE)}
            >
              <FileText className="size-3.5" />
              Reset to template
            </Button>
          </div>
        </div>

        {previewing ? (
          <div
            className="rounded-lg border border-border bg-background px-4 py-3 text-sm [&_p]:mb-2 [&_p:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {[...MERGE_FIELDS, ...PHYSICAL_INTERVIEW_MERGE_FIELDS].map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => insert(field)}
                  className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[0.68rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {field}
                </button>
              ))}
            </div>
            <textarea
              id="pi-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={20000}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-sm font-medium">Candidates eligible for Physical Interview</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or code"
            className="w-56"
          />
        </div>

        {initialLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No eligible candidates"
            description="Nobody in this intake is currently at the Physical Interview stage — advance a candidate from their AI Interview result first."
          />
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="hidden sm:table-cell">Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => toggle(c.id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{c.full_name ?? '—'}</span>
                        <span className="text-xs text-muted-foreground">{c.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">{c.candidate_code}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{selected.size} selected</p>
      </div>

      {send.error && (
        <Alert variant="destructive">
          <AlertDescription>{send.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={onSubmitClick} disabled={!canSend || send.pending}>

          <Send className="size-4" />
          <PendingLabel
            isPending={send.pending}
            idle={`Send invite${selected.size === 1 ? '' : 's'}`}
            pending="Sending…"
          />
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Send to ${selected.size} candidates?`}
        description={`This emails ${selected.size} candidates with the venue, date and time above. Double-check before sending — this cannot be recalled.`}
        confirmLabel="Send"
        pending={send.pending}
        error={send.error}
        onConfirm={submit}
      />
    </div>
  )
}

function BatchHistory({ bootcampId }: { bootcampId: string }) {
  const { data, initialLoading, error, refetch } = useAsync(
    () => physicalInterviewApi.listForBootcamp(bootcampId),
    [bootcampId],
  )
  if (initialLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="No batches yet"
        description="Sent Physical Interview batches appear here, each with its own venue, date and per-candidate results."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((batch) => (
        <BatchCard key={batch.id} batch={batch} onChanged={refetch} />
      ))}
    </div>
  )
}

function BatchCard({ batch, onChanged }: { batch: PhysicalInterviewBatch; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const detail = useAsync(() => physicalInterviewApi.detail(batch.id), [batch.id, expanded])

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <MapPin className="size-3.5 text-muted-foreground" />
            {batch.venue}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(`${batch.interview_date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
            {batch.start_time ? ` at ${batch.start_time}` : ''} · {batch.invite_count} invited
          </span>
        </div>
        <Badge variant="outline">{expanded ? 'Hide' : 'Show'} candidates</Badge>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {detail.initialLoading ? (
            <p className="px-4 py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.data?.invites.map((row) => (
                  <InviteRow key={row.id} row={row} onChanged={onChanged} />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}

function InviteRow({ row, onChanged }: { row: PhysicalInterviewInviteRow; onChanged: () => void }) {
  const [recording, setRecording] = useState(false)

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{row.candidate_name ?? '—'}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.candidate_code}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={cn('font-normal', ROW_STATUS_TONE[row.status])}>
          {ROW_STATUS_LABEL[row.status]}
        </Badge>
      </TableCell>
      <TableCell>
        {row.status === 'pending' || row.status === 'missed' ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setRecording(true)}>
            Record result
          </Button>
        ) : null}
      </TableCell>

      {/* The shared dialog, also used by the HR Assessment screen's
          awaiting-decision list — one reject-with-reason flow, not two. */}
      <RecordResultDialog
        target={
          recording
            ? {
                // This table's row calls it `id`; the HR screen's calls it
                // `invite_id`. Same invite either way.
                invite_id: row.id,
                candidate_code: row.candidate_code,
                full_name: row.candidate_name,
              }
            : null
        }
        onClose={() => setRecording(false)}
        onRecorded={() => {
          setRecording(false)
          onChanged()
        }}
      />
    </TableRow>
  )
}
