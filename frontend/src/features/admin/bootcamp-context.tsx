/**
 * The intake every admin screen is scoped to.
 *
 * Candidates, interviews, phases, and emails are all "within one bootcamp",
 * so the selection is held once here rather than being a URL parameter
 * repeated across five routes. The choice survives reloads because an admin
 * works the same intake for weeks at a time.
 */

import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react'

import { bootcampApi } from '@/features/admin/api'
import { useAsync } from '@/hooks/use-async'
import type { Bootcamp } from '@/lib/types'

const STORAGE_KEY = 'sit-a2o.admin.bootcamp'

interface BootcampContextValue {
  bootcamps: Bootcamp[]
  selected: Bootcamp | undefined
  selectedId: string | undefined
  select: (id: string) => void
  loading: boolean
  error: string | null
  /** Re-reads the list; call after creating or deleting an intake. */
  refresh: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const BootcampContext = createContext<BootcampContextValue | null>(null)

export function BootcampProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, refetch } = useAsync(() => bootcampApi.list(), [])
  const [storedId, setStoredId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  )

  const bootcamps = useMemo(() => data ?? [], [data])

  // Fall back to the newest intake when nothing is stored, or when the stored
  // one has been deleted or unassigned from this admin since last visit.
  //
  // Derived during render rather than written back through an effect: the
  // fallback is recomputed correctly on every load anyway, so persisting it
  // would buy nothing and cost an extra render pass.
  const selected = useMemo(() => {
    if (bootcamps.length === 0) return undefined
    return bootcamps.find((b) => b.id === storedId) ?? bootcamps[0]
  }, [bootcamps, storedId])

  const select = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setStoredId(id)
  }, [])

  const value = useMemo(
    () => ({
      bootcamps,
      selected,
      selectedId: selected?.id,
      select,
      loading,
      error,
      refresh: refetch,
    }),
    [bootcamps, selected, select, loading, error, refetch],
  )

  return <BootcampContext.Provider value={value}>{children}</BootcampContext.Provider>
}
