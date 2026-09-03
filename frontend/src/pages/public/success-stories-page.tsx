/**
 * Success stories.
 *
 * A testimonials page earns trust or it does nothing, so the structure here
 * is built around specificity rather than volume: each story leads with the
 * transition it describes (where the person started → what they do now),
 * because "retail sales → full-stack developer" is the claim a reader is
 * actually evaluating, and the quote is evidence for it rather than the
 * point itself. Filtering by track is there for the same reason — a designer
 * is not persuaded by a DevOps story.
 *
 * ## Nothing here is presented as sourced
 *
 * The quotes are representative examples, not statements from named alumni,
 * and the outcome figures are unverified. Both carry a visible caveat via
 * `features/marketing/caveat.tsx`. See `TESTIMONIALS` and `STATS` in
 * site-data.ts for the full reasoning and what replacing them requires.
 *
 * The hiring-partner logos are the one genuinely real thing on the page:
 * fetched from each company's own site or Wikimedia Commons, self-hosted, and
 * linked out. `PartnerStrip` and `HIRING_PARTNERS` carry that detail.
 */

import { useMemo, useState } from 'react'
import { ArrowRight, Briefcase, Quote, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Counter } from '@/components/motion/counter'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section, SectionHeading } from '@/components/shared/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatCaveat, TestimonialCaveat } from '@/features/marketing/caveat'
import { PartnerStrip } from '@/features/marketing/partner-strip'
import { bootcampLabel, useOpenBootcamp } from '@/features/marketing/use-open-bootcamp'
import { HIRING_PARTNERS, PROGRAMS, TESTIMONIALS } from '@/lib/site-data'
import { cn } from '@/lib/utils'

const OUTCOMES = [
  { label: 'Graduates placed', value: 78, suffix: '%' },
  { label: 'Average months to hire', value: 4.5, suffix: '', decimals: 1 },
  { label: 'Hiring partners', value: 120, suffix: '+' },
  { label: 'Alumni network', value: 250000, suffix: '+' },
]

/**
 * The longer stories.
 *
 * `program` matches a `PROGRAMS` title exactly so the track filter can key
 * off it without a second mapping to keep in step. First names only — see the
 * note on `TESTIMONIALS` in site-data.ts.
 */
const FEATURED = [
  {
    name: 'Ayesha S.',
    initials: 'AS',
    role: 'Frontend Engineer',
    company: 'Systems Ltd',
    program: 'Web & App Development',
    before: 'Fresh graduate, no coding background',
    quote:
      'I applied with no coding background at all. Six months later I was writing production React. The instructors never once made me feel behind — they just kept giving me harder problems until the concepts stuck.',
  },
  {
    name: 'Bilal A.',
    initials: 'BA',
    role: 'Full-Stack Developer',
    company: 'Careem',
    program: 'Web & App Development',
    before: 'Retail sales, studying evenings',
    quote:
      'The batch interview process was the most organised thing I have been through. I knew my slot, my candidate code, and my status at every step — no chasing anybody for updates.',
  },
  {
    name: 'Fatima K.',
    initials: 'FK',
    role: 'Data Analyst',
    company: 'Telenor',
    program: 'Data Science & AI',
    before: 'Statistics graduate, no industry experience',
    quote:
      'What surprised me was the project work. We built and deployed real applications on real datasets, so my portfolio was ready before I even graduated.',
  },
  {
    name: 'Usman T.',
    initials: 'UT',
    role: 'DevOps Engineer',
    company: 'Netsol',
    program: 'Cloud & DevOps',
    before: 'IT support technician',
    quote:
      'Completely free, and yet more rigorous than paid courses I had tried before. The physical assessment made sure everyone in the room was serious about finishing.',
  },
  {
    name: 'Zainab A.',
    initials: 'ZA',
    role: 'Mobile Developer',
    company: 'Bazaar',
    program: 'Mobile Development',
    before: 'Working days, studying nights',
    quote:
      'I was working days and studying evenings. The schedule made that genuinely possible, and the mentors were reachable whenever I got stuck on something.',
  },
  {
    name: 'Hamza S.',
    initials: 'HS',
    role: 'Product Designer',
    company: '10Pearls',
    program: 'UI/UX Design',
    before: 'Self-taught, no formal portfolio',
    quote:
      'The case-study approach changed how I interview. I stopped showing screens and started explaining decisions, and offers followed almost immediately.',
  },
]

/** Track filter options, derived so a new programme cannot be left out. */
const TRACKS = ['All tracks', ...PROGRAMS.map((p) => p.title)]

