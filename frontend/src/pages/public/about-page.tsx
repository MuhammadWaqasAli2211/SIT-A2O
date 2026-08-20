import { ArrowRight, Building2, GraduationCap, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Counter } from '@/components/motion/counter'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section, SectionHeading } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CAMPUSES, STATS, VALUES } from '@/lib/site-data'

const MILESTONES = [
  { year: '2010', title: 'Saylani Welfare expands into education', description: 'The first free computer literacy classes open in Karachi.' },
  { year: '2015', title: 'Mass IT Training launches', description: 'A structured curriculum replaces ad-hoc classes, with formal intakes and certification.' },
  { year: '2019', title: 'Nationwide expansion', description: 'Campuses open in Lahore, Islamabad, and Faisalabad, tripling annual capacity.' },
  { year: '2022', title: '100,000 graduates', description: 'The programme crosses six figures, with hiring partnerships across the industry.' },
  { year: '2026', title: 'Digital admissions platform', description: 'A single system now runs recruitment end to end, from application through onboarding.' },
]

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="Free IT education, at national scale"
        description="Saylani Mass IT Training exists on a simple premise: talent is spread evenly across the population, but opportunity is not. We remove the cost barrier entirely."
        crumbs={[{ label: 'About' }]}
      />

      {/* Stats */}
      <Section className="py-14">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 0.08}>
              <Card className="h-full transition-transform duration-300 hover:-translate-y-1">
                <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <stat.icon className="size-5" />
                  </span>
                  <span className="text-3xl font-semibold tracking-tight">
                    <Counter to={stat.value} suffix={stat.suffix} />
                  </span>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Mission */}
      <Section id="mission" className="border-y border-border bg-muted/25">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            align="left"
            eyebrow="Our mission"
            title="Education that asks nothing of you but effort"
            description="We do not charge tuition, registration, or examination fees — not at any stage, and not for any programme. Funding comes entirely from Saylani Welfare, so the only thing separating an applicant from a career is their own commitment."
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

      {/* Timeline */}
      <Section>
        <SectionHeading
          eyebrow="Our story"
          title="How we got here"
          description="From a handful of computer literacy classes to a nationwide training programme."
        />

        <div className="relative mx-auto mt-16 max-w-3xl">
          <div
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[4.5rem] hidden w-px bg-border sm:block"
          />
          <div className="flex flex-col gap-10">
            {MILESTONES.map((milestone, index) => (
              <Reveal key={milestone.year} delay={index * 0.08} direction="right" className="flex gap-6">
                <span className="w-16 shrink-0 pt-0.5 text-right text-sm font-semibold text-primary">
                  {milestone.year}
                </span>
                <span className="relative z-10 mt-1.5 hidden size-3 shrink-0 rounded-full bg-primary ring-4 ring-background sm:block" />
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

      {/* Campuses */}
      <Section id="campuses" className="border-t border-border bg-muted/25">
        <SectionHeading
          eyebrow="Locations"
          title="Campuses across Pakistan"
          description="Classes run on campus, online, or as a hybrid depending on the programme."
        />

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPUSES.map((campus) => (
            <StaggerItem key={campus.city}>
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <div className="flex items-start justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Building2 className="size-5" />
                    </span>
                  </div>
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

        <Reveal delay={0.2} className="mt-12 flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">Ready to start? Applications are open now.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link to="/signup" />} size="lg" className="group h-11">
              Apply now
              <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
            </Button>
            <Button render={<Link to="/contact" />} variant="outline" size="lg" className="h-11">
              Contact us
            </Button>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
