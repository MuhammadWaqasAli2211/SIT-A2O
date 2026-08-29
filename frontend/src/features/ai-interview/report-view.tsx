/**
 * The admin's view of one AI interview.
 *
 * Rebuilt 2026-08-29. The previous version stacked the report, the recording
 * and every proctoring snapshot into one scrolling column and fetched all
 * three the moment it opened — three external calls to answer a question the
 * admin had not asked yet, and a wall of raw data to read once they arrived.
 *
 * The structure here follows how assessment reports are normally read: the
 * verdict first at a glance, then the reasoning behind it, and only then the
 * raw evidence — which most reviews never need to open at all. So:
 *
 *   - the score leads, as one number with a bar, not buried in a list
 *   - the per-question breakdown is scannable rows, each carrying its own
 *     score, rather than paragraphs
 *   - evidence lives behind its own tab and does not fetch until opened,
 *     which is both faster and the reason it stops being a dump
 *
 * Built from the same tokens and motion primitives as everything else — no
 * one-off styling for this screen.
 */

import { AlertTriangle, Camera, FileText, Trash2, Video } from 'lucide-react'
import { useState } from 'react'

import { Counter } from '@/components/motion/counter'
import { EmptyState } from '@/components/shared/portal-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { aiInterviewApi } from '@/features/admin/api'
import { ConfirmDialog } from '@/features/admin/components'
import {
  candidateCode,
  formatWhen,
  list,
  mediaUrl,
  score,
  status,
  text,
  timestamp,
} from '@/features/ai-interview/records'
import { useAiPermissions } from '@/features/ai-interview/use-permissions'
import { useAsync, useMutation } from '@/hooks/use-async'
import { AiScope, type ExternalRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ReportView({
  interviewId,
  record,
  onDeleted,
}: {
  interviewId: number
  record: ExternalRecord
  onDeleted: () => void
}) {
  const report = useAsync(() => aiInterviewApi.report(interviewId), [interviewId])

  // The list row already carries a score; the report may carry a better one.
  // Preferring the report means the headline agrees with the breakdown
  // beneath it rather than quietly disagreeing by a point.
  const overall = (report.data ? score(report.data) : null) ?? score(record)
  const questions = report.data ? list(report.data, 'questions', 'answers', 'items') : []

  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
      <ScoreHeader record={record} overall={overall} loading={report.initialLoading} />

      <Tabs defaultValue="breakdown">
        <TabsList>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown">
          <Breakdown
            loading={report.initialLoading}
            error={report.error}
            questions={questions}
          />
        </TabsContent>

        {/* Mounted only when selected, so the recording and snapshot calls
            are never made for a review that only wanted the score. */}
        <TabsContent value="evidence">
          <Evidence interviewId={interviewId} />
        </TabsContent>
      </Tabs>

      <DeleteFooter interviewId={interviewId} onDeleted={onDeleted} />
    </div>
  )
}

/* --------------------------------------------------------------- score -- */

function ScoreHeader({
  record,
  overall,
  loading,
}: {
  record: ExternalRecord
  overall: number | null
  loading: boolean
}) {
  const state = status(record)
  const code = candidateCode(record)

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border p-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Overall score</span>
        {loading ? (
          <Skeleton className="h-12 w-28" />
        ) : overall === null ? (
          <span className="text-2xl font-semibold text-muted-foreground">Not scored</span>
        ) : (
          <div className="flex items-end gap-1.5">
            <Counter
              to={overall}
              decimals={Number.isInteger(overall) ? 0 : 1}
              className="text-4xl font-semibold tracking-tight text-primary tabular-nums"
            />
            <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
          </div>
        )}
        {overall !== null && <Bar value={overall} className="mt-1 w-44" />}
      </div>

      <div className="flex flex-col items-end gap-1.5 text-right">
        {code && (
          <Badge variant="outline" className="font-mono text-xs font-normal">
            {code}
          </Badge>
        )}
        {state && (
          <Badge variant="outline" className="font-normal capitalize">
            {state.replace(/_/g, ' ')}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{formatWhen(timestamp(record))}</span>
      </div>
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
  if (loading) return <Skeleton className="mt-4 h-40 w-full rounded-lg" />
  if (error) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertTriangle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  if (questions.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={FileText}
          title="No breakdown returned"
          description="This interview came back without a per-question report."
        />
      </div>
    )
  }

  return (
    <ol className="mt-4 flex flex-col gap-2">
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
  // when the Evidence tab is opened, which is what keeps them off the
  // critical path for the common case of just checking a score.
  const recording = useAsync(() => aiInterviewApi.recording(interviewId), [interviewId])
  const snapshots = useAsync(() => aiInterviewApi.snapshots(interviewId), [interviewId])

  const videoUrl = recording.data ? mediaUrl(recording.data) : null
  const shots = snapshots.data?.items ?? []

  return (
    <div className="mt-4 flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Video className="size-4 text-muted-foreground" />
          Recording
        </h3>
        {recording.initialLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
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

/* -------------------------------------------------------------- delete -- */

function DeleteFooter({
  interviewId,
  onDeleted,
}: {
  interviewId: number
  onDeleted: () => void
}) {
  const { can } = useAiPermissions()
  const [confirming, setConfirming] = useState(false)
  const allowed = can(AiScope.INTERVIEWS_DELETE)

  const remove = useMutation(async () => {
    await aiInterviewApi.remove(interviewId)
    setConfirming(false)
    onDeleted()
  })

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">
        {allowed
          ? 'Deleting removes this interview from InterviewerAI only.'
          : 'You do not have permission to delete interviews. A super admin can grant it.'}
      </p>
      <Button
        variant="destructive"
        size="sm"
        disabled={!allowed || remove.pending}
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-4" />
        Delete interview
      </Button>

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
