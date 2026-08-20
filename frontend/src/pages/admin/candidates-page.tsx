import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUpDown,
  CheckCircle2,
  Download,
  Mail,
  Search,
  SlidersHorizontal,
  UserX,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState, PageHeader, StageBadge } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CANDIDATES, STAGE_LABEL, type ApplicationStage } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const STAGE_FILTERS: (ApplicationStage | 'ALL')[] = [
  'ALL',
  'APPLIED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'ASSESSMENT',
  'FORM_PENDING',
  'ONBOARDED',
  'REJECTED',
]

type SortKey = 'code' | 'name' | 'score' | 'appliedAt'
const PAGE_SIZE = 12

export default function AdminCandidatesPage() {
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState<ApplicationStage | 'ALL'>('ALL')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'code',
    dir: 'asc',
  })
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const rows = CANDIDATES.filter((c) => {
      const matchesStage = stage === 'ALL' || c.stage === stage
      const matchesQuery =
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        c.code.toLowerCase().includes(needle) ||
        c.email.toLowerCase().includes(needle)
      return matchesStage && matchesQuery
    })

    return [...rows].sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1
      if (sort.key === 'score') return ((a.score ?? -1) - (b.score ?? -1)) * dir
      return String(a[sort.key]).localeCompare(String(b[sort.key])) * dir
    })
  }, [query, stage, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.id))

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visible.forEach((c) => next.delete(c.id))
      else visible.forEach((c) => next.add(c.id))
      return next
    })
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const changeSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  return (
    <>
      <PageHeader
        title="Candidates"
        description={`${filtered.length} of ${CANDIDATES.length} applications`}
        actions={
          <>
            <Button variant="outline">
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button variant="outline">
              <SlidersHorizontal className="size-4" />
              Filters
            </Button>
          </>
        }
      />

      {/* Search + stage filter */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-5 flex flex-col gap-4"
      >
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Search by name, code, or email..."
            aria-label="Search candidates"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STAGE_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setStage(option)
                setPage(0)
              }}
              aria-pressed={stage === option}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
                stage === option
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {option === 'ALL' ? 'All stages' : STAGE_LABEL[option]}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-primary" />
                {selected.size} selected
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline">
                  <Mail className="size-3.5" />
                  Email selected
                </Button>
                <Button size="sm">
                  <CheckCircle2 className="size-3.5" />
                  Advance stage
                </Button>
                <Button size="sm" variant="destructive">
                  <UserX className="size-3.5" />
                  Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.06 }}
      >
        <Card>
          <CardContent className="p-0">
            {visible.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Users}
                  title="No candidates match these filters"
                  description="Try a different search term or clear the stage filter."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery('')
                        setStage('ALL')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAll}
                          aria-label="Select all rows on this page"
                          className="size-4 cursor-pointer accent-[var(--color-primary)]"
                        />
                      </TableHead>
                      <SortableHead label="Code" sortKey="code" sort={sort} onSort={changeSort} />
                      <SortableHead label="Candidate" sortKey="name" sort={sort} onSort={changeSort} />
                      <TableHead>Program</TableHead>
                      <TableHead>Stage</TableHead>
                      <SortableHead label="Score" sortKey="score" sort={sort} onSort={changeSort} />
                      <TableHead>City</TableHead>
                      <SortableHead label="Applied" sortKey="appliedAt" sort={sort} onSort={changeSort} />
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {visible.map((candidate, index) => (
                      <motion.tr
                        key={candidate.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25, delay: index * 0.025 }}
                        className={cn(
                          'border-b border-border transition-colors last:border-0 hover:bg-muted/50',
                          selected.has(candidate.id) && 'bg-primary/5',
                        )}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selected.has(candidate.id)}
                            onChange={() => toggleOne(candidate.id)}
                            aria-label={`Select ${candidate.name}`}
                            className="size-4 cursor-pointer accent-[var(--color-primary)]"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">
                          {candidate.code}
                        </TableCell>
                        <TableCell>
                          <span className="flex flex-col">
                            <span className="text-sm font-medium">{candidate.name}</span>
                            <span className="text-xs text-muted-foreground">{candidate.email}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {candidate.program}
                        </TableCell>
                        <TableCell>
                          <StageBadge stage={candidate.stage} />
                        </TableCell>
                        <TableCell>
                          {candidate.score === null ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <Badge
                              variant={candidate.score >= 65 ? 'secondary' : 'outline'}
                              className="tabular-nums"
                            >
                              {candidate.score.toFixed(1)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {candidate.city}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                          {new Date(candidate.appliedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pagination */}
      {visible.length > 0 && (
        <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Showing {safePage * PAGE_SIZE + 1}–
            {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              Page {safePage + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (key: SortKey) => void
}) {
  const active = sort.key === sortKey

  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'flex items-center gap-1.5 transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        <ArrowUpDown
          className={cn(
            'size-3 transition-transform duration-200',
            active && sort.dir === 'desc' && 'rotate-180',
            !active && 'opacity-40',
          )}
        />
      </button>
    </TableHead>
  )
}
