/**
 * How to apply.
 *
 * Two structural changes from the previous version, both about telling the
 * truth more precisely:
 *
 * 1. **The process runs on `JourneyStepper` in `numbered` mode**, the same
 *    component and the same `JOURNEY_STEPS` data a candidate sees on their own
 *    tracker. It was a hand-rolled vertical list reading from the retired
 *    4-stage `ADMISSION_STEPS`. This page can no longer describe a process the
 *    `ApplicationStage` enum does not run.
 *
 * 2. **The seven-row "Bootcamp 07 timeline" is gone.** Every date in it was
 *    hardcoded, and five of the seven were dates this platform has no concept
 *    of — there is no "interview invitations sent" or "results announced"
 *    milestone anywhere in the schema. What is actually knowable is narrower
 *    and now comes from the real intake: the registration deadline and the
 *    start date, read from `/bootcamps/open`. The rest is genuinely per
 *    candidate — interview deadlines are captured per *batch*
 *    (`interview_invite_batches.deadline_at`), so two applicants in one intake
 *    can legitimately hold different dates, and a published table would be
 *    wrong for one of them. The page says that instead of inventing a row.
 */

import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, Mail, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { JourneyStepper } from '@/components/shared/journey-stepper'
import { PageHero } from '@/components/shared/page-hero'
import { Section, SectionHeading } from '@/components/shared/section'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { bootcampLabel, useOpenBootcamp } from '@/features/marketing/use-open-bootcamp'
import { TOTAL_STEPS_WORD } from '@/lib/stages'

const ELIGIBLE = [
  'Matriculation (10th grade) or above',
  'Aged 16 or older at the time of applying',
  'Able to attend the full duration of the programme',
  'Basic computer literacy and access to a computer',
  'Valid CNIC, or a B-Form if you are under 18',
]

const NOT_ELIGIBLE = [
  'Currently enrolled in another Saylani IT programme',
  'Previously completed the same track',
  'Unable to commit to the class schedule',
]

/** What you need to hand before you start the form. */
const BEFORE_YOU_START = [
  'Your CNIC number, or B-Form number if you are under 18',
  'Your father’s CNIC number and phone number',
  'Your highest qualification and any prior IT course',
  'A photograph you can upload',
  'About ten minutes',
]

