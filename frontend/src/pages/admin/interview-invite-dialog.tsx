/**
 * Bulk AI interview invites, sent through InterviewerAI.
 *
 * This is not the batch-schedule tool: there is no time or location here,
 * because InterviewerAI conducts the interview itself once a candidate is
 * invited — this dialog only gets them there. Recipients are pulled from the
 * bootcamp's own applicant list by default; the "Add manually" tab exists for
 * anyone with no application at all, such as an Instructor.
 */

import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/shared/portal-ui'
import { applicationApi, interviewInviteApi, type ManualInviteRow } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useDebounced } from '@/hooks/use-debounced'
import {
  ApplicationStage,
  INVITE_BATCH_STATUS_LABEL,
  InviteCategory,
  STAGE_LABEL,
  type ApplicantRow,
  type InviteBatch,
  type InviteBatchDetail,
  type InviteBatchStatus,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 100
const ALL = 'ALL'

const BATCH_STATUS_TONE: Record<InviteBatchStatus, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  SENDING: 'bg-info/12 text-info',
  COMPLETED: 'bg-success/12 text-success',
  FAILED: 'bg-destructive/12 text-destructive',
}

/** Matches the backend's own eligibility gates in interview_invite_service.py —
    a candidate missing either is refused by InterviewerAI for the whole batch,
    not just their own row, so this stops the admin from selecting them at all. */
function ineligibleReason(candidate: ApplicantRow): string | null {
  if (!candidate.has_cnic) return 'No CNIC on file — cannot be invited'
  if (!candidate.course_completed) return 'Prior course not yet completed — cannot be invited'
  return null
}

