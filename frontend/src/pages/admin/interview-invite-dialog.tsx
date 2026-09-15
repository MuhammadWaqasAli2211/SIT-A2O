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
  Eye,
  FileText,
  Lightbulb,
  Mail,
  Pencil,
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

import { AppLoader } from '@/components/shared/app-loader'
import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { applicationApi, bootcampApi, interviewInviteApi, type ManualInviteRow } from '@/features/admin/api'
import { ConfirmDialog } from '@/features/admin/components'
import {
  INVITE_MERGE_FIELDS,
  INVITE_MESSAGE_TEMPLATE,
  MERGE_FIELDS,
} from '@/features/admin/email-merge-fields'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useDebounced } from '@/hooks/use-debounced'
import {
  ApplicationStage,
  INVITE_BATCH_STATUS_LABEL,
  INVITE_DIFFICULTY_HINT,
  INVITE_DIFFICULTY_LABEL,
  InviteCategory,
  InviteDifficulty,
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
      {/* The width override carries the `sm:` prefix deliberately: the base
          dialog caps itself with `sm:max-w-sm`, and Tailwind groups every
          `sm:` utility into one media block emitted after the unprefixed
          ones — so a plain `max-w-*` here loses the cascade and silently
          renders at 384px. */}
      <DialogContent className="flex h-[88vh] max-h-[52rem] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {/* ------------------------------------------------ header band -- */}
        <div className="flex items-center gap-3 bg-primary px-6 py-5 text-primary-foreground">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-foreground/15">
            <Send className="size-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg">Bulk Interview Invites</DialogTitle>
            <DialogDescription className="text-primary-foreground/80">
              {bootcampName
                ? `Send AI screening invitations to candidates in ${bootcampName}`
                : 'Send AI screening invitations to multiple candidates at once'}
            </DialogDescription>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => v && setTab(v as 'send' | 'history')}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-6 mt-4 w-[calc(100%-3rem)] shrink-0">
            <TabsTrigger value="send" className="flex-1">
              <Send className="size-3.5" />
              Send invites
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <Clock className="size-3.5" />
              Batch history
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="min-h-0 flex-1">
            <SendPanel
              bootcampId={bootcampId}
              onSent={() => setTab('history')}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="history" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
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
  const [difficulty, setDifficulty] = useState<InviteDifficulty>(
    InviteDifficulty.MEDIUM_TO_HARD,
  )
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('17:00')
  const [message, setMessage] = useState(INVITE_MESSAGE_TEMPLATE)
  const [confirming, setConfirming] = useState(false)

  const [source, setSource] = useState<'candidates' | 'manual'>('candidates')
  const [stage, setStage] = useState<string>(ApplicationStage.APPLIED)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 300)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [manualRows, setManualRows] = useState<ManualInviteRow[]>([])
  const [hideIneligible, setHideIneligible] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  // The intake's own INTERVIEW deadline. Fetched because "defaults to the
  // phase deadline" is not usable information unless the admin can see what
  // that date actually is — otherwise the only way to find out is to leave
  // the dialog and open the Phases screen.
  const { data: bootcamp } = useAsync(() => bootcampApi.detail(bootcampId), [bootcampId])
  const phaseDeadline = useMemo(() => {
    const at = bootcamp?.phases.find((p) => p.phase === 'INTERVIEW')?.deadline_at
    return at ? new Date(at) : null
  }, [bootcamp])

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
    // Only the rows currently on screen: "select all" that silently reached
    // past the filter would be the single most expensive misclick here.
    setSelected((prev) => {
      const next = new Set(prev)
      if (allEligibleSelected) eligibleIds.forEach((id) => next.delete(id))
      else eligibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  // Why rows are locked, counted once instead of left to be discovered one
  // tooltip at a time across a list of a hundred.
  const blocked = useMemo(() => {
    const noCnic = candidates.filter((c) => !c.has_cnic).length
    const notCompleted = candidates.filter((c) => c.has_cnic && !c.course_completed).length
    return { noCnic, notCompleted, total: noCnic + notCompleted }
  }, [candidates])

  const visible = useMemo(
    () => (hideIneligible ? candidates.filter((c) => !ineligibleReason(c)) : candidates),
    [candidates, hideIneligible],
  )

  /** Selected candidates the current filter is hiding. Without this the count
      in the sidebar disagrees with the rows on screen and reads as a bug. */
  const hiddenSelectedCount = useMemo(() => {
    const onScreen = new Set(visible.map((c) => c.id))
    return Array.from(selected).filter((id) => !onScreen.has(id)).length
  }, [selected, visible])

  // Combined only at send time. Two controls because a date alone leaves the
  // candidate assuming midnight, and the backend refuses anything past the
  // intake's own INTERVIEW phase deadline.
  const deadlineIso = useMemo(() => {
    if (!deadlineDate) return undefined
    const at = new Date(`${deadlineDate}T${deadlineTime || '00:00'}`)
    return Number.isNaN(at.getTime()) ? undefined : at.toISOString()
  }, [deadlineDate, deadlineTime])

  const send = useMutation(() =>
    interviewInviteApi.sendBulk(bootcampId, {
      subject,
      batch_name: batchName || undefined,
      personalize,
      question_difficulty: difficulty,
      deadline_at: deadlineIso,
      message: message.trim() || undefined,
      application_ids: Array.from(selected),
      manual_rows: manualRows,
      advance_stage: true,
    }),
  )

  const recipientCount = selected.size + manualRows.length

  async function submit() {
    setConfirming(false)
    const batch = await send.run()
    if (batch) {
      toast.success(`Sending ${batch.total_count} interview invite(s)`, {
        description: 'InterviewerAI sends these in the background — check Batch history for progress.',
      })
      setSelected(new Set())
      setManualRows([])
      onSent()
      return
    }
    // The inline alert lives in the scrolling column while the button that
    // triggered this sits in the sidebar — on a long form the failure can be
    // entirely off screen, so it is also raised where it cannot be missed.
    // Selections are deliberately left intact: the batch was refused whole,
    // and making the admin rebuild it would be its own small disaster.
    toast.error('Invites were not sent', {
      description: send.error ?? 'InterviewerAI refused the batch. Nothing went out.',
    })
  }

  /** Above this, a mis-selected batch is expensive enough to be worth one
      extra click — the project's own notes put a real intake at 125+ in a
      single send, and nothing about an invite is recallable. */
  const CONFIRM_THRESHOLD = 25

  function attemptSend() {
    if (recipientCount >= CONFIRM_THRESHOLD) setConfirming(true)
    else void submit()
  }

  /**
   * Why the send button is off, in the admin's words.
   *
   * A disabled button with no stated reason is the worst state this dialog
   * can be in: everything looks filled in, nothing happens, and there is
   * nowhere to look. Null means it is ready to send.
   */
  const blockedReason = useMemo(() => {
    if (!subject.trim()) return 'Add an email subject to send.'
    if (recipientCount === 0) {
      return blocked.total > 0 && blocked.total === candidates.length
        ? 'No one here can be invited yet — see the note above the list.'
        : 'Pick at least one candidate, or add a row by hand.'
    }
    if (deadlineDate && !deadlineTime) return 'Set a time for the deadline, or clear the date.'
    return null
  }, [subject, recipientCount, deadlineDate, deadlineTime, blocked, candidates.length])

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* ------------------------------------------------- main column -- */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/8 px-4 py-3">
          <span className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
              <Mail className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Reach the right candidates, faster</span>
              <span className="block text-xs text-muted-foreground">
                One send covers the whole batch — InterviewerAI emails each candidate their own link.
              </span>
            </span>
          </span>
          <Badge variant="outline" className="shrink-0 gap-1.5 font-normal">
            <BadgeCheck className="size-3.5" />
            {INVITE_DIFFICULTY_LABEL[difficulty]}
          </Badge>
        </div>

        <SectionHeading step={1} title="What to send" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email subject" htmlFor="invite-subject" required>
            <Input
              id="invite-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. SMIT Interview Invitation"
              maxLength={200}
            />
            <CharCount value={subject.length} max={200} />
          </Field>

          <Field label="Batch name" htmlFor="invite-batch-name" hint="optional">
            <Input
              id="invite-batch-name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g. Spring 2026 Intake"
              maxLength={100}
            />
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs text-muted-foreground">Groups these in Batch history.</p>
              <CharCount value={batchName.length} max={100} />
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Question difficulty" htmlFor="invite-difficulty" required>
            <Select
              value={difficulty}
              onValueChange={(v) => v && setDifficulty(v as InviteDifficulty)}
              items={DIFFICULTY_ITEMS}
            >
              <SelectTrigger id="invite-difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {INVITE_DIFFICULTY_HINT[difficulty]}
            </p>
          </Field>

          <Field label="Interview deadline" htmlFor="invite-deadline-date" hint="optional">
            <div className="flex gap-2">
              <Input
                id="invite-deadline-date"
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                // Bounded in the picker itself rather than only refused by the
                // server after a send is attempted.
                min={toDateInput(new Date())}
                max={phaseDeadline ? toDateInput(phaseDeadline) : undefined}
                className="flex-1"
              />
              <Input
                type="time"
                aria-label="Deadline time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-32"
                disabled={!deadlineDate}
              />
              {deadlineDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Clear deadline"
                  onClick={() => setDeadlineDate('')}
                >
                  <XCircle className="size-4" />
                </Button>
              )}
            </div>
            {deadlineDate ? (
              <p className="text-xs text-muted-foreground">
                Candidates must finish before this. Enforced by us — InterviewerAI has no
                deadline of its own.
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                Using the intake&apos;s phase deadline:
                <strong className="text-foreground">
                  {phaseDeadline ? formatDateTime(phaseDeadline.toISOString()) : 'not set'}
                </strong>
                {phaseDeadline && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeadlineDate(toDateInput(phaseDeadline))
                      setDeadlineTime(toTimeInput(phaseDeadline))
                    }}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    edit
                  </button>
                )}
              </p>
            )}
          </Field>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Personalize each invite</span>
            <span className="block text-xs text-muted-foreground">
              InterviewerAI addresses each candidate by name rather than sending one generic email.
            </span>
          </span>
          {/* shrink-0: without it the description text pushes the switch past
              the border on a narrow column. */}
          <span className="shrink-0">
            <Switch checked={personalize} onCheckedChange={setPersonalize} />
          </span>
        </label>

        <SectionHeading
          step={2}
          title="Who gets this"
          hint={recipientCount > 0 ? `${recipientCount} selected` : undefined}
        />

        {/* No `flex-1 min-h-0` here, deliberately. This column already
            scrolls; letting the tabs flex-grow *and* shrink to zero made
            their content overflow a zero-height box and render on top of the
            covering-email block below it. Natural content height is what a
            scrolling column wants. */}
        <Tabs
          value={source}
          onValueChange={(v) => v && setSource(v as 'candidates' | 'manual')}
        >
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

          <TabsContent value="candidates" className="pt-3">
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

            {/* Counted once, rather than left to be discovered one tooltip at
                a time. A single ineligible row refuses the entire batch on
                InterviewerAI's side, so this is worth stating plainly. */}
            {blocked.total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs">
                <span className="flex items-center gap-1.5 text-warning-foreground dark:text-warning">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {blocked.total} of {candidates.length} can&apos;t be invited
                  {blocked.noCnic > 0 && ` · ${blocked.noCnic} without a CNIC`}
                  {blocked.notCompleted > 0 && ` · ${blocked.notCompleted} course unfinished`}
                </span>
                <button
                  type="button"
                  onClick={() => setHideIneligible((v) => !v)}
                  className="shrink-0 underline underline-offset-2"
                >
                  {hideIneligible ? 'Show them' : 'Hide them'}
                </button>
              </div>
            )}

            {selected.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs">
                <span className="font-medium">
                  {selected.size} selected
                  {hiddenSelectedCount > 0 && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      · {hiddenSelectedCount} not shown by this filter
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="shrink-0 underline underline-offset-2"
                >
                  Clear selection
                </button>
              </div>
            )}

            {initialLoading ? (
              <AppLoader size="sm" />
            ) : error ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={Users}
                title={candidates.length === 0 ? 'No candidates match' : 'None eligible here'}
                description={
                  candidates.length === 0
                    ? 'Try a different stage filter or search term.'
                    : 'Every candidate matching this filter is missing a CNIC or has not finished their prior course.'
                }
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
                    {visible.map((c) => (
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

          <TabsContent value="manual" className="pt-3">
            <ManualRowsEditor rows={manualRows} onChange={setManualRows} />
          </TabsContent>
        </Tabs>

        <SectionHeading step={3} title="Covering email" />

        <MessageComposer
          value={message}
          onChange={setMessage}
          previewing={previewing}
          onTogglePreview={() => setPreviewing((v) => !v)}
          preview={{
            deadline: deadlineIso
              ? formatDateTime(deadlineIso)
              : phaseDeadline
                ? formatDateTime(phaseDeadline.toISOString())
                : 'the date in your invitation email',
            difficulty: INVITE_DIFFICULTY_LABEL[difficulty],
          }}
        />

        {send.error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{send.error}</AlertDescription>
          </Alert>
        )}

        {/* The sidebar carries the actions from `lg` up; below that it is
            hidden, so they sit here instead — stuck to the bottom of this
            column rather than `fixed`, which inside an already-fixed dialog
            would anchor to the viewport and float free of it. */}
        <div className="sticky bottom-0 -mx-6 mt-auto flex flex-col gap-2 border-t border-border bg-popover px-6 py-3 lg:hidden">
          {blockedReason && (
            <p className="text-xs text-muted-foreground">{blockedReason}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={send.pending}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={attemptSend}
              disabled={blockedReason !== null || send.pending}
            >
              <Send className="size-4" />
              <PendingLabel
                isPending={send.pending}
                idle={`Send ${recipientCount > 0 ? recipientCount : ''}`}
                pending="Sending…"
              />
            </Button>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------- sidebar -- */}
      {/* The actions are pinned below rather than sitting at the end of the
          scroll: with the summary and tips stacked above them, Send and
          Cancel were falling below the fold — the one control in this dialog
          that must never need scrolling to reach. */}
      <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-muted/30 lg:flex">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
            <Send className="size-5" />
          </span>
          <h3 className="text-sm font-semibold">Summary</h3>
        </div>

        <dl className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
          <SummaryRow icon={Mail} label="Subject" value={subject.trim() || 'Not set'} />
          <SummaryRow
            icon={BadgeCheck}
            label="Difficulty"
            value={INVITE_DIFFICULTY_LABEL[difficulty]}
          />
          <SummaryRow
            icon={Clock}
            label="Deadline"
            value={
              deadlineDate
                ? `${new Date(`${deadlineDate}T${deadlineTime || '00:00'}`).toLocaleDateString(
                    undefined,
                    { day: '2-digit', month: 'short', year: 'numeric' },
                  )} · ${deadlineTime || '00:00'}`
                : 'Phase deadline'
            }
          />
          <SummaryRow icon={Users} label="Batch name" value={batchName.trim() || 'Not set'} />
          <SummaryRow
            icon={UserPlus}
            label="Recipients"
            value={`${recipientCount} selected`}
            strong={recipientCount > 0}
          />
        </dl>

        <div className="flex flex-col gap-2 rounded-xl bg-info/8 p-3.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <Lightbulb className="size-3.5 text-info" />
            Quick tips
          </span>
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs text-muted-foreground">
            <li>A candidate with no CNIC, or an unfinished prior course, is refused for the whole batch — those rows are locked.</li>
            <li>The deadline is ours to enforce: InterviewerAI never sees it, so the covering email is where candidates learn it.</li>
            <li>Sending runs in the background. Batch history shows per-row failures.</li>
          </ul>
        </div>

        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-muted/30 px-5 py-3">
          {/* A disabled button that does not say why is the worst state this
              dialog can sit in — everything looks filled in and nothing
              happens. */}
          {blockedReason && (
            <p className="text-xs text-muted-foreground">{blockedReason}</p>
          )}
          <Button onClick={attemptSend} disabled={blockedReason !== null || send.pending}>
            <Send className="size-4" />
            <PendingLabel
              isPending={send.pending}
              idle={`Send ${recipientCount > 0 ? recipientCount : ''} invite${
                recipientCount === 1 ? '' : 's'
              }`}
              pending="Sending…"
            />
          </Button>
          <Button variant="outline" onClick={onClose} disabled={send.pending}>
            Cancel
          </Button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Send ${recipientCount} invites?`}
        description={
          <span className="flex flex-col gap-2.5">
            <span>
              This emails {recipientCount} candidates through InterviewerAI and cannot be
              undone — an invite that has gone out cannot be recalled.
            </span>
            <span className="flex flex-col gap-1 rounded-lg border border-border p-2.5 text-xs">
              <span className="flex justify-between gap-3">
                <span>Difficulty</span>
                <strong className="text-foreground">
                  {INVITE_DIFFICULTY_LABEL[difficulty]}
                </strong>
              </span>
              <span className="flex justify-between gap-3">
                <span>Deadline</span>
                <strong className="text-right text-foreground">
                  {deadlineIso
                    ? formatDateTime(deadlineIso)
                    : phaseDeadline
                      ? `${formatDateTime(phaseDeadline.toISOString())} · from the intake`
                      : 'not set'}
                </strong>
              </span>
            </span>
            {manualRows.length > 0 && (
              <span>
                {manualRows.length} manual row{manualRows.length === 1 ? '' : 's'} get
                InterviewerAI&apos;s email only — with no application here, there is nobody
                for the covering email to be addressed to.
              </span>
            )}
          </span>
        }
        confirmLabel={`Send ${recipientCount} invites`}
        pending={send.pending}
        error={send.error}
        onConfirm={() => void submit()}
      />
    </div>
  )
}

/* ------------------------------------------------------ small pieces -- */

const DIFFICULTY_ITEMS = Object.values(InviteDifficulty).map((value) => ({
  value,
  label: INVITE_DIFFICULTY_LABEL[value],
}))

/** Date *and* time. The time half is the point: a candidate told only a date
    assumes they have until midnight. */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** `<input type="date">` wants local YYYY-MM-DD, not an ISO instant — going
    through toISOString() here would shift the date across a timezone. */
function toDateInput(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(
    at.getDate(),
  ).padStart(2, '0')}`
}

function toTimeInput(at: Date): string {
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/** A numbered divider between the three parts of the form. The panel is long
    enough that without them the settings, the recipient list and the email
    body read as one undifferentiated wall. */
function SectionHeading({
  step,
  title,
  hint,
}: {
  step: number
  title: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/12 text-[0.65rem] font-semibold text-primary">
        {step}
      </span>
      <h3 className="shrink-0 text-sm font-semibold">{title}</h3>
      {hint && (
        <Badge variant="outline" className="shrink-0 font-normal">
          {hint}
        </Badge>
      )}
      <span className="h-px min-w-0 flex-1 bg-border" />
    </div>
  )
}

function CharCount({ value, max }: { value: number; max: number }) {
  return (
    <span className="text-right text-[0.68rem] tabular-nums text-muted-foreground">
      {value}/{max}
    </span>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  strong,
}: {
  icon: typeof Mail
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <dt className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right text-xs',
          strong ? 'font-semibold text-foreground' : 'font-medium',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * The covering email we send ourselves, alongside InterviewerAI's own
 * credentials mail — theirs takes a subject and no body, and the deadline is
 * ours to state. Merge fields are the same `$field` vocabulary the Emails
 * screen uses; the backend does the substitution.
 */
function MessageComposer({
  value,
  onChange,
  previewing,
  onTogglePreview,
  preview,
}: {
  value: string
  onChange: (next: string) => void
  previewing: boolean
  onTogglePreview: () => void
  preview: { deadline: string; difficulty: string }
}) {
  function insert(field: string) {
    onChange(`${value}${value.endsWith(' ') || !value ? '' : ' '}${field}`)
  }

  /** The same two passes the backend does, against a sample candidate — an
      admin should not have to send to 125 people to find out what the merge
      fields resolve to. Batch fields use the values actually on the form. */
  const rendered = useMemo(
    () =>
      Object.entries({
        $interview_deadline: preview.deadline,
        $interview_difficulty: preview.difficulty,
        $candidate_name: 'Ayesha Khan',
        $candidate_code: 'B08-042',
        $program: 'Data Science & AI',
        $bootcamp: 'Bootcamp 8',
        $email: 'ayesha.khan@example.com',
      }).reduce((body, [field, v]) => body.split(field).join(v), value),
    [value, preview],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="invite-message" className="text-sm font-medium">
          Covering email
        </Label>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onTogglePreview}>
            {previewing ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
            {previewing ? 'Edit' : 'Preview'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(INVITE_MESSAGE_TEMPLATE)}
          >
            <FileText className="size-3.5" />
            Reset to template
          </Button>
        </div>
      </div>

      {previewing ? (
        <div className="flex flex-col gap-1.5">
          <div
            className="rounded-lg border border-border bg-background px-4 py-3 text-sm [&_p]:mb-2 [&_p:last-child]:mb-0"
            // The admin's own markup, rendered for their own review before
            // they send it. It never leaves this dialog unrendered, and the
            // same body is sanitised nowhere else today — worth knowing if
            // untrusted authors are ever given this screen.
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
          <p className="text-xs text-muted-foreground">
            Sample values shown. Each candidate gets their own name, code and program.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {[...MERGE_FIELDS, ...INVITE_MERGE_FIELDS].map((field) => (
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
            id="invite-message"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            maxLength={20000}
            placeholder="Leave empty to send no covering email — InterviewerAI's own invite still goes out."
            className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              HTML. Sent only to candidates with an application here — manual rows get
              InterviewerAI&apos;s email alone.
            </p>
            <CharCount value={value.length} max={20000} />
          </div>
        </>
      )}
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
    return <AppLoader size="sm" />
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
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border px-3.5 py-3">
          {detailQuery.initialLoading ? (
            <AppLoader size="sm" />
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="flex flex-wrap items-baseline gap-x-1.5">
        {/* The label and its hint wrap as a group rather than fighting each
            other for one flex line — a long hint used to squeeze the label
            itself onto two lines. */}
        <span>
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          )}
        </span>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
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
