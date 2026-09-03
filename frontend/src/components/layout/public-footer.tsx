/**
 * The site footer.
 *
 * Built around what a footer is actually for. People reach one having failed
 * to find something higher up the page, or wanting to check something before
 * they commit — so this leads with a live status line and a way to apply,
 * groups its links by intent rather than by the site's own section names, and
 * keeps legal and support exactly where convention puts them: the bottom bar.
 *
 * Three things here are deliberate rather than decorative:
 *
 * - **The status band is real.** It reads `/bootcamps/open` through the same
 *   `useOpenBootcamp` hook the hero badge uses, so "applications are open" is
 *   never a claim the server would contradict. When nothing is open it says
 *   so, rather than quietly disappearing — a visitor who scrolled to the
 *   bottom looking for the deadline is owed an answer either way. (The hook
 *   caches across mounts, so sharing it with the hero costs no extra request.)
 *
 * - **Groups collapse on mobile.** Four columns of links stacked flat push the
 *   copyright and the legal links off the bottom of a phone screen, which is
 *   the one part of a footer people scroll down specifically to reach. Below
 *   `sm` each group is a real disclosure button; from `sm` up it is a plain
 *   heading over an always-visible list. Two separate elements, each correct
 *   for its breakpoint, rather than one element with an `aria-expanded` that
 *   lies at half the widths it renders at.
 *
 * - **Contact details come from `lib/contact.ts`.** Several of them are
 *   unverified placeholders inherited from the original build; that file's
 *   header says exactly which, and having one source means correcting them is
 *   a one-line change rather than a hunt through four files.
 */

import { useId, useState } from 'react'
import { ArrowRight, CalendarClock, ChevronDown, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { BrandLockup } from '@/features/marketing/brand'
import { bootcampLabel, useOpenBootcamp } from '@/features/marketing/use-open-bootcamp'
import { CONTACT, SOCIAL_LINKS } from '@/lib/contact'
import { FOOTER_LINKS, LEGAL_LINKS } from '@/lib/site-data'
import { cn } from '@/lib/utils'

export function PublicFooter() {
  return (
    <footer className="relative border-t border-border bg-muted/30">
      <ApplyBand />

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)] lg:gap-8">
          <Reveal className="flex flex-col gap-5">
            <Link to="/" className="group w-fit" aria-label="Bootcamp Flows — home">
              <BrandLockup />
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Free, industry-aligned IT education for everyone. Every programme costs
              nothing to apply to and nothing to attend.
            </p>

            <address className="flex flex-col gap-2.5 text-sm text-muted-foreground not-italic">
              <span className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  {CONTACT.addressLine}, {CONTACT.city}
                </span>
              </span>
              <a
                href={CONTACT.phoneHref}
                className="flex w-fit items-center gap-2.5 transition-colors hover:text-foreground"
              >
                <Phone className="size-4 shrink-0 text-primary" />
                {CONTACT.phone}
              </a>
              <a
                href={CONTACT.emailHref}
                className="flex w-fit items-center gap-2.5 transition-colors hover:text-foreground"
              >
                <Mail className="size-4 shrink-0 text-primary" />
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
                  className="grid size-10 place-items-center rounded-lg border border-border text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary"
                >
                  <social.Icon className="size-4" />
                </a>
              ))}
            </div>
          </Reveal>

          {/* The four link groups. `divide-y` below sm gives each collapsed
              group a visible boundary; it is removed once they sit in columns. */}
          <div className="divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-8 sm:divide-y-0 lg:contents">
            {FOOTER_LINKS.map((group, index) => (
              <FooterGroup key={group.heading} heading={group.heading} links={group.links} delay={0.05 * (index + 1)} />
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col-reverse items-center justify-between gap-5 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} Saylani Welfare International Trust. All rights
            reserved.
          </p>

          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------ apply band -- */

/**
 * The live status line across the top of the footer.
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
          className="flex w-full items-center justify-between py-4 text-sm font-semibold"
        >
          {heading}
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 text-muted-foreground transition-transform duration-300', open && 'rotate-180')}
          />
        </button>
      </h3>

      <h3 className="hidden text-sm font-semibold sm:block">{heading}</h3>

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
              className="-my-1 block py-1 text-sm text-muted-foreground transition-colors hover:text-primary sm:my-0 sm:py-0"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </Reveal>
  )
}
