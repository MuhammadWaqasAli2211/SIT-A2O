import { ArrowLeft, GraduationCap, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { AlumniCarousel } from '@/features/auth/alumni-carousel'
import { AuthIllustration } from '@/features/auth/auth-illustration'
import { BRAND_ACCENT, BRAND_PRIMARY, BrandMark } from '@/features/marketing/brand'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * The split-pane shell both auth pages sit in.
 *
 * Left: the form. Right: the brand pane — alumni dial over an illustration
 * that bleeds off the bottom-right. The right pane is `hidden lg:flex`: it is
 * decoration, and on a phone the form should own the whole screen rather than
 * being pushed below a testimonial.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-muted/40 p-0 sm:p-6 lg:p-8">
      <div
        className={cn(
          'mx-auto flex min-h-screen w-full max-w-6xl overflow-hidden bg-card',
          'sm:min-h-[calc(100vh-3rem)] sm:rounded-3xl sm:shadow-xl sm:ring-1 sm:ring-border',
          'lg:min-h-[calc(100vh-4rem)]',
        )}
      >
        {/* ------------------------------------------------- form pane -- */}
        <div className="flex w-full flex-col px-5 py-8 sm:px-10 sm:py-10 lg:w-[52%] lg:px-14">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="size-[1.05rem]" />
              </span>
              <span className="text-[0.95rem] font-semibold tracking-tight">Saylani</span>
            </Link>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to site
            </Link>
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto w-full max-w-sm">
              <div className="mb-7 text-center">
                <h1 className="text-3xl font-bold tracking-tight sm:text-[2rem]">{title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
              </div>

              {children}
            </div>
          </div>
        </div>

        {/* ----------------------------------------------- brand pane -- */}
        <div className="relative hidden w-[48%] flex-col overflow-hidden bg-auth-pane lg:flex">
          <div className="relative z-10 flex items-center gap-4 px-10 pt-10 xl:px-12">
            <span className="block h-28 w-auto shrink-0">
              <BrandMark />
            </span>
            <span className="text-2xl leading-none font-bold tracking-tight text-auth-pane-ink">
              {BRAND_PRIMARY}{' '}
              <span className="text-flow-500 dark:text-flow-600">{BRAND_ACCENT}</span>
            </span>
          </div>

          <div className="relative z-10 px-10 pt-8 xl:px-12">
            <AlumniCarousel />
          </div>

          {/* Runs off the bottom and right edges, as in the reference. The
              negative insets are what make it bleed rather than sit inside a
              margin. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -bottom-8 left-0 z-0"
          >
            <AuthIllustration className="opacity-95" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** "OR" rule between the OAuth buttons and the form proper. */
export function AuthDivider({ label = 'OR' }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium tracking-wider text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/**
 * Label + leading icon + error, wrapped around whatever control is passed in.
 *
 * The icon is positioned rather than rendered inside the input because the
 * shared `Input` takes no icon slot — and the password field needs a leading
 * icon *and* the trailing eye toggle `PasswordInput` already owns. Passing
 * `pl-10` to either control lines the text up past the icon.
 */
export function AuthField({
  id,
  label,
  icon: Icon,
  required,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  icon: LucideIcon
  required?: boolean
  error?: string | undefined
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[0.8rem]">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
        {hint}
      </Label>

      <div className="relative">
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        {children}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
