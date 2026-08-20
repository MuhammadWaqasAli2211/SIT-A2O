/**
 * Loads what the candidate dashboard needs to decide which state to render.
 *
 * Both requests are issued together and settled independently: an applicant
 * with a live application must still see it when `/bootcamps/open` fails, and
 * somebody with no application must still see what is open when
 * `/applications/mine` fails. `Promise.all` would couple the two.
 */

import { useCallback, useEffect, useState } from 'react'

import { toErrorMessage } from '@/lib/api-client'
import {
  applicationsApi,
  type ApplicationDetail,
  type OpenBootcamp,
} from '@/features/applications/api'

export interface MyApplicationState {
  /** The application to display, or null when the candidate has not applied. */
  application: ApplicationDetail | null
  /** Every application, newest first — a candidate may apply to several intakes. */
  applications: ApplicationDetail[]
  openBootcamps: OpenBootcamp[]
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * An ACTIVE application outranks a closed one regardless of age: a candidate
 * rejected from Bootcamp 6 who has since applied to Bootcamp 7 should land on
 * the live one. The list arrives newest-first, so the first ACTIVE match is
 * also the most recent.
 */
function pickPrimary(list: readonly ApplicationDetail[]): ApplicationDetail | null {
  return list.find((a) => a.status === 'ACTIVE') ?? list[0] ?? null
}

export interface UseMyApplicationOptions {
  /**
   * Skip fetching entirely. `/applications/mine` is candidate-only, so an
   * admin loading the portal would otherwise fire a request guaranteed to 403.
   * Disabled settles immediately rather than staying stuck on `loading`.
   */
  enabled?: boolean
}

export function useMyApplication({
  enabled = true,
}: UseMyApplicationOptions = {}): MyApplicationState {
  const [applications, setApplications] = useState<ApplicationDetail[]>([])
  const [openBootcamps, setOpenBootcamps] = useState<OpenBootcamp[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  // Both flags move here rather than at the top of the effect: `loading`
  // already starts true, so the only moment it needs re-raising is the one
  // that triggers a refetch.
  const reload = useCallback(() => {
    setLoading(true)
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    Promise.allSettled([applicationsApi.mine(), applicationsApi.openBootcamps()]).then(
      ([mine, open]) => {
        if (cancelled) return

        if (mine.status === 'fulfilled') {
          setApplications(mine.value)
        }
        if (open.status === 'fulfilled') {
          setOpenBootcamps(open.value)
        }

        // Only surface an error when the whole page would be empty anyway.
        // A failed open-bootcamps call behind a live application is not worth
        // an alert the candidate can do nothing about.
        const fatal = mine.status === 'rejected' && open.status === 'rejected'
        setError(
          fatal
            ? toErrorMessage(mine.reason, 'Could not load your application.')
            : null,
        )
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [nonce, enabled])

  return {
    application: pickPrimary(applications),
    applications,
    openBootcamps,
    loading,
    error,
    reload,
  }
}
