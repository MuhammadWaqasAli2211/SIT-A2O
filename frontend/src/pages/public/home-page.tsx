import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  PlayCircle,
  Quote,
  Sparkles,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Counter } from '@/components/motion/counter'
import { Marquee } from '@/components/motion/marquee'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { Eyebrow, Section, SectionHeading } from '@/components/shared/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ADMISSION_STEPS,
  HIRING_PARTNERS,
  PROGRAMS,
  STATS,
  TESTIMONIALS,
  VALUES,
} from '@/lib/site-data'
import { cn } from '@/lib/utils'

export default function HomePage() {
  return (
    <>
      <Hero />
      <PartnerStrip />
      <StatsBand />
      <ProgramsSection />
      <ProcessSection />
      <ValuesSection />
      <TestimonialsSection />
      <CtaSection />
    </>
  )
}

/* ------------------------------------------------------------------ hero -- */

function Hero() {
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Decorative background: aurora blobs over a faint grid. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 surface-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        <div className="absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/18 blur-3xl animate-aurora" />
        <div className="absolute top-24 right-[8%] size-[26rem] rounded-full bg-chart-2/14 blur-3xl animate-aurora [animation-delay:-6s]" />
        <div className="absolute -bottom-24 left-[6%] size-[24rem] rounded-full bg-chart-4/12 blur-3xl animate-aurora [animation-delay:-11s]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Eyebrow>
              <Sparkles className="size-3.5" />
              Admissions open for Bootcamp 07
            </Eyebrow>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl lg:leading-[1.05]"
          >
            Build a career in tech.{' '}
            <span className="text-gradient">Pay nothing for it.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            Saylani Mass IT Training has taught over 250,000 students the skills that get
            them hired — in classrooms across Pakistan, entirely free of charge.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Button render={<Link to="/signup" />} size="lg" className="group h-11 px-6 text-sm">
              Start your application
              <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
            </Button>
            <Button
              render={<Link to="/programs" />}
              variant="outline"
              size="lg"
              className="h-11 px-6 text-sm"
            >
              <PlayCircle className="size-4" />
              Explore programs
            </Button>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.34 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-muted-foreground"
          >
            {['100% free, always', 'Industry-aligned curriculum', 'Certificate on completion'].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  {item}
                </li>
              ),
            )}
          </motion.ul>
        </div>

        {/* Floating application-status preview */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="relative mx-auto mt-20 max-w-4xl"
        >
          <div
            aria-hidden="true"
            className="absolute -inset-x-6 -top-6 bottom-0 rounded-[2rem] bg-gradient-to-b from-primary/12 to-transparent blur-2xl"
          />
          <Card className={cn('relative overflow-hidden border-border/70 shadow-2xl shadow-primary/5', !reduce && 'animate-float')}>
            <CardContent className="p-0">
              <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-5 py-3">
                <span className="size-2.5 rounded-full bg-destructive/60" />
                <span className="size-2.5 rounded-full bg-warning/60" />
                <span className="size-2.5 rounded-full bg-success/60" />
                <span className="ml-3 text-xs text-muted-foreground">
                  Application status — B07-142
                </span>
              </div>

              <div className="grid gap-px bg-border sm:grid-cols-4">
                {[
                  { label: 'Application', status: 'done', detail: 'Submitted 12 Aug' },
                  { label: 'Interview', status: 'done', detail: 'Passed · Slot 2' },
                  { label: 'Assessment', status: 'active', detail: 'Today, 11:00' },
                  { label: 'Onboarding', status: 'pending', detail: 'Awaiting' },
                ].map((stage, i) => (
                  <motion.div
                    key={stage.label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 + i * 0.12 }}
                    className="flex flex-col gap-2 bg-card p-5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'grid size-6 place-items-center rounded-full text-[0.65rem] font-semibold',
                          stage.status === 'done' && 'bg-primary text-primary-foreground',
                          stage.status === 'active' &&
                            'bg-warning/20 text-warning-foreground ring-2 ring-warning/40',
                          stage.status === 'pending' && 'bg-muted text-muted-foreground',
                        )}
                      >
                        {stage.status === 'done' ? <BadgeCheck className="size-3.5" /> : i + 1}
                      </span>
                      <span className="text-sm font-medium">{stage.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{stage.detail}</span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- partners -- */

function PartnerStrip() {
  return (
    <section className="border-y border-border bg-muted/25 py-10">
      <p className="mb-7 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Our graduates work at
      </p>
      <Marquee duration="45s">
        {HIRING_PARTNERS.map((partner) => (
          <span
            key={partner}
            className="mx-8 whitespace-nowrap text-lg font-semibold text-muted-foreground/60 transition-colors duration-300 hover:text-primary"
          >
            {partner}
          </span>
        ))}
      </Marquee>
    </section>
  )
}

/* ------------------------------------------------------------------ stats -- */

function StatsBand() {
  return (
    <Section className="py-16 sm:py-20">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat, index) => (
          <Reveal key={stat.label} delay={index * 0.08} className="flex flex-col items-center gap-2 text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <stat.icon className="size-5" />
            </span>
            <span className="text-3xl font-semibold tracking-tight sm:text-4xl">
              <Counter to={stat.value} suffix={stat.suffix} />
            </span>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* --------------------------------------------------------------- programs -- */

function ProgramsSection() {
  return (
    <Section id="programs" className="bg-muted/25">
      <SectionHeading
        eyebrow="Programs"
        title="Choose the track that fits where you want to go"
        description="Five specialisations, each built with hiring partners and taught by working practitioners. All of them free."
      />

      <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PROGRAMS.map((program) => (
          <StaggerItem key={program.slug}>
            <Link to={`/programs/${program.slug}`} className="group block h-full">
              <Card className="relative h-full overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                <div
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                    program.accent,
                  )}
                />
                <CardContent className="relative flex h-full flex-col gap-4 p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                    <program.icon className="size-5" />
                  </span>

                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold tracking-tight">{program.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {program.tagline}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {program.skills.slice(0, 4).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-[0.7rem]">
                        {skill}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      {program.duration}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {program.seats} seats
                    </span>
                    <span className="flex items-center gap-1 font-medium text-primary">
                      Details
                      <ArrowRight className="size-3.5 transition-transform duration-250 group-hover:translate-x-1" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </StaggerItem>
        ))}

        <StaggerItem>
          <Link to="/programs" className="group block h-full">
            <Card className="flex h-full items-center justify-center border-dashed transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:bg-primary/5">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <span className="grid size-11 place-items-center rounded-xl border border-dashed border-primary/40 text-primary transition-transform duration-300 group-hover:rotate-90">
                  <ArrowRight className="size-5" />
                </span>
                <span className="text-sm font-medium">See all programs</span>
                <span className="text-xs text-muted-foreground">
                  Compare tracks, durations, and outcomes
                </span>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>
      </Stagger>
    </Section>
  )
}

/* ---------------------------------------------------------------- process -- */

function ProcessSection() {
  return (
    <Section id="process">
      <SectionHeading
        eyebrow="How it works"
        title="Four stages, clearly defined"
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

        <div className="grid gap-10 lg:grid-cols-4">
          {ADMISSION_STEPS.map((step, index) => (
            <Reveal key={step.step} delay={index * 0.12} className="relative flex flex-col gap-4">
              <span className="relative grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary shadow-sm">
                <step.icon className="size-6" />
                <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-primary text-[0.65rem] font-bold text-primary-foreground">
                  {step.step}
                </span>
              </span>
              <h3 className="text-base font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
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

function CtaSection() {
  return (
    <Section className="pb-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-primary/5 to-chart-2/10 px-6 py-16 text-center sm:px-14 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl animate-aurora"
          />

          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
            <Eyebrow>
              <CalendarClock className="size-3.5" />
              Registration closes 30 September
            </Eyebrow>

            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Your seat in Bootcamp 07 is still open
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
