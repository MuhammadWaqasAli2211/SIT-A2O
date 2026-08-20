/**
 * Catches render-time errors and shows a fallback instead of a blank page.
 *
 * A class component because there is no hook equivalent: `componentDidCatch`
 * and `getDerivedStateFromError` are the only APIs React exposes for this, and
 * neither has a function-component counterpart.
 *
 * What it does not catch, so nobody assumes otherwise: errors in event
 * handlers, in `setTimeout`, and in rejected promises. Those never pass through
 * render. Async failures are handled where they happen — see `toErrorMessage`
 * in `lib/api-client.ts`.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

/**
 * To clear the error on navigation, give the boundary a `key` that changes with
 * the route. React then unmounts and remounts it, discarding the error with the
 * instance. Doing it via `componentDidUpdate` instead would mean a second
 * render on every prop change and a stale-fallback bug if the comparison were
 * ever wrong.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Dev only. In production this is where a reporting service would go;
    // logging a component stack to a user's console tells them nothing and
    // tells an attacker a little.
    if (import.meta.env.DEV) {
      console.error('Render error:', error, info.componentStack)
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <Card className="mx-auto max-w-lg border-destructive/30">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <TriangleAlert className="size-6" />
          </span>

          <div className="flex flex-col gap-1.5">
            <p className="font-medium">Something went wrong on this page</p>
            <p className="text-sm text-muted-foreground">
              The rest of the portal is unaffected. Reloading usually clears it.
            </p>
          </div>

          {/* The message can name an internal symbol, so it stays in dev. */}
          {import.meta.env.DEV && (
            <pre className="max-h-32 w-full overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" />
              Reload
            </Button>
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
}