export function InterviewInviteDialog({
  open,
  onOpenChange,
  bootcampId,
  bootcampName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bootcampId: string
  bootcampName?: string
}) {
  const [tab, setTab] = useState<'send' | 'history'>('send')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Mail className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle>AI Interview Invites</DialogTitle>
              <DialogDescription>
                Admin Hub · {bootcampName ? `Screen candidates for ${bootcampName}` : 'Send interview invitations via InterviewerAI'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => v && setTab(v as 'send' | 'history')} className="min-h-0 flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="send" className="flex-1">
              <Send className="size-3.5" />
              Send invites
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <Clock className="size-3.5" />
              Batch history
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="min-h-0">
            <SendPanel
              bootcampId={bootcampId}
              onSent={() => setTab('history')}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="history" className="min-h-0 overflow-y-auto">
            <HistoryPanel bootcampId={bootcampId} active={open && tab === 'history'} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------ send tab -- */

function SendPanel({
  bootcampId,
  onSent,
  onClose,
}: {
  bootcampId: string
  onSent: () => void
  onClose: () => void
}) {
  const [subject, setSubject] = useState('Interview Invitation')
  const [batchName, setBatchName] = useState('')
  const [personalize, setPersonalize] = useState(true)

  const [source, setSource] = useState<'candidates' | 'manual'>('candidates')
  const [stage, setStage] = useState<string>(ApplicationStage.APPLIED)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 300)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [manualRows, setManualRows] = useState<ManualInviteRow[]>([])

  const { data, initialLoading, error } = useAsync(
    () =>
      applicationApi.listForBootcamp(bootcampId, {
        stage: stage === ALL ? undefined : (stage as ApplicationStage),
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      }),
    [bootcampId, stage, debouncedSearch],
  )
  const candidates = useMemo(() => data?.items ?? [], [data])

  function toggle(id: string, eligible: boolean) {
    if (!eligible) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const eligibleIds = useMemo(
    () => candidates.filter((c) => !ineligibleReason(c)).map((c) => c.id),
    [candidates],
  )
  const allEligibleSelected =
    eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id))

  function toggleAll() {
    setSelected(allEligibleSelected ? new Set() : new Set(eligibleIds))
  }

  const send = useMutation(() =>
    interviewInviteApi.sendBulk(bootcampId, {
      subject,
      batch_name: batchName || undefined,
      personalize,
      application_ids: Array.from(selected),
      manual_rows: manualRows,
      advance_stage: true,
    }),
  )

  const recipientCount = selected.size + manualRows.length

  async function submit() {
    const batch = await send.run()
    if (batch) {
      toast.success(`Sending ${batch.total_count} interview invite(s)`, {
        description: 'InterviewerAI sends these in the background — check Batch history for progress.',
      })
      setSelected(new Set())
      setManualRows([])
      onSent()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 py-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email subject" htmlFor="invite-subject" required>
          <Input
            id="invite-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. SMIT Interview Invitation"
            maxLength={200}
          />
        </Field>

        <Field
          label="Batch name"
          htmlFor="invite-batch-name"
          hint="optional — groups these under one label in Batch history"
        >
          <Input
            id="invite-batch-name"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g. Spring 2026 Intake"
            maxLength={100}
          />
        </Field>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Personalize each invite</span>
          <span className="block text-xs text-muted-foreground">
            InterviewerAI addresses each candidate by name rather than sending one generic email.
          </span>
        </span>
        <Switch checked={personalize} onCheckedChange={setPersonalize} />
      </label>

      <Tabs value={source} onValueChange={(v) => v && setSource(v as 'candidates' | 'manual')} className="min-h-0 flex-1">
        <TabsList>
          <TabsTrigger value="candidates">
            <Users className="size-3.5" />
            From this intake
          </TabsTrigger>
          <TabsTrigger value="manual">
            <UserPlus className="size-3.5" />
            Add manually {manualRows.length > 0 && `(${manualRows.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="min-h-0">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, or code"
                  className="pl-9"
                />
              </div>
              <Select value={stage} onValueChange={(v) => v && setStage(v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All stages</SelectItem>
                  {Object.values(ApplicationStage).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {initialLoading ? (
              <div className="grid place-items-center py-10 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : candidates.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No candidates match"
                description="Try a different stage filter or search term."
              />
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-9">
                        <RowCheckbox checked={allEligibleSelected} onChange={toggleAll} />
                      </TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => (
                      <CandidateRow
                        key={c.id}
                        candidate={c}
                        checked={selected.has(c.id)}
                        onToggle={() => toggle(c.id, !ineligibleReason(c))}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="manual" className="min-h-0">
          <ManualRowsEditor rows={manualRows} onChange={setManualRows} />
        </TabsContent>
      </Tabs>

      {send.error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{send.error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter className="mt-auto items-center gap-3 sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Recipients: <strong className="text-foreground">{recipientCount}</strong>
          {' · '}
          Sending runs in the background — the page won&apos;t freeze.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={send.pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={recipientCount === 0 || !subject.trim() || send.pending}>
            {send.pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send {recipientCount > 0 ? recipientCount : ''} invite{recipientCount === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogFooter>
    </div>
  )
}

function CandidateRow({
  candidate,
  checked,
  onToggle,
}: {
  candidate: ApplicantRow
  checked: boolean
  onToggle: () => void
}) {
  const reason = ineligibleReason(candidate)
  const disabled = reason !== null
  return (
    <TableRow
      className={cn(!disabled && 'cursor-pointer', disabled && 'opacity-50')}
      onClick={disabled ? undefined : onToggle}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        {reason ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="grid size-4 place-items-center">
                  <AlertTriangle className="size-3.5 text-warning" />
                </span>
              }
            />
            <TooltipContent>{reason}</TooltipContent>
          </Tooltip>
        ) : (
          <RowCheckbox checked={checked} onChange={onToggle} />
        )}
      </TableCell>
      <TableCell>
        <span className="block font-medium">{candidate.full_name ?? candidate.email}</span>
        <span className="block text-xs text-muted-foreground">
          {candidate.candidate_code} · {candidate.email}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{candidate.program_title}</TableCell>
      <TableCell>
        <Badge variant="outline" className="font-normal">
          {STAGE_LABEL[candidate.stage]}
        </Badge>
      </TableCell>
    </TableRow>
  )
}

function ManualRowsEditor({
  rows,
  onChange,
}: {
  rows: ManualInviteRow[]
  onChange: (rows: ManualInviteRow[]) => void
}) {
  const [draft, setDraft] = useState<ManualInviteRow>({
    full_name: '',
    email: '',
    cnic: '',
    category: InviteCategory.INSTRUCTOR,
  })

  const canAdd = draft.full_name.trim() && draft.email.trim() && draft.cnic.trim()

  function add() {
    if (!canAdd) return
    onChange([...rows, draft])
    setDraft({ full_name: '', email: '', cnic: '', category: InviteCategory.INSTRUCTOR })
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        For anyone with no application in this system — an Instructor, most often.
      </p>

      <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
        <Input
          value={draft.full_name}
          onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
          placeholder="Full name"
        />
        <Input
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          placeholder="Email"
          type="email"
        />
        <Input
          value={draft.cnic}
          onChange={(e) => setDraft({ ...draft, cnic: e.target.value })}
          placeholder="CNIC (42101-1234567-1)"
        />
        <Select
          value={draft.category}
          onValueChange={(v) => v && setDraft({ ...draft, category: v as InviteCategory })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(InviteCategory).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          className="sm:col-span-2"
          onClick={add}
          disabled={!canAdd}
        >
          <Plus className="size-4" />
          Add to list
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
          <Table>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.email}-${i}`}>
                  <TableCell>
                    <span className="block font-medium">{row.full_name}</span>
                    <span className="block text-xs text-muted-foreground">{row.email}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.category}</TableCell>
                  <TableCell className="w-9">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => remove(i)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------- history tab -- */

function HistoryPanel({ bootcampId, active }: { bootcampId: string; active: boolean }) {
  const { data, initialLoading, error, refetch } = useAsync(
    () => (active ? interviewInviteApi.listForBootcamp(bootcampId) : Promise.resolve(undefined)),
    [bootcampId, active],
  )
  const batches = data ?? []
  const [expanded, setExpanded] = useState<string | null>(null)

  if (initialLoading) {
    return (
      <div className="grid place-items-center py-10 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  if (batches.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No invites sent yet"
        description="Batches you send from the Send invites tab will show up here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {batches.map((batch) => (
        <BatchRow
          key={batch.id}
          batch={batch}
          expanded={expanded === batch.id}
          onToggle={() => setExpanded(expanded === batch.id ? null : batch.id)}
          onRefreshed={refetch}
        />
      ))}
    </div>
  )
}

