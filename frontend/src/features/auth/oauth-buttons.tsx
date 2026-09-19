import { toast } from 'sonner'

import { getSupabase } from '@/lib/supabase-client'
import { cn } from '@/lib/utils'

/**
 * Google sign-in, via Supabase's OAuth redirect.
 *
 * `redirectTo` always points at this browser's own origin, not a hardcoded
 * one — so this works identically in dev and in whatever origin the app is
 * actually deployed to, as long as that origin is allow-listed in Supabase's
 * Auth settings. `/auth/callback` is where the session actually gets read
 * and saved; see that page for the rest of the flow.
 */
const GoogleMark = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true" className="size-[1.05rem] shrink-0">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
    />
    <path
      fill="#FBBC05"
      d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
    />
  </svg>
)

export function OAuthButtons({ className }: { className?: string }) {
  async function signInWithGoogle() {
    let supabase: ReturnType<typeof getSupabase>
    try {
      supabase = getSupabase()
    } catch (error) {
      toast.error('Google sign-in is not available yet.', {
        description: error instanceof Error ? error.message : undefined,
      })
      return
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    // Only reachable if Supabase rejected the request before ever leaving
    // the page (misconfiguration, network failure) — a successful call
    // navigates the browser away and never returns here.
    if (error) toast.error('Could not start Google sign-in.', { description: error.message })
  }

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className={cn(
          'flex h-11 w-full items-center justify-center gap-2.5 rounded-full',
          'border border-border bg-card text-sm font-medium text-card-foreground',
          'transition-colors hover:bg-muted',
          'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        )}
      >
        <GoogleMark />
        Continue with Google
      </button>
    </div>
  )
}
