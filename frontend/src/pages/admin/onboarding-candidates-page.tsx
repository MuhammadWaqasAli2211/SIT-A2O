import { ChevronRight, GraduationCap, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { onboardingApi } from '@/features/admin/api'
import { AsyncSection, BootcampSwitcher, NoBootcampSelected, Pagination } from '@/features/admin/components'
import { useAsync } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { useDebounced } from '@/hooks/use-debounced'
import type { OnboardingCandidateSummary } from '@/lib/types'

const PAGE_SIZE = 25

export default function AdminOnboardingCandidatesPage() {
  const { selected, selectedId } = useBootcamp()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const debouncedSearch = useDebounced(search, 300)

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
          selected
            ? `Candidates in ${selected.name} who have reached onboarding.`
            : 'Pick an intake to see its onboarding candidates.'
        }
        actions={<BootcampSwitcher />}
      />

      {!selectedId ? (
        <NoBootcampSelected icon={GraduationCap} />
      ) : (
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
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Forms</TableHead>
                          <TableHead>Documents</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow
                            key={row.application_id}
                            className="cursor-pointer"
                            onClick={() => navigate(`/admin/onboarding/${row.application_id}`)}
                          >
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {row.candidate_code}
                            </TableCell>
                            <TableCell className="font-medium">{row.full_name ?? '—'}</TableCell>
                            <TableCell>
                              <Badge variant={row.forms_submitted === row.forms_total ? 'default' : 'outline'}>
                                {row.forms_submitted}/{row.forms_total} forms
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DocsSummary row={row} />
                            </TableCell>
                            <TableCell>
                              <ChevronRight className="size-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {data && <Pagination total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />}
          </AsyncSection>
        </div>
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
