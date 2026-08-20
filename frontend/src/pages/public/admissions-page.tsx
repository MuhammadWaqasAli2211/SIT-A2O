import { motion } from 'motion/react'
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section, SectionHeading } from '@/components/shared/section'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ADMISSION_STEPS } from '@/lib/site-data'
import { cn } from '@/lib/utils'

const ELIGIBLE = [
  'Matriculation (10th grade) or above',
  'Aged 16 or older at the time of applying',
  'Able to attend the full duration of the programme',
  'Basic computer literacy and access to a computer',
  'Valid CNIC or B-Form',
]

const NOT_ELIGIBLE = [
  'Currently enrolled in another Saylani IT programme',
  'Previously completed the same track',
  'Unable to commit to the class schedule',
]

const DATES = [
  { phase: 'Registration opens', date: '01 September 2026', status: 'done' },
  { phase: 'Registration closes', date: '30 September 2026', status: 'active' },
  { phase: 'Interview invitations sent', date: '05 October 2026', status: 'upcoming' },
  { phase: 'Screening interviews', date: '08 – 12 October 2026', status: 'upcoming' },
  { phase: 'Physical assessments', date: '15 – 19 October 2026', status: 'upcoming' },
  { phase: 'Results announced', date: '22 October 2026', status: 'upcoming' },
  { phase: 'Classes begin', date: '01 November 2026', status: 'upcoming' },
]

export default function AdmissionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Admissions"
        title="How to join Bootcamp 07"
        description="A structured, deadline-driven process. Every applicant gets a unique candidate code and can see exactly where they stand at each stage."
        crumbs={[{ label: 'Admissions' }]}
      >
        <Button render={<Link to="/signup" />} size="lg" className="group h-11">
          Start your application
          <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
        </Button>
      </PageHero>

      {/* ------------------------------------------------------- process -- */}
      <Section id="process">
        <SectionHeading
          eyebrow="The process"
          title="Four stages from application to enrolment"
          description="Each stage has its own deadline. Miss one and the system closes it — so complete each step as soon as you are notified."
        />

        <div className="relative mt-16">
          <motion.div
            aria-hidden="true"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            className="absolute top-0 bottom-0 left-7 hidden w-px origin-top bg-gradient-to-b from-primary/50 via-primary/25 to-transparent sm:block"
          />

          <div className="flex flex-col gap-10">
            {ADMISSION_STEPS.map((step, index) => (
              <Reveal
                key={step.step}
                delay={index * 0.1}
                direction="right"
                className="relative flex gap-6"
              >
                <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl border border-border bg-card text-primary shadow-sm">
                  <step.icon className="size-6" />
                  <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-primary text-[0.65rem] font-bold text-primary-foreground">
                    {step.step}
                  </span>
                </span>
                <div className="flex flex-1 flex-col gap-2 pt-1">
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="max-w-2xl leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------- eligibility -- */}
      <Section id="eligibility" className="border-y border-border bg-muted/25">
        <SectionHeading
          eyebrow="Eligibility"
          title="Who can apply"
          description="Most of our programmes are genuinely beginner friendly. Prior coding experience is not required unless a track says otherwise."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal direction="right">
            <Card className="h-full border-success/25">
              <CardContent className="flex flex-col gap-4 p-7">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-success/12 text-success">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <h3 className="text-base font-semibold">You are eligible if</h3>
                </div>
                <ul className="flex flex-col gap-3">
                  {ELIGIBLE.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal direction="left">
            <Card className="h-full border-destructive/25">
              <CardContent className="flex flex-col gap-4 p-7">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-destructive/12 text-destructive">
                    <XCircle className="size-5" />
                  </span>
                  <h3 className="text-base font-semibold">You cannot apply if</h3>
                </div>
                <ul className="flex flex-col gap-3">
                  {NOT_ELIGIBLE.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="mt-8">
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>One application per intake</AlertTitle>
            <AlertDescription>
              You may apply to a single programme per cycle so that seats are allocated
              fairly. If you are not selected, you are welcome to apply again next intake.
            </AlertDescription>
          </Alert>
        </Reveal>
      </Section>

      {/* --------------------------------------------------------- dates -- */}
      <Section id="dates">
        <SectionHeading
          eyebrow="Important dates"
          title="Bootcamp 07 timeline"
          description="Deadlines are enforced automatically. Once a stage closes it cannot be reopened for individual applicants."
        />

        <Stagger className="mx-auto mt-12 flex max-w-3xl flex-col gap-3">
          {DATES.map((entry) => (
            <StaggerItem key={entry.phase}>
              <div
                className={cn(
                  'flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors sm:p-5',
                  entry.status === 'active'
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-card hover:border-primary/25',
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-lg',
                      entry.status === 'done' && 'bg-success/12 text-success',
                      entry.status === 'active' && 'bg-primary text-primary-foreground',
                      entry.status === 'upcoming' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {entry.status === 'done' ? (
                      <CheckCircle2 className="size-4.5" />
                    ) : (
                      <CalendarClock className="size-4.5" />
                    )}
                  </span>
                  <span className="text-sm font-medium">{entry.phase}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-right text-sm text-muted-foreground">{entry.date}</span>
                  {entry.status === 'active' && <Badge>Open now</Badge>}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.2} className="mt-12 flex justify-center">
          <Button render={<Link to="/signup" />} size="lg" className="group h-11 px-6">
            Apply before 30 September
            <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
          </Button>
        </Reveal>
      </Section>
    </>
  )
}
