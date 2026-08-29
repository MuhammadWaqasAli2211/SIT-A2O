/**
 * A value kept current while somebody is actually looking at it.
 *
 * Today this is adaptive polling: fast while the tab is visible, slow when it
 * is not, stopped entirely when the screen is unmounted. That is deliberately
 * behind a narrow contract — `subscribe(fetch, onData)` — so replacing the
 * transport with Supabase Realtime later is a change to this file rather than
 * to every screen that uses it (decided 2026-08-29: polling now, realtime
 * later).
 *
 * Why adaptive rather than a flat short interval: a 3-second poll left running
 * in a background tab is 1,200 requests an hour per idle admin, all of them
 * answering a question nobody is currently asking. The Page Visibility API
 * makes the difference between "watching" and "left open" observable, so the
 * fast rate is only paid while it buys something.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface LiveOptions {
  /** How often to refresh while the tab is visible. */
  activeMs?: number
  /** How often while hidden. Set to 0 to stop entirely until it returns. */
  hiddenMs?: number
  /** Skip everything — for a screen whose prerequisites are not met yet. */
  enabled?: boolean
}

export interface LiveResource<T> {
  data: T | undefined
  /** True until the first response, whether it succeeds or fails. */
  initialLoading: boolean
  error: string | null
  /** When the last successful refresh landed. Drives the live indicator. */
  lastUpdated: Date | null
  /** Whether the fast cadence is currently running. */
  live: boolean
  /** Force a refresh now, e.g. after the user acts on the thing being watched. */
  refresh: () => void
}

const DEFAULT_ACTIVE_MS = 3_000
const DEFAULT_HIDDEN_MS = 30_000

function isVisible(): boolean {
  // Guarded: this runs in environments (tests, SSR) with no document.
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

export function useLiveResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  { activeMs = DEFAULT_ACTIVE_MS, hiddenMs = DEFAULT_HIDDEN_MS, enabled = true }: LiveOptions = {},
): LiveResource<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [settled, setSettled] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [live, setLive] = useState(() => enabled && isVisible())

  // The fetcher identity changes every render at most call sites; holding it
  // in a ref keeps the polling effect keyed on `deps` alone rather than
  // restarting the timer on every parent render.
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setSettled(true)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const next = await fetcherRef.current()
        if (cancelled) return
        setData(next)
        setError(null)
        setLastUpdated(new Date())
      } catch (err: unknown) {
        // A failed poll keeps the previous value on screen rather than
        // blanking it: a transient error should not make a working dashboard
        // look empty. The error is surfaced, the stale data stays readable.
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not refresh.')
      } finally {
        if (!cancelled) setSettled(true)
      }

      if (cancelled) return
      const visible = isVisible()
      setLive(visible)
      const wait = visible ? activeMs : hiddenMs
      // hiddenMs of 0 means "stop until the tab comes back", which the
      // visibilitychange listener below restarts.
      if (wait > 0) timer = setTimeout(tick, wait)
    }

    void tick()

    const onVisibility = () => {
      // Coming back to the tab refreshes immediately rather than waiting out
      // whatever remained of the slow interval — the moment someone looks is
      // exactly when staleness is most visible.
      if (isVisible()) {
        if (timer) clearTimeout(timer)
        void tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled, activeMs, hiddenMs])

  return { data, initialLoading: !settled, error, lastUpdated, live, refresh }
}
