/**
 * The Bootcamp Flows lockup: mark + two-tone wordmark.
 *
 * One definition because the header and the footer both render it, and a
 * wordmark that says two different things in two places is the whole reason
 * this is a component rather than markup copied twice.
 *
 * The mark is an inline SVG rather than an icon-font glyph or a raster file:
 * it has to recolour with the theme (the flow strokes read from
 * `currentColor` and the accent token), and it is small enough that a network
 * request for it would cost more than shipping the ~20 path commands.
 */

import { cn } from '@/lib/utils'

/** The product name, split where the colour changes. */
export const BRAND_NAME = 'Bootcamp Flows'
export const BRAND_PRIMARY = 'Bootcamp'
export const BRAND_ACCENT = 'Flows'

/**
 * The bright green that reads correctly *on the nav shell*, in both themes.
 *
 * --nav-shell is a fixed dark surface either way, so its accent has to be a
 * fixed bright green too — but neither --primary nor --brand-300 is bright in
 * both themes on its own: --primary is a mid 0.53 green in light mode, and
 * --brand-300 inverts down to 0.45 in dark mode. Taking the light half from
 * one and the dark half from the other lands on ~0.8 / ~0.68 lightness, which
 * is vivid against the shell in both, and avoids minting a fourth token for
 * a colour the ramp already contains.
 */
const ON_SHELL_ACCENT = 'text-brand-300 dark:text-primary'

/**
 * The hexagon mark: three nodes joined by two flow arcs.
 *
 * Reads as a process moving through stages, which is what the product is.
 * Drawn on a 24-unit grid so it lines up with the lucide icons beside it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('size-full', className)}
    >
      {/* Rounded hexagon shell */}
      <path
        d="M12 2.4 20 7v10l-8 4.6L4 17V7l8-4.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* Two flow arcs, entering and leaving the middle node */}
      <path
        d="M8 15.2c0-2 1.4-3.2 4-3.2s4-1.2 4-3.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* Stage nodes */}
      <circle cx="8" cy="15.2" r="1.85" fill="currentColor" />
      <circle cx="16" cy="8.8" r="1.85" fill="currentColor" />
    </svg>
  )
}

/**
 * Mark plus wordmark.
 *
 * `tone="shell"` is for the dark navbar, where the whole lockup sits on
 * --nav-shell and the primary half of the name has to be the shell's ink
 * rather than --foreground (which is near-black in light mode and would
 * vanish into the bar).
 */
export function BrandLockup({
  tone = 'default',
  className,
  markClassName,
}: {
  tone?: 'default' | 'shell'
  className?: string
  markClassName?: string
}) {
  return (
    <span className={cn('flex shrink-0 items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-xl p-1.5 shadow-sm transition-transform duration-300 group-hover:scale-105',
          tone === 'shell' ? cn('bg-primary/15', ON_SHELL_ACCENT) : 'bg-primary text-primary-foreground',
          markClassName,
        )}
      >
        <BrandMark />
      </span>
      <span className="text-[1.05rem] leading-none font-bold tracking-tight">
        <span className={tone === 'shell' ? 'text-nav-shell-ink' : 'text-foreground'}>
          {BRAND_PRIMARY}
        </span>{' '}
        <span className={tone === 'shell' ? ON_SHELL_ACCENT : 'text-primary'}>
          {BRAND_ACCENT}
        </span>
      </span>
    </span>
  )
}
