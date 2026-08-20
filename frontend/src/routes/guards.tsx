import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

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

/** For /login and /signup: a signed-in user should not see them. */
export function GuestRoute() {
  const { profile, isLoading } = useAuth()

  if (isLoading) return <FullPageSpinner />
  if (profile) return <Navigate to={HOME_BY_ROLE[profile.role]} replace />
  return <Outlet />
}
