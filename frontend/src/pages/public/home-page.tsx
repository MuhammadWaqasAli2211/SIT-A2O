import { motion } from 'motion/react'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Megaphone,
  PlayCircle,
  Quote,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Counter } from '@/components/motion/counter'
import { Marquee } from '@/components/motion/marquee'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { Eyebrow, Section, SectionHeading } from '@/components/shared/section'
import { ApplicationFlowCard } from '@/features/marketing/application-flow-card'
import { StatCaveat, TestimonialCaveat } from '@/features/marketing/caveat'
import { DashboardPreview } from '@/features/marketing/dashboard-preview'
import { JourneyScene } from '@/features/marketing/journey-scene'
import { PartnerStrip } from '@/features/marketing/partner-strip'
import { TrackSelector } from '@/features/marketing/track-selector'
import { bootcampLabel, useOpenBootcamp } from '@/features/marketing/use-open-bootcamp'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  HIRING_PARTNERS,
  STATS,
  TESTIMONIALS,
  VALUES,
} from '@/lib/site-data'
import { JOURNEY_STEPS, TOTAL_STEPS_WORD } from '@/lib/stages'
import { cn } from '@/lib/utils'

export default function HomePage() {
  return (
    <>
      <Hero />
      <PartnerStrip partners={HIRING_PARTNERS} />
      <StatsBand />
      <TrackSelector />
      <ProcessSection />
      <ValuesSection />
      <TestimonialsSection />
      <CtaSection />
    </>
  )
}

/* ------------------------------------------------------------------ hero -- */

function Hero() {
  // Real, from the server: which intake is actually open. The badge is absent
  // rather than stale when nothing is. See use-open-bootcamp.ts.
  const { bootcamp } = useOpenBootcamp()
  const label = bootcamp ? bootcampLabel(bootcamp) : undefined

  return (
    <section className="relative overflow-hidden bg-hero-canvas pt-26 sm:pt-30">
      {/* Decorative: a faint grid under two soft brand blooms. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="surface-grid absolute inset-0 opacity-[0.3] [mask-image:radial-gradient(ellipse_at_50%_20%,black,transparent_70%)]" />
        <div className="animate-aurora absolute -top-40 -left-32 size-[34rem] rounded-full bg-primary/12 blur-3xl" />
        <div className="animate-aurora absolute top-10 right-[-10%] size-[30rem] rounded-full bg-chart-3/10 blur-3xl [animation-delay:-7s]" />
      </div>

      <div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-8">
        {/*
          The preview column is the wider of the two, matching the reference.
          They stack below `xl`, not `lg`: the dashboard card carries a rail,
          four stat cards and two chart panels, and at a 1024px viewport a
          1.18fr column leaves it about 530px — narrower than the same card
          gets when the hero stacks and it spans the full width. Splitting at
          `lg` would make the card smallest exactly where it has the most to
          show.
        */}
        <div className="grid items-center gap-10 pb-16 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:gap-12 xl:pb-20">
          <HeroCopy bootcampLabel={label} />

          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="min-w-0"
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </div>

      {/* Full-bleed transition scene. Sits behind the flow card, which laps
          over its lower edge — the overlap scales with the band, which is
          itself proportional to the viewport width. */}
      <div className="relative">
        <JourneyScene />

        <div className="relative z-10 mx-auto -mt-10 max-w-[90rem] px-4 pb-20 sm:-mt-16 sm:px-6 lg:-mt-24 lg:px-8">
          <ApplicationFlowCard bootcampLabel={label} />
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- hero copy -- */

function HeroCopy({ bootcampLabel: label }: { bootcampLabel?: string }) {
  return (
    <div className="flex flex-col items-start">
      {/*
        Reserved height, not a conditional block. The badge resolves from a
        network call a beat after paint; without a fixed slot the headline
        below it jumps down the moment it lands.
      */}
      <div className="flex h-8 items-center">
        {label && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Eyebrow>
              <Megaphone className="size-3.5" />
              Admissions open for {label}
            </Eyebrow>
          </motion.div>
        )}
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.08 }}
        className="mt-6 text-4xl leading-[1.05] font-bold tracking-tight text-balance text-hero-ink sm:text-5xl lg:text-[3.4rem]"
      >
        Build a career in tech.
        <br />
        <span className="text-primary">Pay nothing for it.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.16 }}
        className="mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg"
      >
        Bootcamp Flows has empowered over 250,000 students across Pakistan with
        industry-focused training — completely free.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.24 }}
        className="mt-8 flex flex-col gap-3 sm:flex-row"
      >
        <Button
          render={<Link to="/signup" />}
          size="lg"
          className="group h-12 rounded-full px-6 text-sm"
        >
          Start your application
          <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
        </Button>
        <Button
          render={<Link to="/programs" />}
          variant="outline"
          size="lg"
          className="h-12 rounded-full border-border bg-card px-6 text-sm"
        >
          <PlayCircle className="size-4" />
          Explore programs
        </Button>
      </motion.div>

      <motion.ul
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.34 }}
        className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm text-muted-foreground"
      >
        {['100% free, always', 'Industry-aligned curriculum', 'Certificate on completion'].map(
          (item) => (
            <li key={item} className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
              {item}
            </li>
          ),
        )}
      </motion.ul>
    </div>
  )
}

