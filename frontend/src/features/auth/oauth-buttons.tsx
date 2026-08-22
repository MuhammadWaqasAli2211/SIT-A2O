import { toast } from 'sonner'

import { cn } from '@/lib/utils'

/**
 * Google and Apple sign-in.
 *
 * Neither is wired to a provider yet, so both answer with a "coming soon"
 * toast. They are rendered as real buttons rather than being hidden because
 * the layout is designed around them and because a disabled-looking control
 * invites the same click anyway — better to say plainly what is going on.
 *
 * When these are implemented, the only change here is swapping the toast for
 * the provider call; the markup stays.
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

const AppleMark = () => (
  // Single path, so it takes the button's text colour and works on either theme.
  <svg viewBox="0 0 18 18" aria-hidden="true" className="size-[1.15rem] shrink-0 fill-current">
    <path d="M13.4 9.55c.02 2.28 2 3.04 2.02 3.05-.01.05-.31 1.08-1.04 2.14-.63.92-1.29 1.83-2.32 1.85-1.01.02-1.34-.6-2.5-.6-1.15 0-1.52.58-2.48.62-1 .04-1.76-.99-2.4-1.9-1.3-1.88-2.3-5.3-.96-7.62.66-1.15 1.85-1.87 3.14-1.9.98-.01 1.9.66 2.5.66.6 0 1.72-.82 2.9-.7.49.02 1.87.2 2.76 1.5-.07.05-1.65.96-1.63 2.87M11.5 3.1c.53-.64.89-1.53.79-2.42-.76.03-1.69.51-2.24 1.15-.49.56-.92 1.47-.8 2.34.85.06 1.71-.43 2.25-1.07" />
  </svg>
)

const PROVIDERS = [
  { id: 'google', label: 'Continue with Google', Mark: GoogleMark },
  { id: 'apple', label: 'Continue with Apple', Mark: AppleMark },
] as const

export function OAuthButtons({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {PROVIDERS.map(({ id, label, Mark }) => (
        <button
          key={id}
          type="button"
          onClick={() =>
            toast.info(`${label.replace('Continue with ', '')} sign-in is coming soon`, {
              description: 'Use your email and password for now.',
            })
          }
          className={cn(
            'flex h-11 w-full items-center justify-center gap-2.5 rounded-full',
            'border border-border bg-card text-sm font-medium text-card-foreground',
            'transition-colors hover:bg-muted',
            'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          )}
        >
          <Mark />
          {label}
        </button>
      ))}
    </div>
  )
}