function BatchRow({
  batch,
  expanded,
  onToggle,
  onRefreshed,
}: {
  batch: InviteBatch
  expanded: boolean
  onToggle: () => void
  onRefreshed: () => void
}) {
  const refresh = useMutation(() => interviewInviteApi.refresh(batch.id))
  const detailQuery = useAsync(
    () => (expanded ? interviewInviteApi.detail(batch.id) : Promise.resolve(undefined)),
    [batch.id, expanded],
  )

  async function doRefresh(e: React.MouseEvent) {
    e.stopPropagation()
    const updated = await refresh.run()
    if (updated) {
      toast.success('Batch status refreshed')
      onRefreshed()
    }
  }

  return (
    <div className="rounded-xl border border-border">
      {/* A <div role="button">, not a <button>: the Refresh control below is
          a real button, and HTML forbids nesting one interactive element
          inside another — a <button> inside a <button> gets silently
          reparented by the browser's parser, breaking both click targets. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left"
      >
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{batch.batch_name || batch.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {batch.subject} · {new Date(batch.created_at).toLocaleString(undefined, {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <Badge variant="outline" className={cn('font-normal', BATCH_STATUS_TONE[batch.status])}>
          {INVITE_BATCH_STATUS_LABEL[batch.status]}
        </Badge>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {batch.sent_count}/{batch.total_count} sent
          {batch.failed_count > 0 && `, ${batch.failed_count} failed`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={doRefresh}
          disabled={refresh.pending}
        >
          {refresh.pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border px-3.5 py-3">
          {detailQuery.initialLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex flex-col gap-1.5">
              {(detailQuery.data as InviteBatchDetail | undefined)?.invites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-2 text-sm">
                  <StatusIcon status={invite.status} />
                  <span className="min-w-0 flex-1 truncate">{invite.full_name}</span>
                  <span className="truncate text-xs text-muted-foreground">{invite.email}</span>
                  {invite.error && (
                    <Tooltip>
                      <TooltipTrigger
                        render={<AlertTriangle className="size-3.5 shrink-0 text-destructive" />}
                      />
                      <TooltipContent>{invite.error}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: 'PENDING' | 'SENT' | 'FAILED' }) {
  if (status === 'SENT') return <CheckCircle2 className="size-3.5 shrink-0 text-success" />
  if (status === 'FAILED') return <XCircle className="size-3.5 shrink-0 text-destructive" />
  return <Clock className="size-3.5 shrink-0 text-muted-foreground" />
}

/* --------------------------------------------------------------- bits -- */

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
        {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
    </div>
  )
}

/** No shadcn Checkbox exists in this project yet. */
function RowCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'grid size-4 place-items-center rounded border transition-colors',
        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
      )}
    >
      {checked && <BadgeCheck className="size-3" />}
    </button>
  )
}
