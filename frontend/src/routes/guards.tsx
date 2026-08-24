import { ArrowRight, ClipboardPen, Loader2 } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'

import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApplication } from '@/features/applications/application-context'
import { useAuth } from '@/hooks/use-auth'
import { HOME_BY_ROLE, type UserRole } from '@/lib/types'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  )
}

/** Requires a session. Remembers where the user was headed. */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return <Outlet />
}

/** Requires one of the given roles. Sends anyone else to their own home. */
export function RoleRoute({ allow }: { allow: UserRole[] }) {
  const { profile, isLoading } = useAuth()

  if (isLoading) return <FullPageSpinner />
  if (!profile) return <Navigate to="/login" replace />
  if (!allow.includes(profile.role)) return <Navigate to={HOME_BY_ROLE[profile.role]} replace />
  return <Outlet />
}

/**
 * Requires a submitted bootcamp application, not merely an account.
 *
 * Locking the sidebar row is not enough on its own — the URL is still typeable
 * and still bookmarkable, and behind it sit pages that would otherwise render
 * fixtures as though they were the user's own data.
 *
 * Explains rather than redirects. Bouncing somebody who followed a link from an
 * email to `/dashboard` with no word why is worse than telling them what the
 * page is and what unlocks it.
 */
export function RequiresApplication() {
  const { hasRegistered, initialLoading } = useApplication()

  // `initialLoading`, not `loading`: a refetch must not unmount the page this
  // guard wraps. Doing so would discard whatever state it holds — a
  // half-filled form, an upload in progress — for a request that was only ever
  // going to confirm what the guard already knew.
  if (initialLoading) {
    return (
      <>
        <PageHeader title="Loading" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </>
    )
  }

  if (!hasRegistered) {
    return (
      <>
        <PageHeader title="Not available yet" />
        <EmptyState
          icon={ClipboardPen}
          title="Available after you register"
          description="This page summarises a bootcamp application. You have an account, but you have not registered for a bootcamp yet — once you do, this unlocks."
          action={
            <Button render={<Link to="/dashboard" />}>
              Back to overview
              <ArrowRight className="size-4" />
            </Button>
          }
        />
      </>
    )
  }

  return <Outlet />
}

/** For /login and /signup: a signed-in user should not see them. */
export function GuestRoute() {
  const { profile, isLoading } = useAuth()

  if (isLoading) return <FullPageSpinner />
  if (profile) return <Navigate to={HOME_BY_ROLE[profile.role]} replace />
  return <Outlet />
}
