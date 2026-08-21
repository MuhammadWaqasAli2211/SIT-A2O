import { useEffect, useState } from 'react'

/**
 * Delays a fast-changing value so it can be used as a fetch dependency.
 *
 * Search boxes are the reason this exists: without it, every keystroke in the
 * candidate filter fires a request, and the responses can land out of order.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return settled
}
