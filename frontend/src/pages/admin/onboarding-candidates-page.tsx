import {
  ChevronRight,
  Folder,
  FolderCheck,
  GraduationCap,
  Search,
  Send,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { agilyticsApi, onboardingApi } from '@/features/admin/api'
import { AgilyticsOnboardDialog } from '@/features/agilytics/onboard-dialog'
import { AgilyticsStatusBadge, agilyticsStateOf } from '@/features/agilytics/status-badge'
import {
  AsyncSection,
  BootcampSwitcher,
  BootcampGate,
  Pagination,
} from '@/features/admin/components'
import { useAsync } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { useDebounced } from '@/hooks/use-debounced'
import type { AgilyticsCandidateRow, OnboardingCandidateSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25

export default function AdminOnboardingCandidatesPage() {
  const { selected, selectedId, loading: bootcampLoading } = useBootcamp()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [inviteOpen, setInviteOpen] = useState(false)
  const debouncedSearch = useDebounced(search, 300)

  // One request for the whole page, not one per card. Reads our own
  // timestamp — no Agilytics call — which is what makes a per-card badge
  // affordable at all.
  const membership = useAsync(
    () => (selectedId ? agilyticsApi.eligible(selectedId) : Promise.resolve(undefined)),
    [selectedId],
  )

  const byApplication = useMemo(() => {
    const map = new Map<string, AgilyticsCandidateRow>()
    for (const row of [
      ...(membership.data?.new ?? []),
      ...(membership.data?.already_onboarded ?? []),
    ]) {
      map.set(row.application_id, row)
    }
    return map
  }, [membership.data])

  const { data, error, initialLoading, refetch } = useAsync(
    () =>
      selectedId
        ? onboardingApi.listCandidates(selectedId, {
            search: debouncedSearch || undefined,
            limit: PAGE_SIZE,
            offset,
          })
        : Promise.resolve(undefined),
    [selectedId, debouncedSearch, offset],
  )

  const rows = data?.items ?? []

  return (
    <>
      <PageHeader
        title="Onboarding"
        description={
          bootcampLoading
            ? undefined
            : selected
              ? `Candidates in ${selected.name} who have reached onboarding.`
              : 'Pick an intake to see its onboarding candidates.'
        }
        actions={
          <>
            <BootcampSwitcher />
            {selectedId && (
              <Button onClick={() => setInviteOpen(true)}>
                <Send className="size-4" />
                Onboard to Agilytics
              </Button>
            )}
          </>
        }
      />

      <BootcampGate icon={GraduationCap}>
        {(_selectedId) => (
          <div className="flex flex-col gap-4">
            <div className="relative max-w-md">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setOffset(0)
                }}
                placeholder="Search by candidate code or name (e.g. B08-017)"
                className="pl-9"
              />
            </div>

            <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
              {rows.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title={debouncedSearch ? 'No matches' : 'No candidates in onboarding yet'}
                  description={
                    debouncedSearch
                      ? 'Try a different search.'
                      : 'Candidates appear here once their Physical Interview is cleared.'
                  }
                />
              ) : (
                // Folders, one per candidate, named by their code. A reviewer
                // works this screen candidate-by-candidate — open a folder,
                // clear it, move on — and a table row is a poor affordance for
                // "there is a container here you go into".
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((row, index) => (
                    <CandidateFolder
                      key={row.application_id}
                      row={row}
                      index={index}
                      membership={byApplication.get(row.application_id)}
                      onOpen={() => navigate(`/admin/onboarding/${row.application_id}`)}
                    />
                  ))}
                </div>
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
      </BootcampGate>

      {selectedId && (
        <AgilyticsOnboardDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          bootcampId={selectedId}
          bootcampName={selected?.name}
          onOnboarded={() => {
            membership.refetch()
            // Onboarding advances candidates to ONBOARDED, so the list's own
            // rows change too, not just their badges.
            refetch()
          }}
        />
      )}
    </>
  )
}

function DocsSummary({ row }: { row: OnboardingCandidateSummary }) {
  if (!row.hub_unlocked) {
    return <span className="text-xs text-muted-foreground">Locked</span>
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">
        {row.documents_uploaded}/{row.documents_required} uploaded
      </span>
      {row.documents_approved > 0 && (
        <Badge variant="outline" className="border-success/40 text-success">
          {row.documents_approved} approved
        </Badge>
      )}
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

/**
 * One candidate's folder.
 *
 * The code is the name — that is how reviewers refer to candidates to each
 * other and what every email quotes — with the person's name underneath it
 * rather than the other way round.
 */
function CandidateFolder({
  row,
  index,
  membership,
  onOpen,
}: {
  row: OnboardingCandidateSummary
  index: number
  /** Undefined while the membership lookup is still in flight. */
  membership?: AgilyticsCandidateRow
  onOpen: () => void
}) {
  const formsDone = row.forms_submitted >= row.forms_total
  // "Nothing left to look at": every required document in and approved, and
  // the forms all submitted. The badge is the whole point of the grid — it is
  // what lets a reviewer skip a folder without opening it.
  const settled =
    formsDone && row.hub_unlocked && row.documents_pending === 0 && row.documents_rejected === 0

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${(0.03 + index * 0.04).toFixed(2)}s` }}
      className={cn(
        'stagger-rise group flex w-full flex-col gap-3 rounded-xl border-2 border-foreground/10 bg-card p-4 text-left',
        'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/10',
        settled ? 'hover:border-success' : 'hover:border-primary',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg transition-colors',
            settled
              ? 'bg-success/15 text-success group-hover:bg-success group-hover:text-success-foreground'
              : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
          )}
        >
          {settled ? <FolderCheck className="size-5" /> : <Folder className="size-5" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-sm font-semibold">{row.candidate_code}</span>
          <span className="truncate text-sm text-muted-foreground">{row.full_name ?? '—'}</span>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={formsDone ? 'default' : 'outline'} className="text-[0.68rem]">
          {row.forms_submitted}/{row.forms_total} forms
        </Badge>
        <DocsSummary row={row} />
      </div>

      {/* No per-card resend any more. Onboarding is a single irreversible
          event rather than an invitation that might need chasing, so the only
          action left is the bulk one in the header — and re-running it for
          somebody already in the workspace is refused, not repeated. */}
      {membership && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <AgilyticsStatusBadge state={agilyticsStateOf(membership)} />
          {membership.track_name && (
            <span className="text-[0.68rem] text-muted-foreground">{membership.track_name}</span>
          )}
        </div>
      )}
    </button>
  )
}
