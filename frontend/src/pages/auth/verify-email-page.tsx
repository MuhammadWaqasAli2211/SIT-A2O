/**
 * Where a signup confirmation link actually lands.
 *
 * Supabase (GoTrue) verifies the token itself, server-side, before the
 * browser ever gets here — by the time this page runs, confirmation has
 * already succeeded or failed. What GoTrue hands back on its redirect is
 * either a real session (`#access_token=...&refresh_token=...&expires_in=
 * ...&token_type=bearer`) or an error (`error`/`error_code`/
 * `error_description`, as a hash fragment or a query string depending on
 * the GoTrue version). This page's whole job is reading whichever of those
 * arrived and turning it into one of three states.
 *
 * ## Why "expired" and "already verified" are one state, not two
 *
 * The brief asked for a distinct "already verified" state — clicking a
 * confirmation link twice shouldn't read as an error. But GoTrue's
 * single-use token is deleted the moment it is first consumed, so a second
 * click gets exactly the same "invalid or expired" signal as a token that
 * genuinely expired or was never valid. There is nothing in the redirect
 * that tells them apart. Rather than fabricate a distinction the system
 * doesn't actually give us, the error state is worded to cover both
 * honestly and offers both of the only two things that could actually be
 * true: the account might already be confirmed (try signing in) or it
 * might not be (send a new confirmation email).
 *
 * ## Why success doesn't auto-redirect
 *
 * GoTrue's tokens are real, usable Supabase JWTs — the same kind
 * `AuthContext` already trusts everywhere else (`/auth/me` verifies them
 * directly) — so this page saves them and can send the candidate straight
 * into the portal. But `AuthProvider`'s session bootstrap only runs once,
 * on mount, and this page never went through it — a client-side `navigate`
 * would hit `ProtectedRoute` while its context still thinks nobody is
 * signed in, and bounce them straight back to /login despite the tokens
 * being sitting right there in storage. A full navigation
 * (`window.location.href`) remounts the app, which runs that bootstrap
 * fresh against the tokens this page just saved. It also means "success"
 * is a state the candidate actually sees and clicks through, not a flash
 * before an instant redirect.
 *
 * ## Only one role ever reaches this page
 *
 * Admin and super-admin accounts are provisioned with `email_confirm: true`
 * (see `supabase_auth.admin_create_user`) and never go through self-service
 * signup or its confirmation email at all — `auth_service.signup` only
 * ever creates CANDIDATE accounts. So there is no second role's version of
 * this page to design; every visitor here is a candidate.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Mail,
  MailCheck,
  MailQuestion,
  Send,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/motion/reveal'
import { AppLoader } from '@/components/shared/app-loader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthField, AuthLayout } from '@/features/auth/auth-layout'
import { authApi } from '@/features/auth/api'
import { toErrorMessage } from '@/lib/api-client'
import { tokenStore } from '@/lib/storage'

type Status = 'verifying' | 'success' | 'error'

interface ParsedCallback {
  tokens: { access_token: string; refresh_token: string; token_type: string; expires_in: number } | null
  errorDescription: string | null
}

/**
 * GoTrue puts its result in the URL hash for the classic confirm flow, but
 * some setups (and every error case, in some GoTrue versions) put it in the
 * query string instead. Reading both and letting hash win is cheaper than
 * getting it wrong for one of them.
 */
function parseCallback(): ParsedCallback {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const search = new URLSearchParams(window.location.search)
  const read = (key: string) => hash.get(key) ?? search.get(key)

  const accessToken = read('access_token')
  const refreshToken = read('refresh_token')

  if (accessToken && refreshToken) {
    return {
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: read('token_type') ?? 'bearer',
        expires_in: Number(read('expires_in')) || 3600,
      },
      errorDescription: null,
    }
  }

  const description = read('error_description')
  return {
    tokens: null,
    errorDescription: description ? description.replace(/\+/g, ' ') : null,
  }
}

