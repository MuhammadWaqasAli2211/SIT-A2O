/**
 * The site footer.
 *
 * Rebuilt 2026-09-04 on a reference footer's structure: a dark, full-bleed
 * band, link columns on the left, a wider brand block on the right, a thin
 * divider, a centered copyright line, and a large, very-low-opacity
 * decorative motif bleeding off the bottom edge. See
 * `docs/prompts/footer-rebuild-prompt.md` for the reference and the
 * decisions made against it.
 *
 * Four things here are deliberate rather than decorative:
 *
 * - **The dark band reuses `--nav-shell`/`--nav-shell-ink`**, not a new
 *   token. That pair already exists for exactly this requirement — a
 *   surface that must stay dark under light text regardless of the app's
 *   own light/dark mode — because the navbar needed it first. A second
 *   "fixed dark" token for the footer would just be the same colour under a
 *   different name.
 *
 * - **The apply band stays outside the dark footer, not inside it.** It is
 *   a light-adaptive, theme-following CTA strip (see `ApplyBand` below);
 *   the reference footer has nothing like it, so it was not part of what
 *   this rebuild restructured. It sits directly above the new dark band —
 *   a light strip handing off into a dark one reads as a deliberate
 *   transition, not as two unrelated components glued together.
 *
 * - **The brand name is set enormous and embossed into the shell**, sitting
 *   above the divider and so above the copyright line with it. See
 *   `GiantWordmark` below. (Two earlier passes got this wrong: first as
 *   repeated oversized hexagons, because the original reference screenshot
 *   was dark enough that the giant letterforms read as abstract shapes; then
 *   as a gradient-filled word overflowing both screen edges, which pushed
 *   "Flows" off-screen entirely.) The text comes from `BRAND_NAME`, so the
 *   giant word, the lockup beside it, and the copyright line cannot say
 *   three different things.
 *
 * - **The hover treatment is one utility, applied everywhere.** The brief
 *   asked whether the wordmark's accent-outline hover should extend to
 *   every other interactive element in the footer for a consistent
 *   language; confirmed yes. `HOVER_OUTLINE` is that one class string,
 *   applied to the wordmark, every column link, and every social icon —
 *   not four independently-tuned hover effects that happen to look similar.
 *
 * Two things carried over unchanged from the previous rebuild:
 *
 * - **The status band is real.** `ApplyBand` reads `/bootcamps/open`
 *   through the same `useOpenBootcamp` hook the hero badge uses, so
 *   "applications are open" is never a claim the server would contradict.
 * - **Groups collapse on mobile.** Below `sm` each column is a real
 *   disclosure button; from `sm` up it is a plain heading over an
 *   always-visible list — two elements, each correct for its breakpoint,
 *   rather than one with an `aria-expanded` that lies at half the widths it
 *   renders at.
 */

