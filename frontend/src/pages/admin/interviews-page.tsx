import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Mail,
  MoreHorizontal,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { interviewApi } from '@/features/admin/api'
import {
  AsyncSection,
  BootcampSwitcher,
  ConfirmDialog,
  BootcampGate,
  Pagination,
  useConfirm,
} from '@/features/admin/components'
import { BatchScheduleDialog } from '@/pages/admin/batch-schedule-dialog'
import { InterviewInviteDialog } from '@/pages/admin/interview-invite-dialog'
import { PhysicalInterviewInviteDialog } from '@/pages/admin/physical-interview-invite-dialog'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { useDebounced } from '@/hooks/use-debounced'
import { INTERVIEW_STATUS_LABEL, type InterviewRow, type InterviewStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25
const ALL = 'ALL'

const STATUS_TONE: Record<InterviewStatus, string> = {
  SCHEDULED: 'bg-info/12 text-info',
  COMPLETED: 'bg-success/12 text-success',
  CANCELLED: 'bg-muted text-muted-foreground',
  NO_SHOW: 'bg-destructive/12 text-destructive',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminInterviewsPage() {
  const { selected, selectedId, loading: bootcampLoading } = useBootcamp()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [offset, setOffset] = useState(0)
  const [batchOpen, setBatchOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [physicalOpen, setPhysicalOpen] = useState(false)
  const [scoring, setScoring] = useState<InterviewRow | null>(null)

  const debouncedSearch = useDebounced(search, 300)

  const { data, error, initialLoading, refetch } = useAsync(
    () =>
      selectedId
        ? interviewApi.listForBootcamp(selectedId, {
            status: status === ALL ? undefined : (status as InterviewStatus),
            search: debouncedSearch || undefined,
            limit: PAGE_SIZE,
            offset,
          })
        : Promise.resolve(undefined),
    [selectedId, status, debouncedSearch, offset],
  )

  const rows = useMemo(() => data?.items ?? [], [data])

  const cancel = useConfirm<InterviewRow>()
  const remove = useConfirm<InterviewRow>()

  const cancelMutation = useMutation((row: InterviewRow) => interviewApi.cancel(row.id))
  const deleteMutation = useMutation((row: InterviewRow) => interviewApi.remove(row.id))

  async function doCancel() {
    if (!cancel.target) return
    if (await cancelMutation.run(cancel.target)) {
      toast.success(`Interview for ${cancel.target.candidate_code} cancelled`)
      cancel.close()
      refetch()
    }
  }

  async function doDelete() {
    if (!remove.target) return
    if ((await deleteMutation.run(remove.target)) !== undefined) {
      toast.success('Interview deleted')
      remove.close()
      refetch()
    }
  }

  return (
    <>
      <PageHeader
        title="Interviews"
        description={
          bootcampLoading
            ? undefined
            : selected
              ? `Screening schedule for ${selected.name}.`
              : 'Pick an intake to manage its interviews.'
        }
        actions={
          <>
            <BootcampSwitcher />
            <Button variant="outline" onClick={() => setInviteOpen(true)} disabled={!selectedId}>
              <Mail className="size-4" />
              AI interview invites
            </Button>
            {/* Both invite entry points sit together here rather than one
                being stranded on the Candidates screen: an admin sending a
                round of invites is doing one job, and the two rounds differ
                only in which gate they open. */}
            <Button variant="outline" onClick={() => setPhysicalOpen(true)} disabled={!selectedId}>
              <CalendarClock className="size-4" />
              Physical interview invites
            </Button>
            <Button onClick={() => setBatchOpen(true)} disabled={!selectedId}>
              <CalendarPlus className="size-4" />
              Schedule batch
            </Button>
          </>
        }
      />

      <BootcampGate icon={CalendarClock}>
        {(_selectedId) => (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setOffset(0)
                  }}
                  placeholder="Search by candidate name, email, or code"
                  className="pl-9"
                />
              </div>

              <Select
                value={status}
                onValueChange={(value) => {
                  if (!value) return
                  setStatus(value)
                  setOffset(0)
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {(Object.keys(INTERVIEW_STATUS_LABEL) as InterviewStatus[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {INTERVIEW_STATUS_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
              {rows.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title={debouncedSearch || status !== ALL ? 'No matches' : 'No interviews yet'}
                  description={
                    debouncedSearch || status !== ALL
                      ? 'Try a different search or status filter.'
                      : 'Schedule a batch to invite candidates for screening.'
                  }
                  action={
                    !debouncedSearch && status === ALL ? (
                      <Button size="sm" onClick={() => setBatchOpen(true)}>
                        <CalendarPlus className="size-4" />
                        Schedule batch
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Candidate</TableHead>
                            <TableHead>When</TableHead>
                            <TableHead className="hidden lg:table-cell">Where</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden md:table-cell">Score</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {row.candidate_name ?? row.candidate_email}
                                  </span>
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {row.candidate_code}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm whitespace-nowrap">
                                {formatDateTime(row.scheduled_at)}
                                <span className="block text-xs text-muted-foreground">
                                  {row.duration_minutes} min ·{' '}
                                  {row.mode === 'ONLINE' ? 'Online' : 'On-site'}
                                </span>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                <span className="block max-w-48 truncate">
                                  {row.location ?? '—'}
                                </span>
                                {row.batch_label && (
                                  <Badge
                                    variant="outline"
                                    className="mt-1 text-[0.7rem] font-normal"
                                  >
                                    {row.batch_label}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                                    STATUS_TONE[row.status],
                                  )}
                                >
                                  {INTERVIEW_STATUS_LABEL[row.status]}
                                </span>
                              </TableCell>
                              <TableCell className="hidden md:table-cell tabular-nums">
                                {row.score === null ? (
                                  <span className="text-sm text-muted-foreground">—</span>
                                ) : (
                                  <span className="font-medium">{row.score}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Actions for ${row.candidate_code}`}
                                      />
                                    }
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {/* GroupLabel must be inside a Group or Base UI throws. */}
                                    <DropdownMenuGroup>
                                      <DropdownMenuLabel>{row.candidate_code}</DropdownMenuLabel>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setScoring(row)}>
                                      <CalendarClock className="size-4" />
                                      Record outcome
                                    </DropdownMenuItem>
                                    {row.status === 'SCHEDULED' && (
                                      <DropdownMenuItem onClick={() => cancel.ask(row)}>
                                        <XCircle className="size-4" />
                                        Cancel
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => remove.ask(row)}
                                    >
                                      <Trash2 className="size-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {data && (
                <Pagination
                  total={data.total}
                  limit={data.limit}
                  offset={data.offset}
                  onChange={setOffset}
                />
              )}
            </AsyncSection>
          </div>
        )}
      </BootcampGate>

      {selectedId && (
        <BatchScheduleDialog
          open={batchOpen}
          onOpenChange={setBatchOpen}
          bootcampId={selectedId}
          onScheduled={refetch}
        />
      )}

      {selectedId && (
        <InterviewInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          bootcampId={selectedId}
          bootcampName={selected?.name}
        />
      )}

      {selectedId && (
        <PhysicalInterviewInviteDialog
          open={physicalOpen}
          onOpenChange={(next) => {
            setPhysicalOpen(next)
            // Sending a round moves candidates on, which this page's own
            // list reflects — same refresh-on-close the Candidates screen
            // did when the button lived there.
            if (!next) refetch()
          }}
          bootcampId={selectedId}
        />
      )}

      <OutcomeDialog
        interview={scoring}
        onClose={() => setScoring(null)}
        onSaved={() => {
          setScoring(null)
          refetch()
        }}
      />

      <ConfirmDialog
        open={cancel.open}
        onOpenChange={(open) => !open && cancel.close()}
        title="Cancel this interview?"
        description={`The slot for ${cancel.target?.candidate_code} will be marked cancelled. The record stays on the candidate's history.`}
        confirmLabel="Cancel interview"
        pending={cancelMutation.pending}
        error={cancelMutation.error}
        onConfirm={doCancel}
      />

      <ConfirmDialog
        open={remove.open}
        onOpenChange={(open) => !open && remove.close()}
        title="Delete this interview?"
        description="The record is removed entirely, including any score. Cancel it instead if you want to keep the history."
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.pending}
        error={deleteMutation.error}
        onConfirm={doDelete}
      />
    </>
  )
}

/**
 * Records what happened at an interview.
 *
 * Status and score move together because the API refuses a score on anything
 * that is not COMPLETED — offering them separately would invite a 409.
 */
function OutcomeDialog({
  interview,
  onClose,
  onSaved,
}: {
  interview: InterviewRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<InterviewStatus>('COMPLETED')
  const [score, setScore] = useState('')
  const [notes, setNotes] = useState('')

  const save = useMutation(() =>
    interviewApi.update(interview!.id, {
      status,
      score: status === 'COMPLETED' && score !== '' ? Number(score) : null,
      notes: notes || null,
    }),
  )

  async function submit() {
    if (await save.run()) {
      toast.success(`Outcome recorded for ${interview?.candidate_code}`)
      setScore('')
      setNotes('')
      onSaved()
    }
  }

  return (
    <ConfirmDialog
      open={interview !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Record interview outcome"
      confirmLabel="Save outcome"
      pending={save.pending}
      error={save.error}
      onConfirm={submit}
      description={
        <div className="flex flex-col gap-4 pt-2 text-left">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outcome-status">Outcome</Label>
            <Select
              value={status}
              onValueChange={(value) => value && setStatus(value as InterviewStatus)}
            >
              <SelectTrigger id="outcome-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['COMPLETED', 'NO_SHOW', 'CANCELLED', 'SCHEDULED'] as InterviewStatus[]).map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {INTERVIEW_STATUS_LABEL[value]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {status === 'COMPLETED' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="outcome-score">Score (0–100)</Label>
              <Input
                id="outcome-score"
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(event) => setScore(event.target.value)}
                placeholder="Leave blank if not scored"
              />
            </div>
          )}

          {status !== 'COMPLETED' && score !== '' && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                A score can only be kept on a completed interview; it will be cleared.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outcome-notes">Notes</Label>
            <textarea
              id="outcome-notes"
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      }
    />
  )
}
