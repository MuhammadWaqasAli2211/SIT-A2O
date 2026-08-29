/**
 * AI Interviewer results for the selected intake.
 *
 * Three things an admin does with the external service once invites have
 * gone out: read what came back, decide reinterview requests, and look at the
 * aggregate. They share an intake and a permission model, so they share a
 * screen rather than three near-identical ones.
 *
 * Everything here reads through our own backend. The InterviewerAI key is
 * never in the browser, and the evidence tab's media URLs are the ones their
 * service signed for playback — not links carrying our credentials.
 *
 * Write controls (delete, decide) are disabled unless the signed-in admin has
 * been granted the matching scope. The backend refuses them independently;
 * this only stops the click.
 */

import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Reveal } from '@/components/motion/reveal'
import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { aiInterviewApi } from '@/features/admin/api'
import {
  AsyncSection,
  BootcampSwitcher,
  NoBootcampSelected,
} from '@/features/admin/components'
import { useAiPermissions } from '@/features/ai-interview/use-permissions'
import { ReportView } from '@/features/ai-interview/report-view'
import {
  candidateEmail,
  candidateName,
  formatWhen,
  recordId,
  score,
  status,
  text,
  timestamp,
} from '@/features/ai-interview/records'
import { LiveIndicator } from '@/features/live/live-indicator'
import { useLiveResource } from '@/features/live/use-live-resource'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { AiScope, type ExternalRecord } from '@/lib/types'
import { CHART_COLORS, chartTooltipStyle } from '@/lib/chart-theme'
import { cn } from '@/lib/utils'

const AXIS = {
  stroke: 'var(--color-muted-foreground)',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const

export default function AdminAiInterviewsPage() {
  const { selectedId, selected } = useBootcamp()

  return (
    <>
      <PageHeader
        title="AI interviews"
        description="Results, evidence and reinterview decisions from InterviewerAI."
        actions={<BootcampSwitcher />}
      />

      {!selectedId ? (
        <NoBootcampSelected icon={BrainCircuit} />
      ) : (
        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="reinterviews">Reinterview requests</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="results">
            <ResultsTab bootcampId={selectedId} />
          </TabsContent>
          <TabsContent value="reinterviews">
            <ReinterviewsTab bootcampId={selectedId} />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsTab bootcampId={selectedId} bootcampName={selected?.name} />
          </TabsContent>
        </Tabs>
      )}
    </>
  )
}

/* ------------------------------------------------------------- results -- */

function ResultsTab({ bootcampId }: { bootcampId: string }) {
  // Live rather than a one-shot fetch: an admin watching this screen during a
  // sitting wants results to appear as candidates finish, without deciding
  // when to press refresh. Backs off on its own when the tab is hidden.
  const { data, error, initialLoading, lastUpdated, live, refresh } = useLiveResource(
    () => aiInterviewApi.listForBootcamp(bootcampId),
    [bootcampId],
  )
  const [open, setOpen] = useState<ExternalRecord | null>(null)
  const rows = data?.items ?? []

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <LiveIndicator lastUpdated={lastUpdated} live={live} />
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refresh}
        skeleton={<Skeleton className="h-56 w-full rounded-xl" />}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={BrainCircuit}
            title="No AI interviews yet"
            description="Results appear here once candidates you have invited complete their interview."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <InterviewRow
                key={recordId(row) ?? index}
                record={row}
                onOpen={() => setOpen(row)}
              />
            ))}
          </div>
        )}
      </AsyncSection>

      <EvidenceDialog
        record={open}
        onClose={() => setOpen(null)}
        onDeleted={() => {
          setOpen(null)
          refresh()
        }}
      />
    </div>
  )
}

function InterviewRow({ record, onOpen }: { record: ExternalRecord; onOpen: () => void }) {
  const value = score(record)
  const state = status(record)

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      className="cursor-pointer transition-colors hover:border-primary/40"
    >
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle className="truncate text-base">{candidateName(record)}</CardTitle>
          <CardDescription className="truncate">
            {candidateEmail(record) ?? '—'} · {formatWhen(timestamp(record))}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {state && (
            <Badge variant="outline" className="font-normal capitalize">
              {state.replace(/_/g, ' ')}
            </Badge>
          )}
          <span className="text-xl font-semibold tabular-nums text-primary">
            {value === null ? '—' : value}
          </span>
        </div>
      </CardHeader>
    </Card>
  )
}

/* ------------------------------------------------------------ evidence -- */