import { useId, useState } from 'react'
import { ArrowRight, CalendarClock, ChevronDown, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { BRAND_NAME, BrandLockup } from '@/features/marketing/brand'
import { bootcampLabel, useOpenBootcamp } from '@/features/marketing/use-open-bootcamp'
import { CONTACT, SOCIAL_LINKS } from '@/lib/contact'
import { FOOTER_LINKS } from '@/lib/site-data'
import { cn } from '@/lib/utils'

/**
 * The footer's one hover language, shared by the wordmark, every column
 * link, and every social icon.
 *
 * An `outline`, not a `border`: an outline never participates in layout, so
 * it can appear on hover without nudging anything beside it — which is
 * exactly why the brief specified an outline rather than an underline or a
 * border here. Colour is the same light/dark pairing `ON_SHELL_ACCENT` in
 * brand.tsx uses for text on this same dark surface (`brand-300` reads
 * vivid against the shell in light mode, `primary` does the same job in
 * dark mode — neither alone is bright enough in both) — written directly
 * here as `outline-*` utilities rather than importing that text-coloured
 * constant, since it is a different CSS property on the same tokens.
 */
const HOVER_OUTLINE = cn(
  'rounded-md outline-2 outline-offset-4 outline-transparent',
  'transition-[outline-color] duration-300',
  'hover:outline-brand-300 focus-visible:outline-brand-300',
  'dark:hover:outline-primary dark:focus-visible:outline-primary',
)

export function PublicFooter() {
  return (
    <>
      <ApplyBand />
      <DarkFooter />
    </>
  )
}

/* ------------------------------------------------------------ apply band -- */

/**
 * The live status line above the footer.
 *
 * Present in both states on purpose. "Applications are open until X" is the
 * useful case, but "no intake is open right now" is the one a visitor most
 * needs and is least likely to find anywhere else on the site — leaving the
 * band out when nothing is open would answer the easy question and stay
 * silent on the hard one.
 */
function ApplyBand() {
  const { bootcamp, loading } = useOpenBootcamp()

  // Held back until the first settle rather than flashing "nothing is open"
  // for the length of a network round trip.
  if (loading) return null

  const open = Boolean(bootcamp)
  const label = bootcamp ? bootcampLabel(bootcamp) : null
  const deadline = bootcamp?.registration_deadline
    ? new Date(bootcamp.registration_deadline)
    : null

  return (
    <div className="border-b border-border bg-card/60">
      <Reveal
        direction="none"
        className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:px-6 md:flex-row md:justify-between lg:px-8"
      >
        <div className="flex items-center gap-3.5 text-center md:text-left">
          <span
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl',
              open ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            <CalendarClock className="size-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-semibold tracking-tight">
              {open ? `Applications are open for ${label}` : 'No intake is open right now'}
            </span>
            <span className="text-sm text-muted-foreground">
              {open
                ? deadline
                  ? `Applying is free and takes about ten minutes. Closes ${formatDeadline(deadline)}.`
                  : 'Applying is free and takes about ten minutes.'
                : 'Intakes run several times a year. The programme pages stay up between them.'}
            </span>
          </div>
        </div>

        <Button
          render={<Link to={open ? '/signup' : '/programs'} />}
          size="lg"
          variant={open ? 'default' : 'outline'}
          className="group h-11 shrink-0 px-6"
        >
          {open ? 'Start your application' : 'Browse programmes'}
          <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
        </Button>
      </Reveal>
    </div>
  )
}

function formatDeadline(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

/* ----------------------------------------------------------- dark footer -- */

function DarkFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-nav-shell text-nav-shell-ink">
      <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-14 sm:px-6 sm:pt-16 sm:pb-16 lg:px-8">
        {/*
          Link columns come first in the DOM (so mobile reads the site map
          before the brand block, and a screen reader hears the same order
          at every width). At `lg` the grid is defined as four equal columns
          then one wide one; `lg:contents` on the links wrapper dissolves it
          so its four FooterGroup children become direct items of that grid,
          landing in the four `1fr` columns purely by DOM order — the brand
          block, next in the DOM, falls into the remaining `1.3fr` column on
          the right. No `order-*` utility needed: DOM order already matches
          the reference's left-columns/right-brand layout.
        */}
        <div className="grid gap-10 lg:grid-cols-[repeat(4,1fr)_1.3fr] lg:gap-8">
          <div className="divide-y divide-nav-shell-ink/10 sm:grid sm:grid-cols-2 sm:gap-8 sm:divide-y-0 lg:contents">
            {FOOTER_LINKS.map((group, index) => (
              <FooterGroup
                key={group.heading}
                heading={group.heading}
                links={group.links}
                delay={0.05 * (index + 1)}
              />
            ))}
          </div>

          <Reveal delay={0.05} className="flex flex-col gap-5">
            <Link
              to="/"
              aria-label="Bootcamp Flows — home"
              className={cn('group w-fit', HOVER_OUTLINE)}
            >
              <BrandLockup tone="shell" size="lg" />
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-nav-shell-ink/70">
              Free, industry-aligned IT education for everyone. Every programme costs
              nothing to apply to and nothing to attend.
            </p>

            <address className="flex flex-col gap-2.5 text-sm text-nav-shell-ink/70 not-italic">
              <span className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-nav-shell-ink/50" />
                <span>
                  {CONTACT.addressLine}, {CONTACT.city}
                </span>
              </span>
              <a
                href={CONTACT.phoneHref}
                className={cn(
                  'flex w-fit items-center gap-2.5 transition-colors hover:text-nav-shell-ink',
                  HOVER_OUTLINE,
                )}
              >
                <Phone className="size-4 shrink-0 text-nav-shell-ink/50" />
                {CONTACT.phone}
              </a>
              <a
                href={CONTACT.emailHref}
                className={cn(
                  'flex w-fit items-center gap-2.5 transition-colors hover:text-nav-shell-ink',
                  HOVER_OUTLINE,
                )}
              >
                <Mail className="size-4 shrink-0 text-nav-shell-ink/50" />
                {CONTACT.email}
              </a>
            </address>

            <div className="flex gap-2">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${social.label} (opens in a new tab)`}
                  className={cn(
                    'grid size-10 place-items-center rounded-lg border border-nav-shell-ink/15 text-nav-shell-ink/70',
                    'transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-300/50 hover:text-brand-300',
                    'dark:hover:border-primary/50 dark:hover:text-primary',
                    HOVER_OUTLINE,
                  )}
                >
                  <social.Icon className="size-4" />
                </a>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Above the divider, and so above the copyright line with it. */}
        <GiantWordmark />

        <div className="relative border-t border-nav-shell-ink/10 pt-8 text-center text-sm text-nav-shell-ink/60">
          © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------- giant wordmark -- */

/**
 * The oversized brand name, embossed into the footer above the divider.
 *
 * Four details make it read as deliberate rather than as overflow:
 *
 * - **Sized to fit, not to overflow.** The reference lets "Compos" run off
 *   both edges, but that word is 6 characters; ours is 14, and at a
 *   comparable letter height "Flows" — the accent half of the name — simply
 *   left the screen. The string measures roughly 6.9em with
 *   `tracking-tighter` folded in (~4.7em "Bootcamp", ~2.7em "Flows", less
 *   ~0.7em of negative letter-spacing across 14 characters), so the size
 *   that fits a container of width W is about W/6.9. `clamp` covers both
 *   ends of that: `12vw` governs on narrow screens, and the `11rem` ceiling
 *   stops it outgrowing the `max-w-7xl` (1280px) container it now sits
 *   inside — 11rem × 6.9 ≈ 1214px, comfortably within it. Without the
 *   ceiling a wide monitor would push the word past the container edges
 *   again, which is the bug this replaced.
 *
 * - **Accent fill, embossed edges.** The fill is the brand gradient fading
 *   downward; the raised look comes from a light top edge and a soft dark
 *   drop beneath it. Those edges are `filter: drop-shadow()` rather than
 *   `text-shadow` for a specific reason — see the note beside them below.
 *   (A previous pass got the emboss by making the fill nearly the shell's
 *   own value, which is the textbook way to do it but threw away the green;
 *   keeping the accent was the call.)
 *
 * - **Each letter outlines and lifts on hover, individually.** Hence one
 *   span per character rather than one span for the string. The outline is
 *   `-webkit-text-stroke`, which traces the actual glyph, not a CSS
 *   `outline`, which would draw a rectangle around the letter's box — on
 *   display type this size the difference is the whole effect. The lift
 *   plays against the emboss: the letter rises out of the surface it was
 *   pressed into. Pointer events are enabled only on the glyph spans, so
 *   the band never swallows a click meant for something above it.
 *
 * - **The colour pairing is the on-shell accent.** `--nav-shell` is dark in
 *   both themes, so the accent has to be picked per-theme the same way
 *   `ON_SHELL_ACCENT` and `HOVER_OUTLINE` pick theirs — see the note on
 *   `HOVER_OUTLINE` above.
 *
 * Motion: the whole word rises in on scroll via the shared `Reveal`
 * primitive (so `prefers-reduced-motion` is honoured by the same code path
 * as everything else on the site), and each letter transitions its stroke
 * and lift independently on hover.
 *
 * `aria-hidden` because it is the site name repeated decoratively — the
 * brand lockup above already announces it, and without this a screen reader
 * would read the per-letter spans out one character at a time.
 * `select-none` keeps it out of a drag-selection of the real text above it.
 */
function GiantWordmark() {
  // No `overflow-hidden` on the wrapper: the letters lift on hover, and
  // clipping this box would cut the top off whichever one is lifting. `pt-3`
  // is the room that lift needs.
  return (
    <Reveal direction="up" duration={0.8} className="pointer-events-none mb-8 pt-3">
      <span
        aria-hidden="true"
        className={cn(
          'block text-center leading-none font-bold tracking-tighter whitespace-nowrap select-none',
          'text-[clamp(1.75rem,12vw,11rem)]',
          // The accent fill, unchanged from before the emboss pass.
          'bg-gradient-to-b bg-clip-text text-transparent',
          'from-brand-300/25 via-brand-300/12 to-transparent',
          'dark:from-primary/25 dark:via-primary/12 dark:to-transparent',
          // Emboss: a highlight along the top edge, then a soft drop below —
          // a raised surface lit from above.
          //
          // `drop-shadow`, not `text-shadow`. With `bg-clip-text` the glyph's
          // own fill is transparent and the colour comes from the element's
          // background, so a text-shadow paints over that clipped gradient
          // rather than behind it. `filter` applies to the composited result,
          // so it traces the visible letterform instead — which is the only
          // way to keep the accent fill *and* have it read as embossed.
          '[filter:drop-shadow(0_-1px_0_rgb(255_255_255/0.16))_drop-shadow(0_3px_6px_rgb(0_0_0/0.5))]',
        )}
      >
        {BRAND_NAME.split('').map((char, index) =>
          char === ' ' ? (
            // A hoverable box around a space would light up a gap between
            // two words, so the space is rendered as inert width instead.
            <span key={index} className="inline-block w-[0.2em]" />
          ) : (
            <span
              key={index}
              className={cn(
                'pointer-events-auto inline-block transition-all duration-300 ease-out',
                '[-webkit-text-stroke:2px_transparent]',
                'hover:-translate-y-2',
                'hover:[-webkit-text-stroke:2px_var(--color-brand-300)]',
                'dark:hover:[-webkit-text-stroke:2px_var(--color-primary)]',
              )}
            >
              {char}
            </span>
          ),
        )}
      </span>
    </Reveal>
  )
}

/* ----------------------------------------------------------------- group -- */

function FooterGroup({
  heading,
  links,
  delay,
}: {
  heading: string
  links: { label: string; href: string }[]
  delay: number
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()

  return (
    <Reveal delay={delay} className="flex flex-col">
      {/*
        Below sm: a real disclosure button, inside a heading so the outline is
        still navigable. From sm up this element is display:none, which takes
        it and its aria-expanded out of the accessibility tree entirely — so
        the collapsed/expanded state is never announced at a width where the
        list is unconditionally visible.
      */}
      <h3 className="sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={listId}
          className="flex w-full items-center justify-between py-4 text-sm font-semibold text-nav-shell-ink"
        >
          {heading}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 text-nav-shell-ink/50 transition-transform duration-300',
              open && 'rotate-180',
            )}
          />
        </button>
      </h3>

      <h3 className="hidden text-sm font-semibold text-nav-shell-ink sm:block">{heading}</h3>

      <ul
        id={listId}
        className={cn(
          'flex-col gap-3 pb-5 sm:flex sm:gap-2.5 sm:pt-4 sm:pb-0',
          open ? 'flex' : 'hidden',
        )}
      >
        {links.map((link) => (
          <li key={link.href}>
            <Link
              to={link.href}
              // Generous vertical padding below sm so each row clears a
              // finger; tightened once these are a desktop link column.
              className={cn(
                '-my-1 inline-block py-1 text-sm text-nav-shell-ink/70 transition-colors hover:text-brand-300 sm:my-0 sm:py-0',
                'dark:hover:text-primary',
                HOVER_OUTLINE,
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </Reveal>
  )
}
