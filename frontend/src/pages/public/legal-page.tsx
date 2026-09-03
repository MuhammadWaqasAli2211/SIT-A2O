/**
 * The Privacy Policy and Terms of Service, as real pages.
 *
 * One component for both, because a legal document's structure does not vary
 * with its subject: a summary, a stated effective date, a jump list, and a
 * run of headed sections. Two files would be the same file twice.
 *
 * The layout is the standard one for a long legal page — a sticky contents
 * rail beside the body on wide screens, collapsing to a jump list above the
 * text on narrow ones. Legal pages are almost never read end to end; people
 * arrive looking for one specific thing ("what do they do with my CNIC",
 * "what happens if I miss a deadline") and need to get to it without
 * scrolling through eleven other sections.
 *
 * Text comes from `lib/policies.ts`, shared with the registration dialog.
 */

import { motion } from 'motion/react'
import { FileText, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { CONTACT } from '@/lib/contact'
import { POLICIES, POLICY_EFFECTIVE_DATE, type PolicyKind } from '@/lib/policies'

/** A section heading turned into a stable anchor id. */
function anchorFor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function LegalPage({ kind }: { kind: PolicyKind }) {
  const policy = POLICIES[kind]
  const other: PolicyKind = kind === 'privacy' ? 'terms' : 'privacy'
  const Icon = kind === 'privacy' ? ShieldCheck : FileText

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <Icon className="size-3.5" />
            Legal
          </>
        }
        title={policy.title}
        description={policy.summary}
        crumbs={[{ label: policy.title }]}
      >
        <p className="text-sm text-muted-foreground">
          Effective {POLICY_EFFECTIVE_DATE}
        </p>
      </PageHero>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
          {/* Contents. Sticky beside the body at lg; a plain jump list above
              it below that, where there is no room for a rail.

              The sticky lives on a plain wrapper rather than on the Reveal:
              Reveal animates a transform, and stacking a transform onto the
              stuck element is the kind of interaction that works until a
              browser decides it does not. */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal direction="none">
              <nav aria-labelledby="policy-contents">
                <h2
                  id="policy-contents"
                  className="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
                >
                  On this page
                </h2>
                <ol className="mt-4 flex flex-col gap-1 border-l border-border">
                  {policy.sections.map((section, index) => (
                    <li key={section.heading}>
                      <a
                        href={`#${anchorFor(section.heading)}`}
                        className="-ml-px flex gap-2.5 border-l-2 border-transparent py-1.5 pl-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                      >
                        <span className="tabular-nums text-muted-foreground/50">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span>{section.heading}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </Reveal>
          </div>

          {/* Capped well short of the column. Legal prose at the full ~900px
              this grid would otherwise give it runs past the line length
              anyone reads comfortably, and this is the page most likely to be
              read carefully rather than skimmed. */}
          <div className="flex min-w-0 max-w-3xl flex-col gap-10">
            {policy.sections.map((section, index) => (
              <motion.section
                key={section.heading}
                id={anchorFor(section.heading)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: Math.min(index, 4) * 0.04 }}
                // scroll-mt clears the fixed header when an anchor is hit.
                className="flex scroll-mt-28 flex-col gap-3"
              >
                <h2 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight">
                  <span className="text-sm tabular-nums text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {section.heading}
                </h2>
                <p className="leading-relaxed text-muted-foreground">{section.body}</p>
              </motion.section>
            ))}

            <Reveal
              delay={0.1}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-7"
            >
              <h2 className="text-base font-semibold">Questions about this document?</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Write to{' '}
                <a
                  href={CONTACT.emailHref}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  {CONTACT.email}
                </a>{' '}
                and the admissions team will answer. You can also read the{' '}
                {POLICIES[other].title.toLowerCase()}.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button render={<Link to={`/${other}`} />} variant="outline">
                  Read the {POLICIES[other].title}
                </Button>
                <Button render={<Link to="/contact" />} variant="ghost">
                  Contact admissions
                </Button>
              </div>
            </Reveal>
          </div>
        </div>
      </Section>
    </>
  )
}

export function PrivacyPage() {
  return <LegalPage kind="privacy" />
}

export function TermsPage() {
  return <LegalPage kind="terms" />
}
