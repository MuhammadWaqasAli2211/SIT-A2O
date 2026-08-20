import { ArrowRight, Briefcase, Quote, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Counter } from '@/components/motion/counter'
import { Marquee } from '@/components/motion/marquee'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section, SectionHeading } from '@/components/shared/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { HIRING_PARTNERS, TESTIMONIALS } from '@/lib/site-data'

const OUTCOMES = [
  { label: 'Graduates placed', value: 78, suffix: '%' },
  { label: 'Average months to hire', value: 4.5, suffix: '', decimals: 1 },
  { label: 'Hiring partners', value: 120, suffix: '+' },
  { label: 'Alumni network', value: 250000, suffix: '+' },
]

const FEATURED = [
  {
    name: 'Ayesha Siddiqui',
    initials: 'AS',
    role: 'Frontend Engineer',
    company: 'Systems Ltd',
    program: 'Web & App Development',
    before: 'Fresh graduate, no coding background',
    quote:
      'I applied with no coding background at all. Six months later I was writing production React. The instructors never once made me feel behind — they just kept giving me harder problems until the concepts stuck.',
  },
  {
    name: 'Bilal Ahmed',
    initials: 'BA',
    role: 'Full-Stack Developer',
    company: 'Careem',
    program: 'Web & App Development',
    before: 'Retail sales, studying evenings',
    quote:
      'The batch interview process was the most organised thing I have been through. I knew my slot, my candidate code, and my status at every step — no chasing anybody for updates.',
  },
  {
    name: 'Fatima Khan',
    initials: 'FK',
    role: 'Data Analyst',
    company: 'Telenor',
    program: 'Data Science & AI',
    before: 'Statistics graduate, no industry experience',
    quote:
      'What surprised me was the project work. We built and deployed real applications on real datasets, so my portfolio was ready before I even graduated.',
  },
  {
    name: 'Usman Tariq',
    initials: 'UT',
    role: 'DevOps Engineer',
    company: 'Netsol',
    program: 'Cloud & DevOps',
    before: 'IT support technician',
    quote:
      'Completely free, and yet more rigorous than paid courses I had tried before. The physical assessment made sure everyone in the room was serious about finishing.',
  },
  {
    name: 'Zainab Ali',
    initials: 'ZA',
    role: 'Mobile Developer',
    company: 'Bazaar',
    program: 'Mobile Development',
    before: 'Working days, studying nights',
    quote:
      'I was working days and studying evenings. The schedule made that genuinely possible, and the mentors were reachable whenever I got stuck on something.',
  },
  {
    name: 'Hamza Sheikh',
    initials: 'HS',
    role: 'Product Designer',
    company: '10Pearls',
    program: 'UI/UX Design',
    before: 'Self-taught, no formal portfolio',
    quote:
      'The case-study approach changed how I interview. I stopped showing screens and started explaining decisions, and offers followed almost immediately.',
  },
]

export default function SuccessStoriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Success stories"
        title="Where our graduates are now"
        description="Real outcomes from people who started exactly where you are — many with no technical background at all."
        crumbs={[{ label: 'Success Stories' }]}
      />

      {/* Outcomes */}
      <Section className="py-14">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOMES.map((outcome, index) => (
            <Reveal
              key={outcome.label}
              delay={index * 0.08}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span className="text-4xl font-semibold tracking-tight text-primary">
                <Counter to={outcome.value} suffix={outcome.suffix} decimals={outcome.decimals ?? 0} />
              </span>
              <span className="text-sm text-muted-foreground">{outcome.label}</span>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Featured stories */}
      <Section className="border-y border-border bg-muted/25 pt-4">
        <SectionHeading
          eyebrow="In their words"
          title="Six journeys, one starting point"
          description="Each of these graduates joined a free programme and left with a job in the industry."
        />

        <Stagger className="mt-14 grid gap-6 lg:grid-cols-2">
          {FEATURED.map((story) => (
            <StaggerItem key={story.name}>
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                <CardContent className="flex h-full flex-col gap-5 p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary transition-transform duration-300 group-hover:scale-110">
                        {story.initials}
                      </span>
                      <span className="flex flex-col leading-tight">
                        <span className="font-semibold">{story.name}</span>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Briefcase className="size-3.5" />
                          {story.role} · {story.company}
                        </span>
                      </span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[0.7rem]">
                      {story.program}
                    </Badge>
                  </div>

                  <Quote className="size-6 text-primary/30" />
                  <p className="flex-1 text-sm leading-relaxed text-foreground/85">
                    "{story.quote}"
                  </p>

                  <div className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                    <TrendingUp className="size-3.5 shrink-0 text-primary" />
                    <span>
                      Before: <span className="text-foreground/70">{story.before}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* Partners */}
      <Section>
        <SectionHeading
          eyebrow="Hiring partners"
          title="Companies that hire our graduates"
          description="We review curriculum with these teams each intake, so what you learn is what they are using."
        />

        <div className="mt-12">
          <Marquee duration="50s">
            {HIRING_PARTNERS.map((partner) => (
              <span
                key={partner}
                className="mx-8 whitespace-nowrap text-xl font-semibold text-muted-foreground/60 transition-colors duration-300 hover:text-primary"
              >
                {partner}
              </span>
            ))}
          </Marquee>
        </div>
      </Section>

      {/* Short quotes */}
      <Section className="border-t border-border bg-muted/25 pt-4">
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <StaggerItem key={t.name}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <Quote className="size-5 text-primary/30" />
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3 border-t border-border pt-4">
                    <span className="grid size-9 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                      {t.initials}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.role} · {t.company}
                      </span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.2} className="mt-14 flex flex-col items-center gap-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Your story could be next
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Applications for Bootcamp 07 are open until 30 September. It costs nothing to
            apply and nothing to attend.
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
