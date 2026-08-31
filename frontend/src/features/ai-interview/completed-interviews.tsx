/**
 * Completed Interviews — a filterable, exportable roster of every finished
 * AI interview visible to the signed-in admin.
 *
 * Shared between the admin-scoped "Completed" tab on /admin/ai-interviews
 * (bootcampId supplied) and the super-admin platform-wide screen (bootcampId
 * omitted) — the two only differ in what they pass to
 * `aiInterviewApi.completed()`, plus the platform view additionally shows a
 * bootcamp column and filter. Same table, same export, same report dialog
 * either way, so there is one component rather than two that would drift.
 *
 * Search and the track/bootcamp filters are client-side over the single
 * fetched batch: there is nothing to page through in a completed-interviews
 * roster at current volumes, and re-filtering an in-memory array costs
 * nothing worth a network round trip over. The debounce here exists purely
 * to avoid re-filtering on every keystroke's render, not to save a request —
 * see `list_completed` in ai_interview_service.py for the one-DB-query,
 * one-external-call discipline this screen is built against.
 *
 * Viewing a report has no extra permission gate: only the four *write*
 * scopes on `AiScope` are grantable (confirmed against permission_service.py
 * — reads are never withheld from an admin), so every admin who can reach
 * this bootcamp can already open any report in it via the ordinary
 * `assert_can_manage` scoping the list itself already went through.
 */