/** How long the "verifying" state stays on screen at minimum.
 *  The actual check already happened server-side before this page loaded —
 *  reading the URL is instant — so with no floor this would flash by
 *  faster than a person can register it happened at all. */
const MIN_VERIFYING_MS = 700

export default function VerifyEmailPage() {
  const parsed = useMemo(parseCallback, [])
  const [status, setStatus] = useState<Status>('verifying')

  useEffect(() => {
    if (parsed.tokens) {
      tokenStore.save(parsed.tokens)
    }
    const timer = setTimeout(() => setStatus(parsed.tokens ? 'success' : 'error'), MIN_VERIFYING_MS)
    return () => clearTimeout(timer)
  }, [parsed])

  return (
    <AuthLayout
      title={status === 'success' ? 'Email confirmed' : 'Confirming your email'}
      subtitle={
        status === 'verifying'
          ? 'One moment while we check your link'
          : status === 'success'
            ? 'Your account is ready'
            : 'This link needs a second look'
      }
    >
      {status === 'verifying' && <VerifyingState />}
      {status === 'success' && <SuccessState />}
      {status === 'error' && <ErrorState description={parsed.errorDescription} />}
    </AuthLayout>
  )
}

/* ------------------------------------------------------------- states -- */

function VerifyingState() {
  return (
    <Reveal direction="none" className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <AppLoader size="sm" bare className="size-6" />
      </span>
      <p className="text-sm text-muted-foreground">Checking your confirmation link…</p>
    </Reveal>
  )
}

function SuccessState() {
  return (
    <Reveal direction="up" className="flex flex-col items-center gap-5 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-success/12 text-success">
        <MailCheck className="size-6" />
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your email address is confirmed and your account is active. You are signed in —
        continue to your dashboard to start your application.
      </p>
      <Button
        size="lg"
        className="group h-11 w-full rounded-full"
        // A full navigation, deliberately — see the file header for why a
        // client-side `navigate` here would bounce back to /login.
        onClick={() => {
          window.location.href = '/dashboard'
        }}
      >
        Continue to your dashboard
        <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
      </Button>
    </Reveal>
  )
}

function ErrorState({ description }: { description: string | null }) {
  const [email, setEmail] = useState('')
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [note, setNote] = useState<string | null>(null)

  const onResend = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return
    setSendState('sending')
    setNote(null)
    try {
      const { message } = await authApi.resendConfirmation(email.trim())
      setSendState('sent')
      setNote(message)
    } catch (error) {
      setSendState('idle')
      setNote(toErrorMessage(error, 'Could not send that email. Please try again.'))
    }
  }

  return (
    <Reveal direction="up" className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-warning/15 text-warning">
          <MailQuestion className="size-6" />
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {/* Deliberately non-committal — see the file header on why "expired"
              and "already confirmed" cannot be told apart from here. */}
          This confirmation link is no longer valid. It may have expired, already been
          used, or your account may already be confirmed.
          {description && (
            <span className="mt-1 block text-xs text-muted-foreground/70">{description}</span>
          )}
        </p>
      </div>

      <Button render={<Link to="/login" />} variant="outline" size="lg" className="h-11 w-full rounded-full">
        Already confirmed? Sign in
      </Button>

      <div className="rounded-xl border border-border p-4">
        <p className="mb-3 text-sm font-medium">Not confirmed yet? Send a new link.</p>

        {sendState === 'sent' ? (
          <Alert className="border-success/35 bg-success/5">
            <AlertDescription className="text-sm text-success">{note}</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={onResend} className="flex flex-col gap-3">
            <AuthField id="resend-email" label="Email" icon={Mail}>
              <Input
                id="resend-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-11 rounded-xl pl-10"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </AuthField>
            {note && <p className="text-sm text-destructive">{note}</p>}
            <Button
              type="submit"
              variant="outline"
              className="h-10 w-full rounded-full"
              disabled={sendState === 'sending' || !email.trim()}
            >
              {sendState === 'sending' ? (
                <>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Resend confirmation email
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </Reveal>
  )
}
