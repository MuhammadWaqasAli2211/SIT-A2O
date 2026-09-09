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

import { ClipboardList, Download, FileText, Gauge, RefreshCw, Search, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Counter } from '@/components/motion/counter'
import { Reveal } from '@/components/motion/reveal'
import { MotionTableBody, MotionTableRow } from '@/components/motion/table-row'
import { EmptyState } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { agilyticsApi, hrAssessmentApi } from '@/features/admin/api'
import { AsyncSection } from '@/features/admin/components'
import { AI_PASS_THRESHOLD } from '@/features/ai-interview/records'
import { EvidenceDialog } from '@/features/ai-interview/report-view'
import { AgilyticsCell } from '@/features/hr-assessment/agilytics-cell'
import { AgilyticsStrip } from '@/features/hr-assessment/agilytics-strip'
import { OnboardingFormDialog } from '@/features/hr-assessment/onboarding-form-dialog'
import { SendInvitesDialog } from '@/features/hr-assessment/send-invites-dialog'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useDebounced } from '@/hooks/use-debounced'
import { downloadCsv } from '@/lib/csv-export'
import {
  STAGE_LABEL,
  type ExternalRecord,
  type HrAssessmentRow,
  type HrAssessmentStats,
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
  const { data, error, initialLoading, refetch } = useAsync(
    () => hrAssessmentApi.list(bootcampId),
    [bootcampId],
  )
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

  // Selection drives our covering email only — the Agilytics invite itself
  // always covers every pending member, because their endpoint takes no
  // member list. The send dialog says so plainly.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  const toggleRow = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

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

  // Only the rows still on screen: a selection hidden by a filter must not be
  // silently emailed, and the count in the toolbar has to mean what it says.
  const selectedRows = useMemo(
    () => filtered.filter((row) => selectedIds.has(row.application_id)),
    [filtered, selectedIds],
  )
  const allVisibleSelected = filtered.length > 0 && selectedRows.length === filtered.length

  const send = useMutation(async (message: { subject: string; body_html: string } | null) => {
    if (!bootcampId) return
    const result = await agilyticsApi.sendInvites(bootcampId, {
      application_ids: selectedRows.map((row) => row.application_id),
      ...(message ?? {}),
    })
    toast.success(
      [
        result.invites_issued === 0
          ? 'No pending members to invite'
          : `${result.invites_issued} Agilytics invite(s) issued`,
        result.emailed > 0 ? `${result.emailed} candidate(s) emailed` : null,
        result.email_failed > 0 ? `${result.email_failed} email(s) failed` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    )
    setSending(false)
    setSelectedIds(new Set())
    agilytics.refetch()
  })

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

  return (
    <div className="flex flex-col gap-4 pt-4">
      <StatCards stats={data?.stats} loading={initialLoading} />

      {bootcampId && (
        <AgilyticsStrip
          bootcampId={bootcampId}
          bootcampName={bootcampName}
          state={agilytics}
          onSendInvites={() => setSending(true)}
        />
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

      {bootcampId && selectedRows.length > 0 && (
        <Reveal direction="none" duration={0.25}>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-sm font-medium">
              {selectedRows.length} candidate{selectedRows.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setSending(true)}
                disabled={!agilytics.data?.provisioned}
                title={
                  agilytics.data?.provisioned
                    ? undefined
                    : 'Provision this intake in Agilytics first'
                }
              >
                <Send className="size-4" />
                Send Agilytics invite
              </Button>
            </div>
          </div>
        </Reveal>
      )}

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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {bootcampId && (
                        <TableHead className="w-10">
                          <Checkbox
                            aria-label="Select all candidates in view"
                            checked={allVisibleSelected}
                            onCheckedChange={(next) =>
                              setSelectedIds(
                                next === true
                                  ? new Set(filtered.map((row) => row.application_id))
                                  : new Set(),
                              )
                            }
                          />
                        </TableHead>
                      )}
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
                        {bootcampId && (
                          <TableCell>
                            <Checkbox
                              aria-label={`Select ${row.full_name ?? row.candidate_code}`}
                              checked={selectedIds.has(row.application_id)}
                              onCheckedChange={() => toggleRow(row.application_id)}
                            />
                          </TableCell>
                        )}
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
              </div>
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

      <SendInvitesDialog
        open={sending}
        onOpenChange={(next) => !next && setSending(false)}
        selected={selectedRows}
        workspace={agilytics.data}
        pending={send.pending}
        error={send.error}
        onSend={(message) => void send.run(message)}
      />
    </div>
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
        {row.documents_uploaded}/{row.documents_required} uploaded
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

/* --------------------------------------------------------------- stats -- */

function StatCards({ stats, loading }: { stats: HrAssessmentStats | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (!stats) return null

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <StatCard label="In onboarding" value={stats.total} />
      <StatCard label="Forms complete" value={stats.forms_complete} />
      <StatCard label="Documents pending" value={stats.documents_pending} />
      <StatCard
        label="Average AI score"
        value={stats.average_ai_score}
        suffix={stats.average_ai_score === null ? '' : '/100'}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix = '',
}: {
  label: string
  value: number | null
  suffix?: string
}) {
  return (
    <Reveal>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>{label}</CardDescription>
        </CardHeader>
        <CardContent>
          {value === null ? (
            <p className="text-2xl font-semibold text-muted-foreground">—</p>
          ) : (
            <p className="flex items-baseline gap-1 text-2xl font-semibold tabular-nums">
              <Counter to={value} decimals={Number.isInteger(value) ? 0 : 1} />
              {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
            </p>
          )}
        </CardContent>
      </Card>
    </Reveal>
  )
}
