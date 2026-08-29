/**
 * The candidate's own AI screening result, and the deadline attached to it.
 *
 * Everything a candidate is permitted to know: a status, a deadline, and —
 * once finished — one overall number. No per-question breakdown, no
 * proctoring detail, no recording, because the endpoint behind it cannot
 * return any of those. See `CandidateScore` in schemas/ai_interview.py.
 *
 * Deliberately *not* labelled pass or fail. InterviewerAI has not told us
 * what threshold separates the two, and telling a candidate they failed on a
 * number we invented would be worse than showing them the number plainly.
 *
 * The deadline is shown as a live countdown rather than a date so the missed
 * deadline in `ExpiredCard` reads as a consequence the candidate watched
 * approaching, not as a surprise.
 */

import { AlertTriangle, BrainCircuit, CheckCircle2, Clock, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Counter } from '@/components/motion/counter'
import { Reveal } from '@/components/motion/reveal'
import { Countdown } from '@/components/shared/countdown'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { candidateApi } from '@/features/candidate/api'
import { LiveIndicator } from '@/features/live/live-indicator'
import { useLiveResource } from '@/features/live/use-live-resource'
import { useMutation } from '@/hooks/use-async'
import type { CandidateScore } from '@/lib/types'

/** Matches the backend's `min_length=30` on the explanation. */
const MIN_REASON = 30

export function AiScoreCard() {
  const { data, initialLoading, lastUpdated, live, refresh } = useLiveResource(
    () => candidateApi.myAiInterview(),
    [],
    // Slower than the admin screens: a candidate's own status changes when
    // they finish an interview, which they already know about. This is here
    // to catch the result landing, not to track a fast-moving value.
    { activeMs: 10_000, hiddenMs: 60_000 },
  )

  if (initialLoading) return <Skeleton className="h-44 w-full rounded-xl" />

  // A candidate never invited to the AI round has nothing to be told, and an
  // empty card explaining an absence would only add noise.
  if (!data || data.status === 'not_invited') return null

  return (
    <div className="flex flex-col gap-2">
      {data.status === 'completed' ? (
        <CompletedCard result={data} />
      ) : data.status === 'expired' ? (
        <ExpiredCard result={data} onSent={refresh} />
      ) : (
        <WaitingCard result={data} />
      )}
      <LiveIndicator lastUpdated={lastUpdated} live={live} className="self-end" />
    </div>
  )
}

/* ------------------------------------------------------- still to take -- */

function WaitingCard({ result }: { result: CandidateScore }) {
  const invited = result.status === 'invited'

  return (
    <Reveal>
      <Card className={invited ? 'border-primary/40' : undefined}>
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {invited ? <Clock className="size-4" /> : <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">
              {invited ? 'Your AI interview is waiting' : 'We are still marking your interview'}
            </CardTitle>
            <CardDescription>
              {invited
                ? 'Check the email we sent for your interview link. You can take it whenever you are ready — before the deadline below.'
                : 'Your result will appear here once it has been scored. This usually takes a short while.'}
            </CardDescription>
          </div>
        </CardHeader>

        {invited && result.deadline_at && (
          <CardContent>
            <div className="rounded-lg border border-border p-3">
              <Countdown deadline={result.deadline_at} label="Interview closes in" />
              <p className="mt-2 text-xs text-muted-foreground">
                Your interview link stops working after this. If you miss it, your
                application is held here until an administrator reviews it — it is not
                rejected automatically.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </Reveal>
  )
}

/* ------------------------------------------------------------ finished -- */

function CompletedCard({ result }: { result: CandidateScore }) {
  return (
    <Reveal>
      <Card className="border-primary/40">
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <BrainCircuit className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Your AI interview result</CardTitle>
            <CardDescription>
              This is your overall score. The admissions team reviews it alongside the rest
              of your application.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            {/* Counter holds the final value in the DOM for screen readers and
                for reduced-motion, so the number is never only an animation. */}
            <Counter
              to={result.score ?? 0}
              decimals={result.score !== null && !Number.isInteger(result.score) ? 1 : 0}
              className="text-5xl font-semibold tracking-tight text-primary tabular-nums"
            />
            <span className="pb-1.5 text-lg text-muted-foreground">/ {result.scale}</span>
          </div>

          <ScoreBar value={result.score ?? 0} max={result.scale} />

          {result.completed_at && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              Completed {new Date(result.completed_at).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    </Reveal>
  )
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 100)) * 100))
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`Score ${value} out of ${max}`}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------- missed -- */

function ExpiredCard({ result, onSent }: { result: CandidateScore; onSent: () => void }) {
  const [reason, setReason] = useState('')
  const enough = reason.trim().length >= MIN_REASON

  const send = useMutation(async () => {
    await candidateApi.explainMissedDeadline(reason.trim())
    toast.success('Your explanation has been sent to the admissions team.')
    setReason('')
    onSent()
  })

  return (
    <Reveal>
      <Card className="border-destructive/40">
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">You missed your interview deadline</CardTitle>
            <CardDescription>
              Your interview link has closed. Your application has not been rejected — it is
              held at this stage until an administrator looks at it.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {result.explanation_sent ? (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertDescription>
                Your explanation has been sent to the admissions team. They will be in touch
                — there is nothing else you need to do right now.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <label htmlFor="missed-reason" className="text-sm font-medium">
                Tell the admissions team what happened
              </label>
              <textarea
                id="missed-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Explain why you could not take the interview before the deadline. Include anything that supports it — a hospital visit, a family emergency, a documented clash."
                className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {enough
                    ? 'A person reads this — there is no automated decision.'
                    : `Please write at least ${MIN_REASON} characters (${reason.trim().length}/${MIN_REASON}).`}
                </p>
                <Button
                  size="sm"
                  disabled={!enough || send.pending}
                  onClick={() => void send.run()}
                >
                  <Send className="size-4" />
                  Send to admissions
                </Button>
              </div>

              {send.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>{send.error}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Reveal>
  )
}
