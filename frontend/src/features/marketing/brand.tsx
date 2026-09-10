/**
 * The Bootcamp Flows lockup: mark + two-tone wordmark.
 *
 * One definition because the header and the footer both render it, and a
 * wordmark that says two different things in two places is the whole reason
 * this is a component rather than markup copied twice.
 *
 * ## One logo, prepared properly
 *
 * Both components below render the supplied artwork — there is no drawn
 * stand-in. What makes it hold up at 16px is preparation, not substitution:
 * the assets in public/brand/ are trimmed of the source file's empty padding,
 * recentred, and pre-rendered per size with a real resampling filter, and the
 * small ones are given back the edge contrast that any downscale removes.
 * See `scripts/build_logo_assets.py` for the pipeline and the reasoning.
 *
 * `BrandMark` (tiled) is the default. `BrandLogo` (bare) is only for large
 * light surfaces — see each component's own note.
 */

import { cn } from '@/lib/utils'

/** The product name, split where the colour changes. */
export const BRAND_NAME = 'Bootcamp Flows'
export const BRAND_PRIMARY = 'Bootcamp'
export const BRAND_ACCENT = 'Flows'

/**
 * The colour of "Flows" — the accent half of the wordmark.
 *
 * Green, not blue, and that is the point. The mark is a blue B that flows into
 * a green arrow, so a wordmark whose accent half is also blue leaves the
 * logo's whole green half unrepresented anywhere in the interface. Splitting
 * the name the way the mark splits itself is what ties the two together.
 *
 * `--flow-*` rather than `--success`: this is brand, not status. Nothing has
 * been approved by the time someone reads the product's own name.
 */
const ACCENT = 'text-flow-600'

/**
 * The same accent, on the nav shell.
 *
 * --nav-shell is a fixed dark surface in both themes, so its accent has to be
 * a fixed bright tone too — and --flow-600 is not bright in both on its own
 * (0.54 in light, 0.81 in dark). Taking the light half from one step of the
 * ramp and the dark half from another lands vivid against the shell either
 * way, without minting a token for a colour the ramp already contains.
 */
const ON_SHELL_ACCENT = 'text-flow-500 dark:text-flow-600'

/**
 * The logo: the real artwork, extruded, on transparency.
 *
 * Two things make it work at interface sizes, and both are done ahead of time
 * in public/brand/ rather than by the browser:
 *
 * 1. **Pre-rendered sizes.** The source is 500x500 with ~12% empty padding
 *    around off-centre artwork. Asking a browser for 32px from that spends a
 *    third of the pixel budget on nothing and downscales a detailed gradient
 *    in one step, which is what turned the ribbon into a smear. The assets
 *    here are trimmed to the artwork, recentred, and resampled per size with
 *    a proper filter plus sharpening at the small end.
 *
 * 2. **Depth.** A darkened extrusion of the mark's own silhouette plus a
 *    contact shadow, so it sits on the surface rather than being stamped
 *    flat onto it.
 *
 * **Known limit, deliberately left standing.** With no tile behind it, the
 * logo's deep blue (#013186, oklch(0.348 0.150 261)) is close in lightness to
 * `--nav-shell` (oklch(0.22 0.07 262)) and `--auth-pane` (oklch(0.33 0.15
 * 262)), so the top-left of the mark has little contrast on those two
 * surfaces. The extrusion and its shadow give the shape an edge to read
 * against, which softens the problem without solving it. Solving it properly
 * means changing those surfaces — a navbar decision, not this component's.
 *
 * `srcSet` carries density variants rather than one large file: a 192px
 * source displayed at 32px is the same six-times downscale the pre-rendering
 * exists to avoid.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/mark3d-128.png"
      srcSet="/brand/mark3d-64.png 1x, /brand/mark3d-128.png 2x, /brand/mark3d-192.png 3x"
      alt=""
      aria-hidden="true"
      // The artwork is 1.09:1 — wider than tall. Sized by height, with the
      // width left to follow, because height is what the fixed-height bars
      // actually constrain. Forcing it square would pad the short axis and
      // then let that padding limit the width.
      width={137}
      height={128}
      // Eager: every place this renders is above the fold, where a lazy
      // swap-in reads as the page flickering.
      loading="eager"
      decoding="async"
      className={cn('h-full w-auto max-w-none', className)}
    />
  )
}

/*
 * The white-tiled `icon-*.png` sizes are still generated, and still what the
 * PWA manifest wants — an installed app icon has to fill its own tile rather
 * than float on whatever the launcher's wallpaper happens to be. They are no
 * longer used inside the app itself.
 */

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
      {/* No wrapper box, no background, no CSS rounding: the mark is the
          artwork on transparency and carries its own extruded depth and
          contact shadow. A `rounded-*` + `overflow-hidden` wrapper would clip
          that shadow off, and a `shadow-*` would cast a second, square one
          behind a non-rectangular shape. */}
      <span
        className={cn(
          // Height only — the width is the artwork's own. 56px is the public
          // header's content box once its padding is py-2, which is as tall
          // as this can go without the bar itself growing.
          'block h-14 w-auto shrink-0 transition-transform duration-300 group-hover:scale-105',
          markClassName,
        )}
      >
        <BrandMark />
      </span>
      <span className="text-[1.05rem] leading-none font-bold tracking-tight">
        <span className={tone === 'shell' ? 'text-nav-shell-ink' : 'text-foreground'}>
          {BRAND_PRIMARY}
        </span>{' '}
        <span className={tone === 'shell' ? ON_SHELL_ACCENT : ACCENT}>
          {BRAND_ACCENT}
        </span>
      </span>
    </span>
  )
}
