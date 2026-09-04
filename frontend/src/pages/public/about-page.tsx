/**
 * About.
 *
 * Rebuilt around the questions an about page is actually asked — who runs
 * this, why is it free, is it real, and can I trust how you pick people —
 * rather than as a stats band followed by a timeline.
 *
 * The section that matters most here is "How selection works", and it is not
 * a repeat of /admissions. That page explains the five stages a candidate
 * moves through; this one explains the *guarantees* underneath them — one
 * standard for everyone, intake-scoped access, an audit trail behind every
 * staff action. Those are properties of the system that this codebase
 * genuinely enforces (see `bootcamp_service.assert_can_manage` and
 * `audit_service.record`), and they are the honest answer to "how do I know
 * this is fair", which no list of stages answers.
 *
 * Figures come from `STATS` and are illustrative — `<StatCaveat />` says so
 * on the page, not just in a comment.
 */

import { ArrowRight, Building2, GraduationCap, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Counter } from '@/components/motion/counter'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section, SectionHeading } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatCaveat } from '@/features/marketing/caveat'
import { CAMPUSES, STATS, VALUES } from '@/lib/site-data'

const MILESTONES = [
  {
    year: '2010',
    title: 'Saylani Welfare expands into education',
    description: 'The first free computer literacy classes open in Karachi.',
  },
  {
    year: '2015',
    title: 'Mass IT Training launches',
    description:
      'A structured curriculum replaces ad-hoc classes, with formal intakes and certification.',
  },
  {
    year: '2019',
    title: 'Nationwide expansion',
    description:
      'Campuses open in Lahore, Islamabad, and Faisalabad, tripling annual capacity.',
  },
  {
    year: '2022',
    title: '100,000 graduates',
    description:
      'The programme crosses six figures, with hiring partnerships across the industry.',
  },
  {
    year: '2026',
    title: 'Digital admissions platform',
    description:
      'A single system now runs recruitment end to end, from application through onboarding.',
  },
]

/**
 * What the platform guarantees about selection.
 *
 * Each of these is enforced in code, not asserted as a value — which is why
 * they sit in their own section rather than among `VALUES`.
 */
const FAIRNESS = [
  {
    title: 'One standard, applied the same way',
    body: 'Every applicant moves through the same five stages against the same deadlines, and carries a unique code from the moment they apply. Nobody is assessed on a different process from the person beside them.',
  },
  {
    title: 'Staff see only their own intake',
    body: 'An administrator running one bootcamp cannot open applications from another. That boundary is enforced by the platform itself rather than by instruction, so it holds whether or not anyone is checking.',
  },
  {
    title: 'Every action is on the record',
    body: 'Each time a staff member views, edits, advances or reinstates an application, it is written to an audit trail with who did it and when. Decisions about your application are attributable.',
  },
  {
    title: 'A missed deadline is not a rejection',
    body: 'Miss a stage and your application holds where it is rather than failing. You are asked to explain what happened, and a person reads it — no automated system decides your case on its own.',
  },
]

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="Free IT education, at national scale"
        description="Talent is spread evenly across the population. Opportunity is not. We remove the cost barrier entirely — and then run selection to a standard we can show you."
        crumbs={[{ label: 'About' }]}
      />

      {/* ------------------------------------------------------- mission -- */}
      <Section id="mission">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
          <SectionHeading
            align="left"
            eyebrow="Our mission"
            title="Education that asks nothing of you but effort"
            description="No tuition, no registration fee, no examination fee — not at any stage, and not for any programme. Funding comes entirely from Saylani Welfare, so the only thing standing between an applicant and a career in technology is their own commitment."
            className="lg:sticky lg:top-28"
          />

          <Stagger className="grid gap-4 sm:grid-cols-2">
            {VALUES.map((value) => (
              <StaggerItem key={value.title}>
                <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <CardContent className="flex h-full flex-col gap-3 p-6">
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

      {/* --------------------------------------------------------- scale -- */}
      <Section className="border-y border-border bg-muted/25 py-16 sm:py-20">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <Reveal
              key={stat.label}
              delay={index * 0.08}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <stat.icon className="size-5" />
              </span>
              <span className="text-3xl font-bold tracking-tight sm:text-4xl">
                <Counter to={stat.value} suffix={stat.suffix} />
              </span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </Reveal>
          ))}
        </div>
        <StatCaveat />
      </Section>

      {/* ------------------------------------------------------ fairness -- */}
      <Section id="fairness">
        <SectionHeading
          eyebrow="How selection works"
          title="Merit-based is a claim. Here is what backs it."
          description="Anyone can say their process is fair. These are the four things this platform actually enforces — not policies we ask staff to follow, but rules the system applies on its own."
        />

        <Stagger className="mt-14 grid gap-6 lg:grid-cols-2">
          {FAIRNESS.map((item, index) => (
            <StaggerItem key={item.title}>
              <div className="group flex h-full gap-5 rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                <span className="text-2xl font-bold tabular-nums text-primary/25 transition-colors duration-300 group-hover:text-primary/50">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.15} className="mt-10 flex justify-center">
          <Button render={<Link to="/admissions" />} variant="outline" size="lg" className="group h-11">
            See the five stages in detail
            <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
          </Button>
        </Reveal>
      </Section>

      {/* --------------------------------------------------------- story -- */}
      <Section className="border-y border-border bg-muted/25">
        <SectionHeading
          eyebrow="Our story"
          title="How we got here"
          description="From a handful of computer literacy classes to a nationwide training programme."
        />

        <div className="relative mx-auto mt-16 max-w-3xl">
          <div
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[4.5rem] hidden w-px bg-gradient-to-b from-primary/40 via-border to-transparent sm:block"
          />
          <div className="flex flex-col gap-10">
            {MILESTONES.map((milestone, index) => (
              <Reveal
                key={milestone.year}
                delay={index * 0.08}
                direction="right"
                className="flex gap-6"
              >
                <span className="w-16 shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-primary">
                  {milestone.year}
                </span>
                <span className="relative z-10 mt-1.5 hidden size-3 shrink-0 rounded-full bg-primary ring-4 ring-muted/25 sm:block" />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-semibold">{milestone.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {milestone.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------ campuses -- */}
      <Section id="campuses">
        <SectionHeading
          eyebrow="Locations"
          title="Campuses across Pakistan"
          description="Classes run on campus, online, or as a hybrid depending on the programme. Each card shows how many programmes that campus runs and roughly how many students it holds."
        />

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPUSES.map((campus) => (
            <StaggerItem key={campus.city}>
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <span className="grid size-10 w-fit place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Building2 className="size-5" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold">{campus.city}</h3>
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      {campus.address}
                    </p>
                  </div>
                  <div className="mt-auto flex gap-6 border-t border-border pt-4 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <GraduationCap className="size-3.5" />
                      {campus.programs} programs
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="size-3.5" />
                      {campus.students}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>

        <StatCaveat className="mt-8" />
      </Section>

      {/* ----------------------------------------------------------- cta -- */}
      <Section className="border-t border-border bg-muted/25">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            The next intake is the only thing you need to decide about
          </h2>
          <p className="text-muted-foreground">
            Applying costs nothing and commits you to nothing. If you are unsure which
            track fits, ask us before you apply — that conversation is free too.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link to="/signup" />} size="lg" className="group h-11 px-6">
              Apply now
              <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
            </Button>
            <Button render={<Link to="/contact" />} variant="outline" size="lg" className="h-11 px-6">
              Talk to us first
            </Button>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