function EvidenceDialog({
  record,
  onClose,
  onDeleted,
}: {
  record: ExternalRecord | null
  onClose: () => void
  onDeleted: () => void
}) {
  const id = record ? recordId(record) : null

  return (
    <Dialog open={record !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{record ? candidateName(record) : 'Interview'}</DialogTitle>
          <DialogDescription>
            Score, per-question breakdown, and the proctoring evidence behind it.
          </DialogDescription>
        </DialogHeader>

        {record !== null && id !== null && (
          <ReportView interviewId={id} record={record} onDeleted={onDeleted} />
        )}
        {record !== null && id === null && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              This record arrived without an id, so its report cannot be fetched.
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  )
}


/* -------------------------------------------------------- reinterviews -- */

function ReinterviewsTab({ bootcampId }: { bootcampId: string }) {
  const { can } = useAiPermissions()
  const { data, error, initialLoading, refetch } = useAsync(
    () => aiInterviewApi.reinterviewRequests(bootcampId),
    [bootcampId],
  )
  const [deciding, setDeciding] = useState<ExternalRecord | null>(null)
  const rows = data?.items ?? []
  const allowed = can(AiScope.REINTERVIEW_DECIDE)

  return (
    <div className="flex flex-col gap-4 pt-4">
      {!allowed && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>
            You can see reinterview requests but not decide them. A super admin can grant
            the permission.
          </AlertDescription>
        </Alert>
      )}

      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refetch}
        skeleton={<Skeleton className="h-40 w-full rounded-xl" />}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="No reinterview requests"
            description="Candidates who ask to retake their interview appear here for a decision."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <Card key={recordId(row) ?? index}>
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <CardTitle className="truncate text-base">{candidateName(row)}</CardTitle>
                    <CardDescription className="truncate">
                      {text(row, 'reason', 'note', 'message') ?? 'No reason given'} ·{' '}
                      {formatWhen(timestamp(row))}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!allowed}
                    onClick={() => setDeciding(row)}
                  >
                    Decide
                  </Button>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>

      <DecisionDialog
        record={deciding}
        onClose={() => setDeciding(null)}
        onDecided={() => {
          setDeciding(null)
          refetch()
        }}
      />
    </div>
  )
}

function DecisionDialog({
  record,
  onClose,
  onDecided,
}: {
  record: ExternalRecord | null
  onClose: () => void
  onDecided: () => void
}) {
  const [note, setNote] = useState('')
  const id = record ? recordId(record) : null

  const decide = useMutation(async (approve: boolean) => {
    if (id === null) return
    await aiInterviewApi.decideReinterview(id, approve, note.trim() || undefined)
    setNote('')
    onDecided()
  })

  return (
    <Dialog open={record !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reinterview for {record ? candidateName(record) : ''}</DialogTitle>
          <DialogDescription>
            Approving lets this candidate take the interview again. The decision is recorded
            in the platform audit trail either way.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note explaining the decision"
          rows={3}
          maxLength={500}
          aria-label="Decision note"
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {decide.error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{decide.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={decide.pending}
            onClick={() => void decide.run(false)}
          >
            <XCircle className="size-4" />
            Refuse
          </Button>
          <Button disabled={decide.pending} onClick={() => void decide.run(true)}>
            <CheckCircle2 className="size-4" />
            Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------ analytics -- */

function AnalyticsTab({
  bootcampId,
  bootcampName,
}: {
  bootcampId: string
  bootcampName?: string
}) {
  const { data, error, initialLoading, refetch } = useAsync(
    () => aiInterviewApi.analytics(bootcampId),
    [bootcampId],
  )

  return (
    <div className="flex flex-col gap-4 pt-4">
      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refetch}
        skeleton={<Skeleton className="h-64 w-full rounded-xl" />}
      >
        {data && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Invited candidates" value={data.candidates} />
              <StatCard label="Interviews completed" value={data.interviews_completed} />
              <StatCard
                label="Average score"
                value={data.average_score}
                suffix={data.average_score === null ? '' : ' / 100'}
              />
            </div>

            <Reveal>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Score distribution</CardTitle>
                  <CardDescription>
                    Completed AI interviews for {bootcampName ?? 'this intake'}, in ten-point
                    bands.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  {(data.interviews_completed ?? 0) === 0 ? (
                    <EmptyState
                      icon={BrainCircuit}
                      title="Nothing scored yet"
                      description="The distribution appears once candidates complete their interviews."
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.distribution}
                        margin={{ top: 4, right: 8, left: -18, bottom: 4 }}
                      >
                        <XAxis dataKey="band" {...AXIS} />
                        <YAxis {...AXIS} allowDecimals={false} />
                        <Tooltip
                          {...chartTooltipStyle}
                          cursor={{ fill: 'var(--color-muted)' }}
                        />
                        <Bar dataKey="count" name="Candidates" radius={[6, 6, 0, 0]}>
                          {data.distribution.map((band, index) => (
                            <Cell
                              key={band.band}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Reveal>
          </div>
        )}
      </AsyncSection>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix = '',
}: {
  label: string
  value: number | null | undefined
  suffix?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={cn('text-2xl font-semibold tabular-nums')}>
          {value === null || value === undefined ? '—' : `${value}${suffix}`}
        </p>
      </CardContent>
    </Card>
  )
}
