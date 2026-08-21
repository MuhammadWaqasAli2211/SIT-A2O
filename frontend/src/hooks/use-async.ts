/**
 * Minimal data fetching, in place of a query library.
 *
 * The project has no react-query, and adding one for five screens would be a
 * heavier dependency than the problem warrants. This covers what those screens
 * actually need: loading and error state, refetch, and cancellation of results
 * that arrive after the inputs have moved on.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { toErrorMessage } from '@/lib/api-client'

export interface AsyncState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  /** True only for the first load, so a refresh does not blank the screen. */
  initialLoading: boolean
  refetch: () => void
}

/**
 * Runs `fetcher` on mount and whenever `deps` change.
 *
 * `deps` is the dependency array, passed explicitly rather than inferred:
 * callers build the fetcher inline, so a new function identity every render
 * would otherwise loop forever.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const hasLoaded = useRef(false)
  // Kept in a ref so changing the fetcher identity does not itself retrigger
  // the effect — `deps` is the only thing that should.
  //
  // Assigned in an effect rather than during render: writing a ref while
  // rendering is unsafe under concurrent rendering, where a render can be
  // discarded. Declared *before* the fetching effect so it always runs first
  // and the fetcher is current by the time the fetch fires.
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(toErrorMessage(err))
      })
      .finally(() => {
        if (cancelled) return
        hasLoaded.current = true
        setLoading(false)
      })

    // A stale response must not overwrite a newer one when filters change fast.
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const refetch = useCallback(() => setNonce((n) => n + 1), [])

  return { data, error, loading, initialLoading: loading && !hasLoaded.current, refetch }
}

/**
 * Wraps a mutation with pending state and error capture.
 *
 * Returns the result on success and `undefined` on failure, so callers can
 * branch without a try/catch at every call site.
 */
export function useMutation<Args extends unknown[], T>(
  action: (...args: Args) => Promise<T>,
): {
  run: (...args: Args) => Promise<T | undefined>
  pending: boolean
  error: string | null
  reset: () => void
} {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Same reasoning as useAsync: ref writes belong in an effect, not in render.
  const actionRef = useRef(action)
  useEffect(() => {
    actionRef.current = action
  })

  const run = useCallback(async (...args: Args) => {
    setPending(true)
    setError(null)
    try {
      return await actionRef.current(...args)
    } catch (err: unknown) {
      setError(toErrorMessage(err))
      return undefined
    } finally {
      setPending(false)
    }
  }, [])

  return { run, pending, error, reset: useCallback(() => setError(null), []) }
}