import {
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  MoreHorizontal,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Counter } from '@/components/motion/counter'
import { Reveal } from '@/components/motion/reveal'
import { EmptyState } from '@/components/shared/portal-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { aiInterviewApi, applicationApi } from '@/features/admin/api'
import { AsyncSection, ConfirmDialog, useConfirm } from '@/features/admin/components'
import { EvidenceDialog } from '@/features/ai-interview/report-view'
import {
  AI_PASS_THRESHOLD,
  applicationInfo,
  bootcampName,
  candidateCode,
  candidateName,
  canDecideStage,
  programTitle,
  recordId,
  score,
  timestamp,
} from '@/features/ai-interview/records'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useDebounced } from '@/hooks/use-debounced'
import { downloadCsv } from '@/lib/csv-export'
import { relativeTime } from '@/lib/format'
import { STAGE_LABEL, type ApplicationStage, type CompletedInterviewStats, type ExternalRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

const ALL = 'ALL'

export function CompletedInterviewsPanel({ bootcampId }: { bootcampId?: string }) {
  const { data, error, initialLoading, refetch } = useAsync(
    () => aiInterviewApi.completed(bootcampId),
    [bootcampId],
  )
  // Undefined means "no bootcamp was picked" — the platform-wide mode, valid
  // for a super admin only; the backend refuses anyone else who omits it.
  const platform = bootcampId === undefined

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 200)
  const [track, setTrack] = useState(ALL)
  const [bootcamp, setBootcamp] = useState(ALL)
  const [open, setOpen] = useState<ExternalRecord | null>(null)
  const rejectConfirm = useConfirm<ExternalRecord>()

  const reasonFor = (item: ExternalRecord) => {
    const value = score(item)
    return value !== null ? `AI interview score: ${value}/100` : 'AI interview reviewed'
  }

  // Same endpoint the Candidates screen's own stage control already uses
  // (applicationApi.advanceStage) — no new backend action, no new permission
  // model. `refetch` afterward is what makes the row's status/actions catch
  // up without a manual reload.
  const advance = useMutation(async (item: ExternalRecord) => {
    const app = applicationInfo(item)
    if (!app) return
    await applicationApi.advanceStage(app.id, 'PHYSICAL_INTERVIEW', reasonFor(item))
    toast.success(`${candidateName(item)} advanced to Physical Interview`)
    refetch()
  })

  const reject = useMutation(async () => {
    const item = rejectConfirm.target
    const app = item ? applicationInfo(item) : null
    if (!item || !app) return
    await applicationApi.advanceStage(app.id, 'REJECTED', reasonFor(item))
    toast.success(`${candidateName(item)} rejected`)
    rejectConfirm.close()
    refetch()
  })

  // Memoized so its identity is stable across renders where `data` has not
  // actually changed — the `?? []` fallback would otherwise be a fresh array
  // literal every render, which is exactly what trips the exhaustive-deps
  // warning on the two useMemo calls below.
  const items = useMemo(() => data?.items ?? [], [data])

  // Filter option lists come from the data already on hand, not a second
  // fetch — there is no "list of tracks" endpoint to call, and there does
  // not need to be one.
  const tracks = useMemo(
    () => Array.from(new Set(items.map(programTitle).filter((v): v is string => !!v))).sort(),
    [items],
  )
  const bootcamps = useMemo(
    () => Array.from(new Set(items.map(bootcampName).filter((v): v is string => !!v))).sort(),
    [items],
  )

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return items.filter((item) => {
      if (track !== ALL && programTitle(item) !== track) return false
      if (platform && bootcamp !== ALL && bootcampName(item) !== bootcamp) return false
      if (!term) return true
      const name = candidateName(item).toLowerCase()
      const code = candidateCode(item)?.toLowerCase() ?? ''
      return name.includes(term) || code.includes(term)
    })
  }, [items, track, bootcamp, platform, debouncedSearch])

  const exportRows = () => {
    const header = platform
      ? ['Name', 'Code', 'Bootcamp', 'Track', 'Completed', 'Score']
      : ['Name', 'Code', 'Track', 'Completed', 'Score']
    const rows = filtered.map((item) => {
      const when = timestamp(item)
      return [
        candidateName(item),
        candidateCode(item) ?? '',
        ...(platform ? [bootcampName(item) ?? ''] : []),
        programTitle(item) ?? '',
        when ? new Date(when).toLocaleDateString() : '',
        score(item)?.toString() ?? '',
      ]
    })
    // Exports exactly what's on screen — the current search/filter view, not
    // a separate unfiltered fetch. Matches the existing candidates-page export.
    downloadCsv(header, rows, `completed-interviews-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <StatCards stats={data?.stats} loading={initialLoading} />

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

      <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={items.length === 0 ? 'No completed interviews yet' : 'No matches'}
            description={
              items.length === 0
                ? 'Interviews appear here once a candidate finishes their AI screening.'
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
                      <TableHead>Candidate</TableHead>
                      <TableHead>Track</TableHead>
                      {platform && (
                        <TableHead className="hidden md:table-cell">Bootcamp</TableHead>
                      )}
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead className="w-12 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item, index) => {
                      const when = timestamp(item)
                      const value = score(item)
                      const eligible = canDecideStage(item)
                      const app = applicationInfo(item)

                      return (
                        <TableRow
                          key={recordId(item) ?? index}
                          className="transition-colors hover:bg-muted/40"
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{candidateName(item)}</span>
                              {candidateCode(item) && (
                                <span className="text-xs text-muted-foreground">
                                  {candidateCode(item)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {programTitle(item) ?? '—'}
                          </TableCell>
                          {platform && (
                            <TableCell className="hidden text-muted-foreground md:table-cell">
                              {bootcampName(item) ?? '—'}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <Badge
                                variant="outline"
                                className="w-fit bg-success/12 font-normal text-success"
                              >
                                Completed
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {when ? relativeTime(when) : '—'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <ScoreCell value={value} />
                          </TableCell>
                          <TableCell>
                            <DecisionCell eligible={eligible} stage={app?.stage ?? null} />
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Actions for ${candidateName(item)}`}
                                    disabled={advance.pending}
                                  />
                                }
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuGroup>
                                  <DropdownMenuLabel>
                                    {candidateCode(item) ?? candidateName(item)}
                                  </DropdownMenuLabel>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setOpen(item)}>
                                  <FileText className="size-4" />
                                  View full report
                                </DropdownMenuItem>
                                {eligible && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => void advance.run(item)}>
                                      <UserCheck className="size-4" />
                                      Advance to Physical Interview
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => rejectConfirm.ask(item)}
                                    >
                                      <UserX className="size-4" />
                                      Reject
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </AsyncSection>

      {advance.error && (
        <Alert variant="destructive">
          <AlertDescription>{advance.error}</AlertDescription>
        </Alert>
      )}

      <EvidenceDialog record={open} onClose={() => setOpen(null)} onChanged={refetch} />

      <ConfirmDialog
        open={rejectConfirm.open}
        onOpenChange={(next) => !next && rejectConfirm.close()}
        title="Reject this candidate?"
        description={
          rejectConfirm.target
            ? `${candidateName(rejectConfirm.target)}${
                candidateCode(rejectConfirm.target) ? ` (${candidateCode(rejectConfirm.target)})` : ''
              } will be moved to Rejected. This can be undone from the Candidates screen if needed.`
            : ''
        }
        confirmLabel="Reject"
        destructive
        pending={reject.pending}
        error={reject.error}
        onConfirm={() => void reject.run()}
      />
    </div>
  )
}

/* --------------------------------------------------------------- stats -- */

function StatCards({
  stats,
  loading,
}: {
  stats: CompletedInterviewStats | undefined
  loading: boolean
}) {
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
      <StatCard label="Total completed" value={stats.total} />
      <StatCard label="Completed today" value={stats.completed_today} />
      <StatCard label="Completed this week" value={stats.completed_this_week} />
      <StatCard
        label="Average score"
        value={stats.average_score}
        suffix={stats.average_score === null ? '' : '/100'}
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

/**
 * What has actually happened to this candidate's application, distinct from
 * the AI interview's own "Completed" status in the column beside it — a
 * candidate can be `eligible` (nothing decided yet) or already moved on by
 * an earlier action, and the two must not be conflated in one badge.
 */
function DecisionCell({
  eligible,
  stage,
}: {
  eligible: boolean
  stage: string | null
}) {
  if (eligible) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ChevronRight className="size-3" />
        Awaiting decision
      </span>
    )
  }
  if (stage === null) {
    // No application at all — a manual/Instructor invite row.
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const label = STAGE_LABEL[stage as ApplicationStage] ?? stage.replace(/_/g, ' ')
  const tone = stage === 'REJECTED' ? 'text-destructive' : 'text-muted-foreground'
  return <span className={cn('text-xs font-medium', tone)}>{label}</span>
}

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
