import {
  ChevronRight,
  Download,
  MoreHorizontal,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, PageHeader, StageBadge } from '@/components/shared/portal-ui'
import { applicationApi } from '@/features/admin/api'
import {
  AsyncSection,
  BootcampSwitcher,
  ConfirmDialog,
  NoBootcampSelected,
  Pagination,
  useConfirm,
} from '@/features/admin/components'
import { CandidateSheet } from '@/pages/admin/candidate-sheet'
import { LiveIndicator } from '@/features/live/live-indicator'
import { useLiveResource } from '@/features/live/use-live-resource'
import { useMutation } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { useDebounced } from '@/hooks/use-debounced'
import { downloadCsv } from '@/lib/csv-export'
import {
  ApplicationStage,
  STAGE_LABEL,
  STAGE_ORDER,
  type ApplicantRow,
} from '@/lib/types'

const PAGE_SIZE = 25
/** Sentinel for the filter's "no filter" option — Select needs a real value. */
const ALL = 'ALL'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Client-side CSV of the current page, for the spreadsheet workflows admins keep. */
function exportCsv(rows: ApplicantRow[], filename: string) {
  const header = ['Code', 'Name', 'Email', 'Program', 'Stage', 'Status', 'Applied']
  const body = rows.map((row) => [
    row.candidate_code,
    row.full_name ?? '',
    row.email,
    row.program_title,
    STAGE_LABEL[row.stage],
    row.status,
    formatDate(row.applied_at),
  ])
  downloadCsv(header, body, filename)
}

export default function AdminCandidatesPage() {
  const { selected, selectedId } = useBootcamp()

  const [search, setSearch] = useState('')
  const [stage, setStage] = useState<string>(ALL)
  const [offset, setOffset] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  // Debounced so typing a name does not fire a request per keystroke.
  const debouncedSearch = useDebounced(search, 300)

  // Live rather than a one-shot fetch: a stage change made anywhere else (the
  // candidate sheet here, or the AI interview report screen) has no shared
  // cache to invalidate, so this screen needs to notice on its own. Backs off
  // on its own when the tab is hidden, same contract as the AI Interviews
  // screen.
  const { data, error, initialLoading, lastUpdated, live, refresh } = useLiveResource(
    () =>
      selectedId
        ? applicationApi.listForBootcamp(selectedId, {
            stage: stage === ALL ? undefined : (stage as ApplicationStage),
            search: debouncedSearch || undefined,
            limit: PAGE_SIZE,
            offset,
          })
        : Promise.resolve(undefined),
    [selectedId, stage, debouncedSearch, offset],
  )

  const rows = useMemo(() => data?.items ?? [], [data])
  const remove = useConfirm<ApplicantRow>()

  const deleteMutation = useMutation(async (row: ApplicantRow) => {
    await applicationApi.remove(row.id)
    return row
  })

  async function confirmDelete() {
    if (!remove.target) return
    const done = await deleteMutation.run(remove.target)
    if (done) {
      toast.success(`Deleted ${done.candidate_code}`)
      remove.close()
      refresh()
    }
  }

  /** Reset to the first page whenever a filter narrows the result set. */
  function changeFilter(next: () => void) {
    next()
    setOffset(0)
  }

  return (
    <>
      <PageHeader
        title="Candidates"
        description={
          selected
            ? `Applicants to ${selected.name}.`
            : 'Pick an intake to see its applicants.'
        }
        actions={
          <>
            <BootcampSwitcher />
            <Button
              variant="outline"
              onClick={() =>
                exportCsv(rows, `${selected?.name ?? 'candidates'}-page.csv`.replace(/\s+/g, '-'))
              }
              disabled={rows.length === 0}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          </>
        }
      />

      {!selectedId ? (
        <NoBootcampSelected icon={Users} />
      ) : (
        <div className="flex flex-col gap-4">
          <LiveIndicator lastUpdated={lastUpdated} live={live} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => changeFilter(() => setSearch(event.target.value))}
                placeholder="Search by name, email, or candidate code"
                className="pl-9"
              />
            </div>

            <Select
              value={stage}
              onValueChange={(value) => value && changeFilter(() => setStage(value))}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All stages</SelectItem>
                {STAGE_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STAGE_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AsyncSection initialLoading={initialLoading} error={error} onRetry={refresh}>
            {rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title={debouncedSearch || stage !== ALL ? 'No matches' : 'No applicants yet'}
                description={
                  debouncedSearch || stage !== ALL
                    ? 'Try a different search or stage filter.'
                    : 'Applicants appear here as soon as registration opens and people apply.'
                }
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead className="hidden md:table-cell">Program</TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead className="hidden lg:table-cell">Applied</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="cursor-pointer"
                            onClick={() => setOpenId(row.id)}
                          >
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {row.candidate_code}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{row.full_name ?? '—'}</span>
                                <span className="text-xs text-muted-foreground">{row.email}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {row.program_title}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <StageBadge stage={row.stage} />
                                {row.status !== 'ACTIVE' && (
                                  <Badge variant="outline" className="text-[0.7rem] font-normal">
                                    {row.status}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(row.applied_at)}
                            </TableCell>
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <RowActions
                                row={row}
                                onOpen={() => setOpenId(row.id)}
                                onDelete={() => remove.ask(row)}
                              />
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

      <CandidateSheet
        applicationId={openId}
        onClose={() => setOpenId(null)}
        onChanged={refresh}
      />

      <ConfirmDialog
        open={remove.open}
        onOpenChange={(open) => !open && remove.close()}
        title="Delete this application?"
        description={
          <>
            {remove.target?.candidate_code} — {remove.target?.full_name ?? remove.target?.email}.
            This removes the application and its entire stage history. The candidate code is not
            reused, and the person cannot reapply to this intake. Deactivate instead if you only
            want to stop the process.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        pending={deleteMutation.pending}
        error={deleteMutation.error}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function RowActions({
  row,
  onOpen,
  onDelete,
}: {
  row: ApplicantRow
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Actions for ${row.candidate_code}`} />
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
        <DropdownMenuItem onClick={onOpen}>
          <ChevronRight className="size-4" />
          Open record
        </DropdownMenuItem>
        {row.status !== 'ACTIVE' && (
          <DropdownMenuItem onClick={onOpen}>
            <RotateCcw className="size-4" />
            Reinstate
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