/* ------------------------------------------------------------------ stats -- */

function StatsBand() {
  return (
    <Section className="py-16 sm:py-20">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat, index) => {
          const tone = STAT_TONE[index % STAT_TONE.length]
          return (
            <Reveal
              key={stat.label}
              delay={index * 0.08}
              className={cn(
                'flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-8 text-center',
                'transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5',
              )}
            >
              <span className={cn('grid size-12 place-items-center rounded-xl', tone)}>
                <stat.icon className="size-5" />
              </span>
              <span className="text-3xl font-bold tracking-tight text-hero-ink sm:text-4xl">
                <Counter to={stat.value} suffix={stat.suffix} />
              </span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </Reveal>
          )
        })}
      </div>
      {/* STATS is illustrative and every surface rendering it says so. */}
      <StatCaveat />
    </Section>
  )
}

/**
 * Icon-chip tone per stat, cycled by index — the same primary/amber/blue/gold
 * rotation `dashboard-preview.tsx`'s stat cards use, so the two places on the
 * page presenting "a row of stat cards" read as one visual language rather
 * than two independently-invented ones.
 */
const STAT_TONE = [
  'bg-chart-1/12 text-chart-1',
  'bg-warning/15 text-warning',
  'bg-chart-2/12 text-chart-2',
  'bg-chart-3/15 text-chart-3',
]

/* ---------------------------------------------------------------- process -- */

