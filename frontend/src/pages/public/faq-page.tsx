/**
 * Frequently asked questions.
 *
 * Structured the way an FAQ that people actually read before applying has to
 * be, rather than as one long accordion:
 *
 * - **Topic rail, not one flat list.** Six groups is past the point where a
 *   single column can be scanned. The rail is sticky on wide screens and a
 *   horizontal chip row on narrow ones, so the topics stay reachable while
 *   you are deep inside one of them.
 * - **Search filters across every group at once**, and says how many matched.
 *   Filtering hides the rail's inactive topics rather than leaving chips that
 *   lead to empty sections.
 * - **The first question of each group opens by default.** An accordion
 *   showing nothing but closed rows makes a visitor work before they learn
 *   anything; opening one proves the rows contain answers.
 * - **A real escape hatch at the bottom.** Every FAQ leaves somebody
 *   unanswered, and the failure mode is them leaving rather than asking.
 *
 * The answers themselves are in `site-data.ts` and are grounded in what the
 * platform actually does — that file's header maps each one to the code it
 * came from.
 */

import { useMemo, useState } from 'react'
import { ArrowRight, MessageCircleQuestion, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section } from '@/components/shared/section'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CONTACT } from '@/lib/contact'
import { FAQS } from '@/lib/site-data'
import { cn } from '@/lib/utils'

/** A group heading turned into a stable anchor id. */
function anchorFor(category: string): string {
  return `faq-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
}

export default function FaqPage() {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return FAQS

    return FAQS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.q.toLowerCase().includes(needle) || item.a.toLowerCase().includes(needle),
      ),
    })).filter((group) => group.items.length > 0)
  }, [query])

  const total = results.reduce((sum, group) => sum + group.items.length, 0)
  const searching = query.trim().length > 0

  return (
    <>
      <PageHero
        eyebrow="Support"
        title="Frequently asked questions"
        description="What applicants ask us most, answered from how the process actually runs. If yours is not here, the admissions team is one message away."
        crumbs={[{ label: 'FAQs' }]}
      >
        <div className="relative max-w-md">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions..."
            aria-label="Search frequently asked questions"
            className="pl-9"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </PageHero>

      <Section>
        {results.length === 0 ? (
          <Reveal className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-2xl border border-dashed border-border py-20 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <MessageCircleQuestion className="size-6" />
            </span>
            <div className="flex flex-col gap-1.5">
              <p className="font-medium">Nothing matches “{query.trim()}”</p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Try a different wording, or ask us directly — {CONTACT.replyPromise.toLowerCase()}.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" onClick={() => setQuery('')}>
                Clear search
              </Button>
              <Button render={<Link to="/contact" />}>Contact admissions</Button>
            </div>
          </Reveal>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
            <TopicRail groups={results} />

            <div className="flex min-w-0 flex-col gap-14">
              {searching && (
                <p aria-live="polite" className="-mb-6 text-sm text-muted-foreground">
                  {total} {total === 1 ? 'question' : 'questions'} matching “{query.trim()}”
                </p>
              )}

              {results.map((group, groupIndex) => (
                <Reveal
                  key={group.category}
                  delay={Math.min(groupIndex, 3) * 0.06}
                  as="section"
                >
                  {/* The id and its scroll offset live on the same element:
                      an anchor scrolls to whatever carries the id, so a
                      scroll-mt on an ancestor would not clear the header. */}
                  <div
                    id={anchorFor(group.category)}
                    className="flex scroll-mt-28 items-start gap-3.5"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <group.icon className="size-5" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <h2 className="text-lg font-semibold tracking-tight">
                        {group.category}
                      </h2>
                      <p className="text-sm text-muted-foreground">{group.blurb}</p>
                    </div>
                  </div>

                  <Accordion
                    className="mt-5 w-full"
                    // The first row of each group starts open. Base UI keys
                    // this by item value, which is the question text.
                    defaultValue={group.items[0] ? [group.items[0].q] : []}
                  >
                    {group.items.map((item) => (
                      <AccordionItem key={item.q} value={item.q}>
                        <AccordionTrigger className="gap-4 py-4 text-left text-sm font-medium">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="max-w-2xl pr-8 text-sm leading-relaxed text-muted-foreground">
                            {item.a}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </Section>

      <StillNeedHelp />
    </>
  )
}

/* ------------------------------------------------------------ topic rail -- */

/**
 * The topic index.
 *
 * Two presentations of one list: a sticky vertical rail from `lg`, and a
 * horizontally scrolling chip row below it. Not `hidden`/`block` on two
 * separate copies — one list, restyled, so the anchors cannot fall out of
 * sync with the sections they point at.
 */
function TopicRail({ groups }: { groups: typeof FAQS }) {
  return (
    <nav
      aria-label="FAQ topics"
      className="lg:sticky lg:top-28 lg:self-start"
    >
      <h2 className="mb-3 hidden text-xs font-semibold tracking-widest text-muted-foreground uppercase lg:block">
        Topics
      </h2>

      <ul
        className={cn(
          // Below lg: a scrolling chip row. `-mx-4 px-4` lets it bleed to the
          // screen edge inside the section's padding, so the last chip does
          // not look clipped against a hard margin.
          'scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1',
          'lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0',
        )}
      >
        {groups.map((group) => (
          <li key={group.category} className="shrink-0">
            <a
              href={`#${anchorFor(group.category)}`}
              className={cn(
                'flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm whitespace-nowrap text-muted-foreground',
                'transition-colors hover:border-primary/40 hover:text-foreground',
                'lg:rounded-lg lg:border-0 lg:px-3 lg:whitespace-normal lg:hover:bg-muted',
              )}
            >
              <group.icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
              {group.category}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/* ---------------------------------------------------------- escape hatch -- */

function StillNeedHelp() {
  return (
    <Section className="border-t border-border bg-muted/25">
      <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
          <MessageCircleQuestion className="size-6" />
        </span>

        <div className="flex flex-col gap-2.5">
          <h2 className="text-2xl font-semibold tracking-tight">
            Still need help?
          </h2>
          <p className="text-muted-foreground">
            Ask the admissions team directly — {CONTACT.replyPromise.toLowerCase()}. If you
            have already applied, quote your candidate code and we can look at your
            application specifically.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button render={<Link to="/contact" />} size="lg" className="group h-11 px-6">
            Message the team
            <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
          </Button>
          <Button
            render={<a href={CONTACT.phoneHref} />}
            variant="outline"
            size="lg"
            className="h-11 px-6"
          >
            Call {CONTACT.phone}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Or read the{' '}
          <Link to="/admissions" className="font-medium text-primary hover:underline">
            full admissions guide
          </Link>{' '}
          for how each stage works.
        </p>
      </Reveal>
    </Section>
  )
}
