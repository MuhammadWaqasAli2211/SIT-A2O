/**
 * Where a Google sign-in actually lands, after Supabase has already done the
 * OAuth dance with Google and redirected back here.
 *
 * `supabase.auth.getSession()` is what reads the redirect: with
 * `detectSessionInUrl: true` (see `@/lib/supabase-client`), the SDK exchanges
 * whatever the URL carries — a `?code=` under the PKCE flow, or a
 * `#access_token=` under the older implicit one — for a real session the
 * first time it is asked. That session is Supabase's own client-side one,
 * which this app does not otherwise use (see the client's header comment);
 * the tokens are copied into `tokenStore` here and then this page's job is
 * done, the same handoff `verify-email-page` does for the confirmation-link
 * flow.
 *
 * ## Why this fetches the profile instead of hardcoding a destination
 *
 * `verify-email-page` can hardcode `/dashboard`, because only candidates
 * ever reach it — self-service signup only produces CANDIDATE accounts.
 * Google sign-in cannot make that assumption: with account auto-linking
 * turned on, an email that already belongs to an ADMIN or SUPER_ADMIN
 * account signs in as that account. So this page calls `/auth/me` and
 * routes by the role that comes back, same as the password-login page does.
 *
 * ## Why this still uses a full navigation, not `navigate()`
 *
 * Same reason as `verify-email-page`: `AuthProvider`'s session bootstrap
 * only runs once, on mount. A client-side route change would hit
 * `ProtectedRoute` while that context still thinks nobody is signed in.
 * `window.location.href` remounts the app, which re-runs the bootstrap
 * against the tokens this page just saved.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MailQuestion } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { AppLoader } from '@/components/shared/app-loader'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/features/auth/auth-layout'
import { authApi } from '@/features/auth/api'
import { HOME_BY_ROLE } from '@/lib/types'
import { getSupabase } from '@/lib/supabase-client'
import { tokenStore } from '@/lib/storage'

type Status = 'working' | 'error'

export default function OAuthCallbackPage() {
  const [status, setStatus] = useState<Status>('working')
  const [description, setDescription] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function complete() {
      // Supabase puts a failure (the person closed the Google consent
      // screen, the provider is not enabled yet, and so on) in the query
      // string rather than raising a JS error here — getSession() below
      // would just come back with no session for these too, but reading it
      // directly gives a real reason instead of a generic one.
      const params = new URLSearchParams(window.location.search)
      const oauthError = params.get('error_description') ?? params.get('error')

      // getSupabase() itself throws if the app is unconfigured (no
      // VITE_SUPABASE_URL); everything else this page needs is inside the
      // SDK's own result object, not a second throw.
      let result: Awaited<ReturnType<ReturnType<typeof getSupabase>['auth']['getSession']>>
      try {
        result = await getSupabase().auth.getSession()
      } catch (e) {
        if (cancelled) return
        setDescription(e instanceof Error ? e.message : null)
        setStatus('error')
        return
      }

      if (cancelled) return
      const { session } = result.data
      const { error } = result

      if (error || !session) {
        setDescription(oauthError ? oauthError.replace(/\+/g, ' ') : error?.message ?? null)
        setStatus('error')
        return
      }

      tokenStore.save({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: session.token_type,
        expires_in: session.expires_in ?? 3600,
      })

      try {
        const profile = await authApi.me()
        if (cancelled) return
        window.location.href = HOME_BY_ROLE[profile.role]
      } catch {
        if (cancelled) return
        // Tokens are real but our own backend rejected /auth/me — surfaced
        // as the same error state rather than a silent stall.
        tokenStore.clear()
        setDescription('Signed in with Google, but your account could not be loaded.')
        setStatus('error')
      }
    }

    void complete()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AuthLayout
      title={status === 'error' ? 'Could not sign you in' : 'Signing you in'}
      subtitle={
        status === 'error' ? 'Your Google sign-in did not complete' : 'One moment with Google'
      }
    >
      {status === 'working' ? <WorkingState /> : <ErrorState description={description} />}
    </AuthLayout>
  )
}

function WorkingState() {
  return (
    <Reveal direction="none" className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <AppLoader size="sm" bare className="size-6" />
      </span>
      <p className="text-sm text-muted-foreground">Finishing sign-in with Google…</p>
    </Reveal>
  )
}

function ErrorState({ description }: { description: string | null }) {
  return (
    <Reveal direction="up" className="flex flex-col items-center gap-5 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-warning/15 text-warning">
        <MailQuestion className="size-6" />
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Something went wrong on Google&apos;s side of signing in.
        {description && <span className="mt-1 block text-xs text-muted-foreground/70">{description}</span>}
      </p>
      <Button render={<Link to="/login" />} size="lg" className="h-11 w-full rounded-full">
        Back to sign in
      </Button>
    </Reveal>
  )
}
