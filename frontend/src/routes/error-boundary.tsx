/**
 * Route-level error boundary.
 *
 * Attached as `errorElement` on each top-level branch, so a crash inside the
 * admin section renders here instead of white-screening the whole app — which
 * is exactly what the Base UI menu-group crash used to do.
 *
 * React Router catches both thrown render errors and loader/action failures;
 * `useRouteError` returns whatever was thrown, which is why the shape has to
 * be narrowed rather than assumed to be an Error.
 */

import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { isRouteErrorResponse, Link, useNavigate, useRouteError } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { HOME_BY_ROLE } from '@/lib/types'

function describe(error: unknown): { title: string; detail: string } {
  if (isRouteErrorResponse(error)) {
    return {
      title: error.status === 404 ? 'Page not found' : `${error.status} ${error.statusText}`,
      detail:
        error.status === 404
          ? 'That page does not exist, or it moved.'
          : String(error.data ?? 'The page could not be loaded.'),
    }
  }
  if (error instanceof Error) {
    return { title: 'Something broke on this page', detail: error.message }
  }
  return {
    title: 'Something broke on this page',
    detail: 'An unexpected error occurred.',
  }
}

export function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { title, detail } = describe(error)

  // Logged so the stack is still reachable in the console — the boundary
  // stops the crash from propagating, it should not hide the cause.
  if (import.meta.env.DEV) console.error('Route error:', error)

  const home = profile ? HOME_BY_ROLE[profile.role] : '/'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{detail}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {/* navigate(0) reloads the route rather than the document, so the
            session in memory survives a transient render failure. */}
        <Button onClick={() => navigate(0)}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
        <Link to={home} className={buttonVariants({ variant: 'outline' })}>
          <Home className="size-4" />
          Back to safety
        </Link>
      </div>
    </div>
  )
}
