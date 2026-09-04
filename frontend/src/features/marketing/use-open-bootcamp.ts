/**
 * The intake the marketing site is currently promoting.
 *
 * Reads `/bootcamps/open`, which is public and unauthenticated precisely so
 * the marketing site can ask this question — it is the same endpoint the
 * registration flow and the registration-closed dialog already trust, and it
 * is filtered server-side by `is_phase_open()` (the REGISTRATION flag *and*
 * the clock against opens_at / deadline_at). So a badge driven by this cannot
 * claim admissions are open when `assert_phase_open()` would reject the
 * application, which is exactly the drift a hardcoded "Bootcamp 07" string
 * produces the moment intake 08 opens.
 *
 * Failure is not an error state here. If the call fails or nothing is open,
 * the hook reports "no intake" and the badge simply does not render — a
 * marketing page must not show an error banner because a decorative pill
 * could not resolve.
 */

import { useEffect, useState } from 'react'

import { candidateApi } from '@/features/candidate/api'
import type { PublicBootcamp } from '@/lib/types'

export interface OpenBootcampState {
  /** The intake to promote, or null when none is open (or the call failed). */
  bootcamp: PublicBootcamp | null
  /** True until the first settle, so callers can hold back a layout shift. */
  loading: boolean
}

/**
 * One shared request per five minutes, not one per component that asks.
 *
 * Two things mount this hook on the home page alone — the hero badge and the
 * footer's status line — and every client-side navigation back to a marketing
 * page mounts them again. Without this, that is a fresh `/bootcamps/open` call
 * per mount for an answer that changes on a day scale.
 *
 * The promise is cached rather than the value, so simultaneous mounts share
 * one in-flight request instead of racing two.
 *
 * Staleness is safe here by construction: this drives display only, and the
 * server re-checks the phase window with `assert_phase_open()` when an
 * application is actually submitted. A five-minute-old badge cannot let
 * anything through that the server would reject.
 */
const CACHE_MS = 5 * 60 * 1000
let cached: { at: number; promise: Promise<PublicBootcamp | null> } | null = null

function fetchOpenBootcamp(): Promise<PublicBootcamp | null> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_MS) return cached.promise

  const promise = candidateApi
    .openBootcamps()
    // One intake is open at a time in practice; the first is the one being
    // promoted. Matches how registration-form.tsx picks `openBootcamps[0]`.
    .then((list) => list[0] ?? null)
    .catch(() => {
      // Deliberately swallowed — see the note at the top of the file. The
      // failure is not cached: dropping it lets the next mount retry rather
      // than pinning a network blip for five minutes.
      cached = null
      return null
    })

  cached = { at: now, promise }
  return promise
}

export function useOpenBootcamp(): OpenBootcampState {
  const [bootcamp, setBootcamp] = useState<PublicBootcamp | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchOpenBootcamp()
      .then((result) => {
        if (!cancelled) setBootcamp(result)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { bootcamp, loading }
}

/** "Bootcamp 07" — the intake's public label, zero-padded like the reference. */
export function bootcampLabel(bootcamp: PublicBootcamp): string {
  return `Bootcamp ${String(bootcamp.bootcamp_number).padStart(2, '0')}`
}
