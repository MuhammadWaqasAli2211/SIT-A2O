import * as React from "react"

/**
 * Two-layer draft persistence for a long paper-form replica.
 *
 * Layer 1, local: every change lands in localStorage after a short idle
 * pause, and is restored on mount. This is what actually protects a
 * candidate from an accidental reload today.
 *
 * Layer 2, backend: `saveDraft` is called periodically and is a no-op stub
 * for now — there is no draft-persistence endpoint yet, and this task is
 * explicitly UI-only. It is still called on the same schedule a real
 * endpoint would use, so wiring one in later is a one-line change inside
 * this hook (replace the body of `saveDraft`), not a call-site hunt through
 * the form component.
 */
export function useDraftAutosave<T>({
  key,
  value,
  onRestore,
  localDelayMs = 1500,
  backendIntervalMs = 30_000,
}: {
  key: string
  value: T
  onRestore: (restored: T) => void
  localDelayMs?: number
  backendIntervalMs?: number
}) {
  const [savedAt, setSavedAt] = React.useState<number | null>(null)
  const restored = React.useRef(false)
  const latestValue = React.useRef(value)
  latestValue.current = value

  // Restore once, before the first autosave can overwrite the draft with the
  // form's blank initial state.
  React.useEffect(() => {
    if (restored.current) return
    restored.current = true
    try {
      const raw = localStorage.getItem(key)
      if (raw) onRestore(JSON.parse(raw) as T)
      // eslint-disable-next-line no-empty
    } catch {
      // A corrupted or foreign draft is not worth surfacing as an error —
      // the form just starts blank, same as a first-time visit.
    }
    // onRestore intentionally excluded: it is the setter from the calling
    // component's own useState and is expected to be stable enough not to
    // need re-running this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
        setSavedAt(Date.now())
        // eslint-disable-next-line no-empty
      } catch {
        // Storage can be full or disabled (private browsing); the draft
        // simply is not saved this round. Nothing for the candidate to act
        // on, so this fails silently rather than as a visible error.
      }
    }, localDelayMs)
    return () => window.clearTimeout(timer)
  }, [key, value, localDelayMs])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      saveDraft(key, latestValue.current)
    }, backendIntervalMs)
    return () => window.clearInterval(interval)
  }, [key, backendIntervalMs])

  const clearDraft = React.useCallback(() => {
    localStorage.removeItem(key)
    setSavedAt(null)
  }, [key])

  return { savedAt, clearDraft }
}

/**
 * Stub. Replace this body with a real API call when a draft-persistence
 * endpoint exists — every call site already goes through here, via
 * useDraftAutosave, so nothing outside this function needs to change.
 */
function saveDraft<T>(key: string, value: T): void {
  console.debug("[draft] would save to backend", key, value)
}
