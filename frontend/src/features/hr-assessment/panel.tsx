/**
 * HR Assessment — every onboarding candidate's screening result and paperwork
 * on one row, with their interview report and their submitted forms each one
 * click away.
 *
 * Shared between the admin screen (bootcampId supplied, one intake) and the
 * super-admin screen (bootcampId omitted, every intake plus a bootcamp
 * column and filter) — the same split, and the same single component, as
 * `CompletedInterviewsPanel`. Two near-identical panels would drift.
 *
 * Search and the filters are client-side over the one fetched batch, matching
 * that panel: the backend answers this screen in one DB query plus one
 * external call, and re-filtering an in-memory array costs nothing worth a
 * round trip. The debounce exists to avoid re-filtering on every keystroke's
 * render, not to save a request.
 *
 * Both modals fetch lazily. The evidence dialog already did — its report and
 * recording load when it opens, never for a list — and the onboarding dialog
 * mounts its view only while open, so the same is true of the paperwork.
 * The one thing every row does carry is the matched interview record, and
 * that is not a preload: the score column needs it, so it arrived with the
 * list either way.
 */

import {
  ClipboardList,
  Download,
  FileText,
  Gauge,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Counter } from '@/components/motion/counter'
import { AppLoader } from '@/components/shared/app-loader'
import { Reveal } from '@/components/motion/reveal'
import { MotionTableBody, MotionTableRow } from '@/components/motion/table-row'
import { EmptyState } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { agilyticsApi, hrAssessmentApi } from '@/features/admin/api'
import { AsyncSection } from '@/features/admin/components'
import { LiveIndicator } from '@/features/live/live-indicator'
import { useLiveResource } from '@/features/live/use-live-resource'
import { AI_PASS_THRESHOLD } from '@/features/ai-interview/records'
import { EvidenceDialog } from '@/features/ai-interview/report-view'
import { AgilyticsCell } from '@/features/hr-assessment/agilytics-cell'
import { AgilyticsStrip } from '@/features/hr-assessment/agilytics-strip'
import { OnboardingFormDialog } from '@/features/hr-assessment/onboarding-form-dialog'
import {
  RecordResultDialog,
  type RecordResultTarget,
} from '@/features/physical-interview/record-result-dialog'
import { useAsync } from '@/hooks/use-async'
import { useDebounced } from '@/hooks/use-debounced'
import { downloadCsv } from '@/lib/csv-export'
import {
  STAGE_LABEL,
  type ExternalRecord,
  type HrAssessmentAwaitingRow,
  type HrAssessmentRow,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const ALL = 'ALL'

export function HrAssessmentPanel({
  bootcampId,
  bootcampName,
}: {
  bootcampId?: string
  bootcampName?: string
}) {
  // Live, not a one-shot fetch. Two different admins work this screen at once
  // during a decision round, and a result recorded by one of them has to leave
  // the other's queue without a manual reload — the same reasoning, and the
  // same hook, as the Candidates and AI Interviews screens. A slower cadence
  // than those: this page costs an external call per refresh, and a decision
  // queue does not turn over by the second.
  const {
    data,
    error,
    initialLoading,
    lastUpdated,
    live,
    refresh: refetch,
  } = useLiveResource(() => hrAssessmentApi.list(bootcampId), [bootcampId], {
    activeMs: 15_000,
    hiddenMs: 60_000,
  })
  // One workspace per intake, so this only means anything in the scoped view.
  // The platform page renders the roster without the Agilytics column rather
  // than inventing a cross-intake aggregate that does not exist.
  const agilytics = useAsync(
    () => (bootcampId ? agilyticsApi.state(bootcampId) : Promise.resolve(undefined)),
    [bootcampId],
  )
  // Undefined means "no intake was picked" — the platform-wide mode, valid for
  // a super admin only; the backend refuses anyone else who omits it.
  const platform = bootcampId === undefined

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 200)
  const [track, setTrack] = useState(ALL)
  const [bootcamp, setBootcamp] = useState(ALL)

  const [openInterview, setOpenInterview] = useState<ExternalRecord | null>(null)
  const [openForms, setOpenForms] = useState<HrAssessmentRow | null>(null)
  /** The awaiting-decision row whose select/reject dialog is open. */
  const [deciding, setDeciding] = useState<RecordResultTarget | null>(null)

  // No candidate selection on this screen any more. It existed to choose who
  // received the covering email alongside an Agilytics invite, and that whole
  // flow is gone: onboarding is a single immediate action, it lives on the
  // Onboarding screen next to the folder cards it affects, and it sends its
  // own email to exactly the people it onboarded.
  // Memoized so its identity is stable across renders where `data` has not
  // changed — a fresh `?? []` literal every render is what trips the
  // exhaustive-deps warning on the useMemo calls below.
  const items = useMemo(() => data?.items ?? [], [data])

  const tracks = useMemo(
    () =>
      Array.from(
        new Set(items.map((row) => row.program_title).filter((v): v is string => !!v)),
      ).sort(),
    [items],
  )
  const bootcamps = useMemo(
    () =>
      Array.from(
        new Set(items.map((row) => row.bootcamp_name).filter((v): v is string => !!v)),
      ).sort(),
    [items],
  )

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return items.filter((row) => {
      if (track !== ALL && row.program_title !== track) return false
      if (platform && bootcamp !== ALL && row.bootcamp_name !== bootcamp) return false
      if (!term) return true
      return (
        (row.full_name ?? '').toLowerCase().includes(term) ||
        row.candidate_code.toLowerCase().includes(term)
      )
    })
  }, [items, track, bootcamp, platform, debouncedSearch])

  // The same search and track filters drive the decision queue, so one term
  // narrows the whole screen rather than only its bottom half.
  const awaitingFiltered = useMemo(() => {
    const rows = data?.awaiting ?? []
    const term = debouncedSearch.trim().toLowerCase()
    return rows.filter((row) => {
      if (track !== ALL && row.program_title !== track) return false
      if (platform && bootcamp !== ALL && row.bootcamp_name !== bootcamp) return false
      if (!term) return true
      return (
        (row.full_name ?? '').toLowerCase().includes(term) ||
        row.candidate_code.toLowerCase().includes(term)
      )
    })
  }, [data, track, bootcamp, platform, debouncedSearch])

  // Only the rows still on screen: a selection hidden by a filter must not be
  // silently emailed, and the count in the toolbar has to mean what it says.
  const exportRows = () => {
    const header = [
      'Code',
      'Candidate',
      ...(platform ? ['Bootcamp'] : []),
      'Track',
      'Stage',
      'AI score',
      'Forms',
      'Documents approved',
      'Documents pending',
    ]
    const rows = filtered.map((row) => [
      row.candidate_code,
      row.full_name ?? '',
      ...(platform ? [row.bootcamp_name ?? ''] : []),
      row.program_title ?? '',
      STAGE_LABEL[row.stage] ?? row.stage,
      row.ai_score?.toString() ?? '',
      `${row.forms_submitted}/${row.forms_total}`,
      row.documents_approved.toString(),
      row.documents_pending.toString(),
    ])
    // Exports exactly what is on screen — the current search/filter view, not
    // a separate unfiltered fetch. Matches the other admin table exports.
    downloadCsv(header, rows, `hr-assessment-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  // One loader for the screen, not one per block. The decision
  // queue and the roster all come from the *same* request, so three separate
  // loading states meant three sets of rings on one page for one wait — which
  // reads as a broken layout, and is exactly the "several loading systems"
  // feeling this was meant to remove. The whole panel waits together because
  // it arrives together.
  if (initialLoading) return <AppLoader size="lg" />

  return (
    <div className="flex flex-col gap-4 pt-4">
      <LiveIndicator lastUpdated={lastUpdated} live={live} />

      {bootcampId && (
        <AgilyticsStrip bootcampId={bootcampId} bootcampName={bootcampName} state={agilytics} />
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by candidate name or code"
            className="pl-9"
          />
        </div>

        {tracks.length > 1 && (
          <Select value={track} onValueChange={(v) => v && setTrack(v)}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="All tracks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All tracks</SelectItem>
              {tracks.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {platform && bootcamps.length > 1 && (
          <Select value={bootcamp} onValueChange={(v) => v && setBootcamp(v)}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="All bootcamps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All bootcamps</SelectItem>
              {bootcamps.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" onClick={refetch}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
        <Button variant="outline" onClick={exportRows} disabled={filtered.length === 0}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>


      {/* The decision queue, above the roster it feeds. A reviewer opens this
          screen to act on the people still waiting; the cleared roster below
          is what they consult afterwards. */}
      <AwaitingDecisionSection
        rows={awaitingFiltered}
        loading={initialLoading}
        onRecorded={() => {
          setDeciding(null)
          // Both sections come from the one request, and a decision moves a
          // candidate across them, so this refetch is what keeps the two
          // consistent rather than leaving a ghost row in the top list.
          refetch()
        }}
        deciding={deciding}
        setDeciding={setDeciding}
        onOpenInterview={setOpenInterview}
      />

      <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={items.length === 0 ? 'Nobody in onboarding yet' : 'No matches'}
            description={
              items.length === 0
                ? 'Candidates appear here once their Physical Interview is cleared.'
                : 'Try a different search or filter.'
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Candidate</TableHead>
                      {platform && (
                        <TableHead className="hidden md:table-cell">Bootcamp</TableHead>
                      )}
                      <TableHead className="hidden lg:table-cell">Track</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">AI score</TableHead>
                      <TableHead>Forms</TableHead>
                      <TableHead className="hidden xl:table-cell">Documents</TableHead>
                      {bootcampId && (
                        <TableHead className="hidden lg:table-cell">Agilytics</TableHead>
                      )}
                      <TableHead className="text-right">Review</TableHead>
                    </TableRow>
                  </TableHeader>
                  {/* Keyed on the filter view so a search re-runs the entrance
                      rather than leaving newly-matched rows invisible — the
                      variants only animate on mount. */}
                  <MotionTableBody key={`${debouncedSearch}|${track}|${bootcamp}`}>
                    {filtered.map((row) => (
                      <MotionTableRow key={row.application_id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {row.candidate_code}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{row.full_name ?? '—'}</span>
                            {row.email && (
                              <span className="text-xs text-muted-foreground">{row.email}</span>
                            )}
                          </div>
                        </TableCell>
                        {platform && (
                          <TableCell className="hidden text-muted-foreground md:table-cell">
                            {row.bootcamp_name ?? '—'}
                          </TableCell>
                        )}
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {row.program_title ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {STAGE_LABEL[row.stage] ?? row.stage}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <ScoreCell value={row.ai_score} />
                        </TableCell>
                        <TableCell>
                          <FormsCell row={row} />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <DocumentsCell row={row} />
                        </TableCell>
                        {bootcampId && (
                          <TableCell className="hidden lg:table-cell">
                            <AgilyticsCell
                              bootcampId={bootcampId}
                              email={row.email}
                              workspace={agilytics.data}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setOpenForms(row)}
                              disabled={row.forms_submitted === 0}
                              aria-label={`Onboarding form for ${row.full_name ?? row.candidate_code}`}
                            >
                              <FileText className="size-3.5" />
                              <span className="hidden sm:inline">Onboarding form</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setOpenInterview(row.interview)}
                              disabled={row.interview === null}
                              aria-label={`Interview results for ${row.full_name ?? row.candidate_code}`}
                            >
                              <Gauge className="size-3.5" />
                              <span className="hidden sm:inline">Interview results</span>
                            </Button>
                          </div>
                        </TableCell>
                      </MotionTableRow>
                    ))}
                  </MotionTableBody>
                </Table>
            </CardContent>
          </Card>
        )}
      </AsyncSection>

      {/* The existing evidence modal, not a second version of it. */}
      <EvidenceDialog
        record={openInterview}
        onClose={() => setOpenInterview(null)}
        onChanged={() => {
          setOpenInterview(null)
          refetch()
        }}
      />
      <OnboardingFormDialog row={openForms} onClose={() => setOpenForms(null)} />
    </div>
  )
}

/* ---------------------------------------------------- awaiting decision -- */

/** dd Mon, and the time only when the batch actually pinned one. */
function formatSlot(row: HrAssessmentAwaitingRow): string {
  const day = new Date(row.interview_date).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  })
  return row.start_time ? `${day}, ${row.start_time.slice(0, 5)}` : day
}

function AwaitingDecisionSection({
  rows,
  loading,
  deciding,
  setDeciding,
  onRecorded,
  onOpenInterview,
}: {
  rows: HrAssessmentAwaitingRow[]
  loading: boolean
  deciding: RecordResultTarget | null
  setDeciding: (target: RecordResultTarget | null) => void
  onRecorded: () => void
  onOpenInterview: (record: ExternalRecord | null) => void
}) {
  if (loading) return <AppLoader size="sm" />

  // Nothing to decide is the ordinary resting state of this screen, not an
  // empty state worth a full panel — the roster below is the page then.
  if (rows.length === 0) return null

  return (
    <Reveal direction="none" duration={0.25}>
      <Card className="border-warning/40">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-warning/15 text-warning-foreground dark:text-warning">
                <UserCheck className="size-4" />
              </span>
              <div className="flex flex-col">
                <span className="font-medium">Awaiting your decision</span>
                <CardDescription>
                  Invited to a Physical Interview, no result recorded yet.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="whitespace-nowrap">
              {rows.length} pending
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="hidden md:table-cell">Venue</TableHead>
                  <TableHead className="hidden sm:table-cell">Slot</TableHead>
                  <TableHead className="text-right">AI score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <MotionTableBody key={rows.length}>
                {rows.map((row) => (
                  <MotionTableRow key={row.invite_id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {row.candidate_code}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.full_name ?? '—'}</span>
                        {row.email && (
                          <span className="text-xs text-muted-foreground">{row.email}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {row.venue}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatSlot(row)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ScoreCell value={row.ai_score} />
                    </TableCell>
                    <TableCell>
                      {/* "missed" means the batch deadline passed with no
                          result — still the reviewer's to decide, which is
                          why the row is here rather than dropped. */}
                      <Badge
                        variant="outline"
                        className={cn(
                          'whitespace-nowrap',
                          row.status === 'missed' && 'border-destructive/40 text-destructive',
                        )}
                      >
                        {row.status === 'missed' ? 'Deadline passed' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenInterview(row.interview)}
                          disabled={row.interview === null}
                          aria-label={`Interview results for ${row.full_name ?? row.candidate_code}`}
                        >
                          <Gauge className="size-3.5" />
                          <span className="hidden lg:inline">Evidence</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            setDeciding({
                              invite_id: row.invite_id,
                              candidate_code: row.candidate_code,
                              full_name: row.full_name,
                            })
                          }
                        >
                          Record result
                        </Button>
                      </div>
                    </TableCell>
                  </MotionTableRow>
                ))}
              </MotionTableBody>
            </Table>
        </CardContent>
      </Card>

      {/* The same dialog the invite screen's batch history opens. */}
      <RecordResultDialog
        target={deciding}
        onClose={() => setDeciding(null)}
        onRecorded={onRecorded}
      />
    </Reveal>
  )
}

/* --------------------------------------------------------------- cells -- */

function ScoreCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  const passed = value >= AI_PASS_THRESHOLD
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 font-semibold tabular-nums',
        passed ? 'text-success' : 'text-warning',
      )}
    >
      <Counter to={value} decimals={Number.isInteger(value) ? 0 : 1} className="text-base" />
      <span className="text-xs font-normal text-muted-foreground">/100</span>
    </span>
  )
}

function FormsCell({ row }: { row: HrAssessmentRow }) {
  const complete = row.forms_submitted >= row.forms_total
  return (
    <Badge variant={complete ? 'default' : 'outline'} className="whitespace-nowrap">
      {row.forms_submitted}/{row.forms_total} forms
    </Badge>
  )
}

/** Mirrors the summary on /admin/onboarding rather than inventing a second
 *  vocabulary for the same counts. */
function DocumentsCell({ row }: { row: HrAssessmentRow }) {
  if (!row.hub_unlocked) {
    return <span className="text-xs text-muted-foreground">Locked</span>
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">
        {typeof row.documents_slots_filled === 'number'
          ? `${row.documents_slots_filled}/${row.documents_required} documents`
          : /* An API older than this field would otherwise render "/6". */
            `${row.documents_required} required`}
      </span>
      <span className="text-muted-foreground">
        &middot; {row.documents_uploaded} file{row.documents_uploaded === 1 ? '' : 's'}
      </span>
      {row.documents_rejected > 0 && (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          {row.documents_rejected} rejected
        </Badge>
      )}
      {row.documents_pending > 0 && (
        <Badge variant="outline" className="text-warning-foreground dark:text-warning">
          {row.documents_pending} pending
        </Badge>
      )}
    </div>
  )
}