export default function AdmissionsPage() {
  const { bootcamp } = useOpenBootcamp()
  const label = bootcamp ? bootcampLabel(bootcamp) : null

  return (
    <>
      <PageHero
        eyebrow="Admissions"
        title={label ? `How to join ${label}` : 'How admissions work'}
        description="A structured, deadline-driven process. Every applicant gets a unique candidate code and can see exactly where they stand at every stage — no chasing anybody for an update."
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
          title={`${TOTAL_STEPS_WORD} stages from application to enrolment`}
          description="Each stage runs on its own deadline. Miss one and your application is not rejected — it stays exactly where it is until you are given a chance to explain, so act as soon as you are notified."
        />

        {/* The candidate's own stepper, in explainer mode: numbered nodes and
            a sequence that waits until it is actually on screen before it
            plays. Same component, same data, no second copy of the process. */}
        <Reveal delay={0.1} className="mt-16">
          {/* No gap override: the stepper's connectors are absolutely
              positioned against each item's own box and assume the items
              touch, so adding a gap would leave the vertical rail short of
              the node above it. */}
          <JourneyStepper mode="demo" numbered startOnView />
        </Reveal>

        <Stagger className="mt-16 grid gap-6 lg:grid-cols-3">
          {[
            {
              icon: Mail,
              title: 'You are told, twice',
              body: 'Every stage that needs something from you arrives by email and appears in your portal at the same time. A lost email is not a lost slot — check spam, then check your portal.',
            },
            {
              icon: Clock,
              title: 'Deadlines belong to a stage',
              body: 'You only ever count down to one thing: whatever the stage you are standing on requires. Your portal shows it, and the emails for time-limited stages repeat it.',
            },
            {
              icon: CheckCircle2,
              title: 'Nothing advances silently',
              body: 'Your application only moves when a stage genuinely completes. If it stalls, it stays put and visible rather than quietly disappearing from the pool.',
            },
          ].map((item) => (
            <StaggerItem key={item.title} className="h-full">
              <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/30">
                <CardContent className="flex h-full flex-col gap-3 p-6">
                  <span className="grid size-10 w-fit place-items-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="size-5" />
                  </span>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* --------------------------------------------------- eligibility -- */}
      <Section id="eligibility" className="border-y border-border bg-muted/25">
        <SectionHeading
          eyebrow="Eligibility"
          title="Who can apply"
          description="Most tracks are genuinely beginner friendly. Prior coding experience is not required unless a programme page says otherwise."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal direction="right">
            <Card className="h-full border-success/25">
              <CardContent className="flex h-full flex-col gap-4 p-7">
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
              <CardContent className="flex h-full flex-col gap-4 p-7">
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
              fairly, and the platform will not accept a second one on the same account.
              If you are not selected, you are welcome to apply again next intake.
            </AlertDescription>
          </Alert>
        </Reveal>
      </Section>

      {/* --------------------------------------------------------- dates -- */}
      <Section id="dates">
        <SectionHeading
          eyebrow="Dates"
          title={label ? `${label} at a glance` : 'Key dates'}
          description="Two dates apply to everyone in an intake. The rest belong to you personally, and you will not find them on a public page — see below."
        />

        <div className="mx-auto mt-12 flex max-w-3xl flex-col gap-4">
          <IntakeDates />

          <Reveal delay={0.15}>
            <Card className="bg-muted/40">
              <CardContent className="flex gap-4 p-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <CalendarClock className="size-5" />
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-semibold">
                    Your interview and enrolment dates are your own
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Interview slots are issued in batches, and each batch carries its own
                    deadline. That means two people who applied to the same intake on the
                    same day can genuinely hold different interview dates — so there is no
                    single published date we could put here that would be right for
                    everyone. Yours arrives by email and is shown in your portal from the
                    moment it is set.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------ before you start -- */}
      <Section className="border-t border-border bg-muted/25">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <SectionHeading
            align="left"
            eyebrow="Before you start"
            title="Have these to hand"
            description="The form is one sitting — there is no save-and-return — so it is worth gathering these first. Everything you enter can be corrected later by asking the admissions team."
          />

          <Reveal direction="left">
            <ul className="flex flex-col gap-3">
              {BEFORE_YOU_START.map((item, index) => (
                <li
                  key={item}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.2} className="mt-14 flex flex-col justify-center gap-3 sm:flex-row">
          <Button render={<Link to="/signup" />} size="lg" className="group h-11 px-6">
            {label ? `Apply to ${label}` : 'Start your application'}
            <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
          </Button>
          <Button render={<Link to="/faq" />} variant="outline" size="lg" className="h-11 px-6">
            Read the FAQs first
          </Button>
        </Reveal>
      </Section>
    </>
  )
}

/* ----------------------------------------------------------------- dates -- */

/**
 * The two dates that genuinely apply to a whole intake, read from the API.
 *
 * Renders nothing rather than a placeholder when no intake is open or the
 * fields are unset — an empty slot is honest, a made-up date is not.
 */
function IntakeDates() {
  const { bootcamp, loading } = useOpenBootcamp()

  if (loading) return null

  const rows = [
    {
      key: 'deadline',
      label: 'Applications close',
      value: bootcamp?.registration_deadline,
      note: 'The last moment an application can be submitted for this intake.',
      highlight: true,
    },
    {
      key: 'start',
      label: 'Classes begin',
      value: bootcamp?.starts_at,
      note: 'When the first session runs for everyone who is enrolled.',
      highlight: false,
    },
  ].filter((row) => Boolean(row.value))

  if (rows.length === 0) {
    return (
      <Reveal>
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-2 p-6 text-center">
            <h3 className="text-base font-semibold">No intake is open right now</h3>
            <p className="text-sm text-muted-foreground">
              Intakes run several times a year. Dates appear here as soon as the next one
              opens for applications.
            </p>
          </CardContent>
        </Card>
      </Reveal>
    )
  }

  return (
    <Stagger className="flex flex-col gap-3">
      {rows.map((row) => (
        <StaggerItem key={row.key}>
          <div
            className={
              row.highlight
                ? 'flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between'
                : 'flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between'
            }
          >
            <div className="flex items-center gap-4">
              <span
                className={
                  row.highlight
                    ? 'grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground'
                    : 'grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground'
                }
              >
                <CalendarClock className="size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{row.label}</span>
                <span className="text-xs text-muted-foreground">{row.note}</span>
              </span>
            </div>
            <span className="pl-14 text-sm font-semibold sm:pl-0 sm:text-right">
              {formatDate(row.value as string)}
            </span>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
