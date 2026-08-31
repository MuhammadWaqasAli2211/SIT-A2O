/**
 * The admin's view of one AI interview.
 *
 * Rebuilt 2026-08-29, restructured again 2026-08-31. The first rebuild fixed
 * *what* was fetched and *when* — score leads, the breakdown is scannable
 * rows, evidence sits behind its own tab that does not fetch until opened.
 * This pass fixes the *container*: a single scrolling column read as
 * unfinished once stage-decision buttons were added and then moved back out
 * to the table, leaving a cramped dialog holding more than a tab strip could
 * hold gracefully. It is now a large two-pane modal — a left rail of named
 * sections, a right pane showing whichever one is selected — the same shape
 * as any settings-style surface, built from the same tokens and motion
 * primitives as everything else.
 *
 * The fetch discipline from the first rebuild is unchanged: the breakdown
 * comes from one report fetch made when the modal opens, and evidence
 * (recording + snapshots) still does not fetch until that section is
 * actually selected — switching rail sections must never be an excuse to
 * fetch everything at once.
 */

import { AlertTriangle, Camera, FileText, Gauge, ListChecks, ShieldCheck, Trash2, Video } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Counter } from '@/components/motion/counter'
import { EmptyState } from '@/components/shared/portal-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { aiInterviewApi } from '@/features/admin/api'
import { ConfirmDialog } from '@/features/admin/components'
import {
  AI_PASS_THRESHOLD,
  candidateCode,
  candidateName,
  formatWhen,
  list,
  mediaUrl,
  recordId,
  score,
  status,
  text,
  timestamp,
} from '@/features/ai-interview/records'
import { useAiPermissions } from '@/features/ai-interview/use-permissions'
import { LiveIndicator } from '@/features/live/live-indicator'
import { useAsync, useMutation } from '@/hooks/use-async'
import { AiScope, type ExternalRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

type SectionId = 'summary' | 'breakdown' | 'evidence'

const SECTIONS: { id: SectionId; label: string; description: string; icon: typeof Gauge }[] = [
  {
    id: 'summary',
    label: 'Score & Summary',
    description: 'Where this candidate landed, at a glance.',
    icon: Gauge,
  },
  {
    id: 'breakdown',
    label: 'Question Breakdown',
    description: 'Every question in the interview, scored individually.',
    icon: ListChecks,
  },
  {
    id: 'evidence',
    label: 'Evidence',
    description: 'Recording and proctoring snapshots, fetched only once opened.',
    icon: ShieldCheck,
  },
]

/**
 * The dialog wrapper around `ReportView`. Pulled out so every list that opens
 * a report — the Results tab, the Completed Interviews table — shares one
 * dialog rather than each defining its own.
 */
export function EvidenceDialog({
  record,
  onClose,
  onChanged,
}: {
  record: ExternalRecord | null
  onClose: () => void
  /** The underlying list should refresh — the interview was deleted. */
  onChanged: () => void
}) {
  const id = record ? recordId(record) : null

  return (
    <Dialog open={record !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          // The base dialog's width cap is `sm:max-w-sm` — overriding it needs
          // the same `sm:` variant, not a plain `max-w-*`. Tailwind groups every
          // `sm:` utility into one shared media-query block placed after the
          // unprefixed ones in the generated stylesheet, so an unprefixed
          // override loses the cascade at this exact breakpoint even though it
          // looks like it should win. (Confirmed against the compiled CSS: the
          // previous version of this dialog used a plain `max-w-3xl` here and
          // was actually stuck at 384px wide on every screen ≥640px — the real
          // reason it read as cramped, not just an internal layout issue.)
          record !== null && id !== null && 'h-[85vh] max-h-[46rem] w-full sm:max-w-4xl',
        )}
      >
        {record !== null && id !== null && (
          <ReportView interviewId={id} record={record} onClose={onClose} onChanged={onChanged} />
        )}
        {record !== null && id === null && (
          <div className="p-6">
            <DialogHeader>
              <DialogTitle>{candidateName(record)}</DialogTitle>
              <DialogDescription>This interview cannot be opened.</DialogDescription>
            </DialogHeader>
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                This record arrived without an id, so its report cannot be fetched.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ReportView({
  interviewId,
  record,
  onClose,
  onChanged,
}: {
  interviewId: number
  record: ExternalRecord
  onClose: () => void
  onChanged: () => void
}) {
  const [active, setActive] = useState<SectionId>('summary')
  const report = useAsync(() => aiInterviewApi.report(interviewId), [interviewId])

  // A completed interview's report does not change on its own — there is no
  // reason to poll a third-party endpoint on a timer for it — so this is a
  // single fetch, timestamped once it lands, rather than the live-polling
  // contract screens with genuinely moving data use.
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  useEffect(() => {
    if (!report.initialLoading && !report.error) setFetchedAt(new Date())
  }, [report.initialLoading, report.error])

  // The list row already carries a score; the report may carry a better one.
  // Preferring the report means the headline agrees with the breakdown
  // beneath it rather than quietly disagreeing by a point.
  const overall = (report.data ? score(report.data) : null) ?? score(record)
  const questions = report.data ? list(report.data, 'questions', 'answers', 'items') : []

  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]!

  function move(delta: 1 | -1) {
    const index = SECTIONS.findIndex((s) => s.id === active)
    const next = SECTIONS[(index + delta + SECTIONS.length) % SECTIONS.length]!
    setActive(next.id)
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* ------------------------------------------------------- left rail -- */}
      <div className="hidden w-56 shrink-0 flex-col gap-4 border-r border-border bg-muted/30 p-4 sm:flex">
        <div className="flex min-w-0 flex-col gap-0.5 px-2">
          <span className="truncate text-sm font-semibold">{candidateName(record)}</span>
          {candidateCode(record) && (
            <span className="font-mono text-xs text-muted-foreground">
              {candidateCode(record)}
            </span>
          )}
        </div>

        <nav
          className="flex flex-col gap-1"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              move(1)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              move(-1)
            }
          }}
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-current={s.id === active}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                s.id === active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <s.icon className="size-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ------------------------------------------------------ right pane -- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>{section.label}</DialogTitle>
            <DialogDescription>{section.description}</DialogDescription>
          </div>
          <LiveIndicator lastUpdated={fetchedAt} live={false} className="mt-1 shrink-0" />
        </div>

        {/* The rail is hidden below `sm`; this is the only way to switch
            sections on a narrow screen. */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2 sm:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-current={s.id === active}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                s.id === active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <s.icon className="size-3.5" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {active === 'summary' && (
            <Summary record={record} overall={overall} loading={report.initialLoading} />
          )}
          {active === 'breakdown' && (
            <Breakdown loading={report.initialLoading} error={report.error} questions={questions} />
          )}
          {/* Mounted only when selected, so the recording and snapshot calls
              are never made for a review that only wanted the score. */}
          {active === 'evidence' && <Evidence interviewId={interviewId} />}
        </div>

        <Footer interviewId={interviewId} onClose={onClose} onChanged={onChanged} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- summary -- */

function Summary({
  record,
  overall,
  loading,
}: {
  record: ExternalRecord
  overall: number | null
  loading: boolean
}) {
  const state = status(record)
  const passed = overall === null ? null : overall >= AI_PASS_THRESHOLD

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border p-8 text-center">
        <span className="text-xs text-muted-foreground">Overall score</span>
        {loading ? (
          <Skeleton className="h-14 w-32" />
        ) : overall === null ? (
          <span className="text-2xl font-semibold text-muted-foreground">Not scored</span>
        ) : (
          <div className="flex items-end gap-1.5">
            <Counter
              to={overall}
              decimals={Number.isInteger(overall) ? 0 : 1}
              className="text-5xl font-semibold tracking-tight text-primary tabular-nums"
            />
            <span className="pb-1.5 text-base text-muted-foreground">/ 100</span>
          </div>
        )}
        {overall !== null && <Bar value={overall} className="w-56" />}
        {passed !== null && (
          <Badge
            variant="outline"
            className={cn(
              'font-normal',
              passed ? 'bg-success/12 text-success' : 'bg-warning/12 text-warning',
            )}
          >
            {passed ? 'Above pass mark' : 'Below pass mark'}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryField label="Candidate code" value={candidateCode(record) ?? '—'} mono />
        <SummaryField
          label="Status"
          value={state ? state.replace(/_/g, ' ') : '—'}
          className="capitalize"
        />
        <SummaryField label="Completed" value={formatWhen(timestamp(record))} />
      </div>
    </div>
  )
}

function SummaryField({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium', mono && 'font-mono', className)}>{value}</span>
    </div>
  )
}

function Bar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ----------------------------------------------------------- breakdown -- */

function Breakdown({
  loading,
  error,
  questions,
}: {
  loading: boolean
  error: string | null
  questions: ExternalRecord[]
}) {
  if (loading) return <Skeleton className="h-40 w-full rounded-lg" />
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  if (questions.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No breakdown returned"
        description="This interview came back without a per-question report."
      />
    )
  }

  return (
    <ol className="flex flex-col gap-2">
      {questions.map((q, index) => (
        <QuestionRow key={index} question={q} index={index} />
      ))}
    </ol>
  )
}

function QuestionRow({ question, index }: { question: ExternalRecord; index: number }) {
  const [open, setOpen] = useState(false)
  const value = score(question)
  const answer = text(question, 'answer', 'response', 'transcript')
  const prompt = text(question, 'question', 'prompt', 'title') ?? `Question ${index + 1}`

  return (
    <li className="rounded-lg border border-border">
      {/* The whole row toggles: scanning ten questions means reading ten
          prompts and ten scores, not ten answers. The answer is one click
          away for the ones worth reading. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-medium tabular-nums">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium">{prompt}</span>
        {value !== null && (
          <span className="flex shrink-0 items-center gap-2">
            <Bar value={value} className="w-16" />
            <span className="w-8 text-right text-sm font-semibold tabular-nums">{value}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-border px-3 py-2.5 text-sm text-muted-foreground">
          {answer ?? 'No answer was recorded for this question.'}
        </div>
      )}
    </li>
  )
}

/* ------------------------------------------------------------ evidence -- */

function Evidence({ interviewId }: { interviewId: number }) {
  // Both fetched here rather than in the parent: this component only mounts
  // when the Evidence section is selected, which is what keeps them off the
  // critical path for the common case of just checking a score.
  const recording = useAsync(() => aiInterviewApi.recording(interviewId), [interviewId])
  const snapshots = useAsync(() => aiInterviewApi.snapshots(interviewId), [interviewId])

  const videoUrl = recording.data ? mediaUrl(recording.data) : null
  const shots = snapshots.data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Video className="size-4 text-muted-foreground" />
          Recording
        </h3>
        {recording.initialLoading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : videoUrl ? (
          // Their signed URL, played directly by the browser. Our API key is
          // not part of it and never reaches this component.
          <video
            src={videoUrl}
            controls
            preload="none"
            className="w-full rounded-lg border border-border"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No recording available.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Camera className="size-4 text-muted-foreground" />
          Proctoring snapshots
          {shots.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {shots.length}
            </Badge>
          )}
        </h3>
        {snapshots.initialLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : shots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No snapshots were captured.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {shots.map((snap, index) => {
              const url = mediaUrl(snap)
              return url ? (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-80"
                >
                  <img
                    src={url}
                    alt={`Proctoring snapshot ${index + 1}`}
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                </a>
              ) : null
            })}
          </div>
        )}
      </section>
    </div>
  )
}

/* --------------------------------------------------------------- footer -- */

function Footer({
  interviewId,
  onClose,
  onChanged,
}: {
  interviewId: number
  onClose: () => void
  onChanged: () => void
}) {
  const { can } = useAiPermissions()
  const [confirming, setConfirming] = useState(false)
  const allowed = can(AiScope.INTERVIEWS_DELETE)

  const remove = useMutation(async () => {
    await aiInterviewApi.remove(interviewId)
    setConfirming(false)
    onChanged()
  })

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>

      <div className="flex items-center gap-3">
        {!allowed && (
          <p className="hidden text-xs text-muted-foreground sm:block">
            A super admin can grant delete permission.
          </p>
        )}
        <Button
          variant="destructive"
          disabled={!allowed || remove.pending}
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" />
          Delete interview
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this interview?"
        description="This removes the interview, its report and its recording from InterviewerAI. It does not change the candidate's stage here, and it cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={remove.pending}
        error={remove.error}
        onConfirm={() => void remove.run()}
      />
    </div>
  )
}