export default function SuccessStoriesPage() {
  const [track, setTrack] = useState<string>('All tracks')
  const { bootcamp } = useOpenBootcamp()
  const label = bootcamp ? bootcampLabel(bootcamp) : null

  const visible = useMemo(
    () => (track === 'All tracks' ? FEATURED : FEATURED.filter((s) => s.program === track)),
    [track],
  )

  return (
    <>
      <PageHero
        eyebrow="Success stories"
        title="Where our graduates are now"
        description="Outcomes from people who started exactly where you are — many with no technical background at all."
        crumbs={[{ label: 'Success Stories' }]}
      />

      {/* ------------------------------------------------------ outcomes -- */}
      <Section className="py-14 sm:py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOMES.map((outcome, index) => (
            <Reveal
              key={outcome.label}
              delay={index * 0.08}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span className="text-4xl font-semibold tracking-tight text-primary">
                <Counter
                  to={outcome.value}
                  suffix={outcome.suffix}
                  decimals={outcome.decimals ?? 0}
                />
              </span>
              <span className="text-sm text-muted-foreground">{outcome.label}</span>
            </Reveal>
          ))}
        </div>
        <StatCaveat />
      </Section>

      {/* ------------------------------------------------------- stories -- */}
      <Section className="border-y border-border bg-muted/25 pt-4">
        <SectionHeading
          eyebrow="In their words"
          title="Six journeys, one starting point"
          description="Each of these graduates joined a free programme with no guarantee of a place, and left with a job in the industry."
        />

        <Reveal delay={0.1} className="mt-12 flex flex-wrap justify-center gap-2">
          {TRACKS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTrack(option)}
              aria-pressed={track === option}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
                track === option
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {option}
            </button>
          ))}
        </Reveal>

        {visible.length === 0 ? (
          <Reveal className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="font-medium">No stories from this track yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              It is a newer programme. The stories from other tracks describe the same
              process and the same support.
            </p>
            <Button variant="outline" onClick={() => setTrack('All tracks')}>
              Show every track
            </Button>
          </Reveal>
        ) : (
          <Stagger key={track} className="mt-10 grid gap-6 lg:grid-cols-2">
            {visible.map((story) => (
              <StaggerItem key={story.name} className="h-full">
                <StoryCard story={story} />
              </StaggerItem>
            ))}
          </Stagger>
        )}

        <TestimonialCaveat />
      </Section>

      {/* ------------------------------------------------------ partners -- */}
      <Section>
        <SectionHeading
          eyebrow="Hiring partners"
          title="Companies that hire our graduates"
          description="We review curriculum with these teams each intake, so what you learn is what they are using. Every logo links to the company itself."
        />

        <PartnerStrip
          partners={HIRING_PARTNERS}
          duration="50s"
          className="mt-12 border-y-0 bg-transparent py-0"
        />
      </Section>

      {/* -------------------------------------------------- short quotes -- */}
      <Section className="border-t border-border bg-muted/25 pt-4">
        <SectionHeading
          eyebrow="More voices"
          title="What the process felt like"
          description="Less about the curriculum, more about what it is actually like to go through an intake."
        />

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <StaggerItem key={testimonial.name} className="h-full">
              <Card className="h-full transition-colors duration-300 hover:border-primary/30">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <Quote className="size-5 text-primary/30" />
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                    “{testimonial.quote}”
                  </p>
                  <div className="flex items-center gap-3 border-t border-border pt-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                      {testimonial.initials}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm font-medium">{testimonial.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {testimonial.role} · {testimonial.company}
                      </span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>

        <TestimonialCaveat />
      </Section>

      {/* ----------------------------------------------------------- cta -- */}
      <Section className="pb-28">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Your story could be next
          </h2>
          <p className="text-muted-foreground">
            {label
              ? `Applications for ${label} are open now. It costs nothing to apply and nothing to attend.`
              : 'Intakes run several times a year. It costs nothing to apply and nothing to attend.'}
          </p>
          <Button render={<Link to="/signup" />} size="lg" className="group h-11 px-6">
            Start your application
            <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
          </Button>
        </Reveal>
      </Section>
    </>
  )
}

/* ----------------------------------------------------------------- story -- */

function StoryCard({ story }: { story: (typeof FEATURED)[number] }) {
  return (
    <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
      <CardContent className="flex h-full flex-col gap-5 p-7">
        {/*
          The transition first, in its own row. It is the claim the reader is
          evaluating — the quote below is evidence for it, not the headline.
        */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {story.before}
          </span>
          <TrendingUp aria-hidden="true" className="size-4 shrink-0 text-primary" />
          <span className="rounded-full bg-primary/12 px-3 py-1 font-medium text-primary">
            {story.role}
          </span>
        </div>

        <Quote className="size-6 text-primary/30" />
        <p className="flex-1 text-sm leading-relaxed text-foreground/85">
          “{story.quote}”
        </p>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary transition-transform duration-300 group-hover:scale-110">
              {story.initials}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{story.name}</span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Briefcase className="size-3.5" />
                {story.company}
              </span>
            </span>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[0.7rem]">
            {story.program}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
