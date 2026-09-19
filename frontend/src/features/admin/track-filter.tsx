/**
 * The "Track" filter — one dropdown, reused on every admin screen that
 * lists candidates (Candidates, HR Assessment, Onboarding), so filtering by
 * program looks and behaves the same wherever it appears rather than each
 * screen growing its own select.
 *
 * Options come from `programApi.listPublic()`, the same list every other
 * program-choosing control in the admin portal already reads — not a
 * hardcoded four-track list, so a program added or renamed shows up here
 * without a second place to update.
 */

import { Filter } from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { programApi } from '@/features/admin/api'
import { useAsync } from '@/hooks/use-async'

/** Sentinel for "no filter" — Select needs a real value, not undefined. */
export const ALL_TRACKS = 'ALL'

export function TrackFilter({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (programId: string) => void
  className?: string
}) {
  const { data } = useAsync(() => programApi.listPublic(), [])
  const programs = data ?? []

  // Select.Value shows the raw `value` unless told how to turn it into a
  // label — discovered against this exact component, where "ALL" was
  // rendering on the trigger instead of "All tracks" even after the popup
  // had been opened once. `children` as a render function is Base UI's own
  // documented fix for that.
  const labelFor = (raw: string) =>
    raw === ALL_TRACKS ? 'All tracks' : (programs.find((p) => p.id === raw)?.title ?? raw)

  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger className={className ?? 'w-[200px]'} aria-label="Filter by track">
        <Filter className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="All tracks">{labelFor}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_TRACKS}>All tracks</SelectItem>
        {programs.map((program) => (
          <SelectItem key={program.id} value={program.id}>
            {program.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
