/**
 * One answer to "has this user registered for a bootcamp?", shared portal-wide.
 *
 * Signing up creates a **User**. Registering creates an **Application**. Only
 * the second makes somebody a candidate, and almost every portal surface needs
 * to know which of the two they are: the sidebar to decide what to lock, the
 * dashboard to decide which state to render, the route guards to decide what to
 * admit.
 *
 * Held in context rather than called per-consumer because `useMyApplication()`
 * fetches on mount — three consumers would mean three identical requests and
 * three chances to disagree with each other mid-flight.
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react'

import {
  useMyApplication,
  type MyApplicationState,
} from '@/features/applications/use-my-application'
import { useAuth } from '@/hooks/use-auth'
import { UserRole } from '@/lib/types'

export interface ApplicationContextValue extends MyApplicationState {
  /**
   * Whether the user has registered for a bootcamp.
   *
   * False while loading, deliberately. Locked-then-unlocked is a brief,
   * recoverable inaccuracy; unlocked-then-locked flashes doors open that the
   * user cannot walk through, which reads as a bug.
   */
  hasRegistered: boolean
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null)

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const isCandidate = profile?.role === UserRole.CANDIDATE

  // Only candidates have applications, and `/applications/mine` rejects
  // everyone else. Admins share this layout, so the fetch is gated by role
  // rather than by which routes happen to be mounted.
  const state = useMyApplication({ enabled: isCandidate })

  // Kept current in the background.
  //
  // This is the single source of truth for the candidate's stage — the
  // tracker, the journey stepper, the interview screen and the locked nav
  // rows all read it from here. Fetching once on mount meant an admin
  // advancing somebody left every one of those screens showing the old stage
  // until the candidate happened to reload, which is exactly the stale-copy
  // problem: one read, many screens, so it is fixed once here rather than
  // patched in each of them.
  //
  // Deliberately slow, and only while the tab is visible. A candidate's own
  // stage changes a handful of times over weeks; this is here so the change
  // arrives without a reload, not to track a fast-moving value.
  const reload = state.reload
  useEffect(() => {
    if (!isCandidate) return

    const tick = () => {
      // `reload()` raises `loading` but never `initialLoading`, so a
      // background refresh cannot re-lock navigation or unmount a form
      // mid-use — the distinction these two flags exist for.
      if (document.visibilityState === 'visible') reload()
    }
    const timer = setInterval(tick, 45_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [isCandidate, reload])

  return (
    <ApplicationContext
      value={{
        // Keyed on `initialLoading`: once the first fetch has settled the
        // answer is known, and a later refetch must not momentarily re-lock
        // navigation the candidate is already using.
        ...state,
        hasRegistered: !state.initialLoading && state.application !== null,
      }}
    >
      {children}
    </ApplicationContext>
  )
}

export function useApplication(): ApplicationContextValue {
  const value = useContext(ApplicationContext)
  if (!value) {
    throw new Error('useApplication must be used inside <ApplicationProvider>')
  }
  return value
}
