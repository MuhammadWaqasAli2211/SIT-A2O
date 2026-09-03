/**
 * "Our graduates work at" — the hiring-partner marquee.
 *
 * Shared by the home page and the Success Stories page so the two cannot
 * visually or behaviourally drift apart the way a copy-pasted marquee would.
 *
 * ## Where the logos come from
 *
 * `HIRING_PARTNERS` (site-data.ts) carries a real logo file and a real
 * destination URL for 11 of the 12 companies, fetched directly from each
 * company's own site (or Wikimedia Commons for the five with a proper
 * Wikipedia entry) — never generated, never guessed, never pulled from an
 * unrelated stock source. See that file's own header comment for exactly
 * where each one came from, and for the one exception (Tkxel, whose site
 * rate-limited the fetch mid-session).
 *
 * Each entry renders one of two ways:
 *   - `logo` present  -> the real mark in an `<img>`, dimmed to grayscale at
 *     rest and returning to full colour on hover — the same "trusted by"
 *     treatment most product sites use for a client-logo strip, so a dozen
 *     unrelated brand colours don't fight each other in one row.
 *   - `logo` absent   -> a styled wordmark chip: bold text in a bordered
 *     pill, muted until hovered. Tkxel renders this way today.
 * Independently, `url` present wraps the entry in a link that opens the real
 * company site in a new tab; `url` absent renders a plain, non-interactive
 * mark — nothing in this list is currently missing a URL, but a future entry
 * without one degrades to non-clickable rather than linking nowhere.
 */

import { ExternalLink } from 'lucide-react'

import { Marquee } from '@/components/motion/marquee'
import type { HiringPartner } from '@/lib/site-data'
import { cn } from '@/lib/utils'

export function PartnerStrip({
  partners,
  className,
  duration = '45s',
}: {
  partners: readonly HiringPartner[]
  className?: string
  duration?: string
}) {
  return (
    <section className={cn('border-y border-border bg-muted/25 py-12', className)}>
      <p className="mb-8 text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Our graduates work at
      </p>
      <Marquee duration={duration}>
        {partners.map((partner) => (
          <PartnerMark key={partner.slug} partner={partner} />
        ))}
      </Marquee>
    </section>
  )
}

function PartnerMark({ partner }: { partner: HiringPartner }) {
  const content = partner.logo ? (
    <img
      src={partner.logo}
      alt={partner.name}
      className="h-7 w-auto object-contain opacity-70 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
    />
  ) : (
    <span
      className={cn(
        'rounded-full border border-border px-5 py-2.5 text-base font-bold tracking-tight text-muted-foreground/55',
        'transition-colors duration-300 group-hover:border-primary/30 group-hover:text-primary',
      )}
    >
      {partner.name}
    </span>
  )

  const className = 'group mx-3 flex shrink-0 items-center'

  if (partner.url) {
    return (
      <a
        href={partner.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${partner.name} (opens in a new tab)`}
        className={cn(className, 'gap-1.5')}
      >
        {content}
        <ExternalLink className="size-3 shrink-0 text-muted-foreground/0 transition-colors duration-300 group-hover:text-muted-foreground/50" />
      </a>
    )
  }

  return <span className={className}>{content}</span>
}