function ProcessSection() {
  return (
    <Section id="process">
      <SectionHeading
        eyebrow="How it works"
        title={`${TOTAL_STEPS_WORD} stages, clearly defined`}
        description="Every applicant receives a unique candidate code and can see exactly where they stand at each step. No guessing, no lost applications."
      />

      <div className="relative mt-16">
        {/* The connecting rail, drawn once as the section scrolls into view. */}
        <motion.div
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 1.1, ease: 'easeInOut' }}
          className="absolute top-7 right-0 left-0 hidden h-px origin-left bg-gradient-to-r from-primary/50 via-primary/25 to-transparent lg:block"
        />

        {/*
          JOURNEY_STEPS — the same 5-stage data the hero's Application Status
          card and a candidate's own tracker read from — not the retired
          4-stage ADMISSION_STEPS. This card grid is a deliberately different
          visual language from the hero's node-and-ring stepper (a flat
          numbered-icon row rather than a connected/animated timeline), so
          the two don't read as one section repeated twice on the same page;
          only the underlying facts are shared, which is the actual fix.
        */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {JOURNEY_STEPS.map((step, index) => (
            <Reveal key={step.key} delay={index * 0.1} className="relative flex flex-col gap-4">
              <span className="relative grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary shadow-sm">
                <step.icon className="size-6" />
                <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-primary text-[0.65rem] font-bold text-primary-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </span>
              <h3 className="text-base font-semibold">{step.label}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.blurb}</p>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal delay={0.2} className="mt-12 flex justify-center">
        <Button render={<Link to="/admissions" />} variant="outline" size="lg" className="group h-11">
          Read the full admissions guide
          <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
        </Button>
      </Reveal>
    </Section>
  )
}

/* ----------------------------------------------------------------- values -- */

function ValuesSection() {
  return (
    <Section className="bg-muted/25">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <SectionHeading
          align="left"
          eyebrow="Why Saylani"
          title="Ability should decide who gets in — not income"
          description="We remove every financial barrier between talented people and a career in technology, then hold the selection process to a single consistent standard."
        />

        <Stagger className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((value) => (
            <StaggerItem key={value.title}>
              <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <CardContent className="flex flex-col gap-3 p-5">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <value.icon className="size-5" />
                  </span>
                  <h3 className="text-sm font-semibold">{value.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  )
}

/* ----------------------------------------------------------- testimonials -- */

function TestimonialsSection() {
  return (
    <Section className="overflow-hidden">
      <SectionHeading
        eyebrow="Success stories"
        title="They started where you are now"
        description="Graduates from across our programmes, in their own words."
      />

      <div className="mt-14 flex flex-col gap-5">
        <Marquee duration="60s">
          {TESTIMONIALS.map((t) => (
            <TestimonialCard key={t.name} testimonial={t} />
          ))}
        </Marquee>
        <Marquee duration="70s" reverse>
          {[...TESTIMONIALS].reverse().map((t) => (
            <TestimonialCard key={`r-${t.name}`} testimonial={t} />
          ))}
        </Marquee>
      </div>

      <TestimonialCaveat />

      <Reveal delay={0.15} className="mt-12 flex justify-center">
        <Button render={<Link to="/success-stories" />} variant="outline" size="lg" className="group h-11">
          Read more stories
          <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
        </Button>
      </Reveal>
    </Section>
  )
}

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof TESTIMONIALS)[number]
}) {
  return (
    <Card className="mx-3 w-[22rem] shrink-0 transition-colors duration-300 hover:border-primary/35">
      <CardContent className="flex flex-col gap-4 p-6">
        <Quote className="size-6 text-primary/35" />
        <p className="text-sm leading-relaxed text-foreground/85">"{testimonial.quote}"</p>
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
  )
}

/* -------------------------------------------------------------------- cta -- */

/**
 * The closing call to action.
 *
 * The intake name and its deadline are read from `/bootcamps/open` rather
 * than typed in. They used to be the strings "Bootcamp 07" and "30
 * September", which are wrong the day intake 08 opens and wrong again the day
 * after the deadline passes — with nothing to prompt anyone to notice. The
 * hook caches, so this costs no request the hero has not already made.
 */
function CtaSection() {
  const { bootcamp } = useOpenBootcamp()
  const label = bootcamp ? bootcampLabel(bootcamp) : null
  const deadline = bootcamp?.registration_deadline
    ? new Date(bootcamp.registration_deadline)
    : null

  return (
    <Section className="pb-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-primary/5 to-chart-2/10 px-6 py-16 text-center sm:px-14 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl animate-aurora"
          />

          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
            {deadline && (
              <Eyebrow>
                <CalendarClock className="size-3.5" />
                Registration closes{' '}
                {deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              </Eyebrow>
            )}

            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              {label ? `Your seat in ${label} is still open` : 'Your seat is waiting'}
            </h2>

            <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Applications take about ten minutes. You will get your candidate code
              immediately and can track every stage from your portal.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button render={<Link to="/signup" />} size="lg" className="group h-11 px-6 text-sm">
                Apply now — it's free
                <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
              </Button>
              <Button
                render={<Link to="/faq" />}
                variant="outline"
                size="lg"
                className="h-11 px-6 text-sm"
              >
                Read the FAQs
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
