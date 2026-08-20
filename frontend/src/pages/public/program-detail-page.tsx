import { ArrowRight, CheckCircle2, Clock, MapPin, Signal, Users } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section, SectionHeading } from '@/components/shared/section'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getProgram, PROGRAMS } from '@/lib/site-data'

export default function ProgramDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const program = slug ? getProgram(slug) : undefined

  if (!program) return <Navigate to="/programs" replace />

  const related = PROGRAMS.filter((p) => p.slug !== program.slug).slice(0, 3)

  const facts = [
    { label: 'Duration', value: program.duration, icon: Clock },
    { label: 'Format', value: program.mode, icon: MapPin },
    { label: 'Level', value: program.level, icon: Signal },
    { label: 'Seats', value: `${program.seats} per intake`, icon: Users },
  ]

  return (
    <>
      <PageHero
        eyebrow={program.title}
        title={program.tagline}
        description={program.description}
        crumbs={[{ label: 'Programs', href: '/programs' }, { label: program.title }]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button render={<Link to="/signup" />} size="lg" className="group h-11">
            Apply for this program
            <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
          </Button>
          <Button render={<Link to="/admissions" />} variant="outline" size="lg" className="h-11">
            How admissions work
          </Button>
        </div>
      </PageHero>

      {/* Key facts */}
      <Section className="py-14">
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <StaggerItem key={fact.label}>
              <Card className="h-full transition-transform duration-300 hover:-translate-y-1">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <fact.icon className="size-5" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {fact.label}
                    </span>
                    <span className="text-sm font-medium">{fact.value}</span>
                  </span>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* Curriculum + outcomes */}
      <Section className="border-y border-border bg-muted/25 pt-4">
        <div className="grid gap-14 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Curriculum"
              title="What you will cover"
              description="Modules run in sequence, each building on the last, and finish with a capstone you can show an employer."
            />

            <Reveal delay={0.1} className="mt-8">
              <Accordion className="w-full">
                {program.curriculum.map((module, index) => (
                  <AccordionItem key={module.module} value={module.module}>
                    <AccordionTrigger className="text-left">
                      <span className="flex items-center gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-medium">{module.module}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="flex flex-col gap-2 pt-1 pl-10">
                        {module.topics.map((topic) => (
                          <li
                            key={topic}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                            {topic}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>

          <div className="flex flex-col gap-6 lg:sticky lg:top-28">
            <Reveal direction="left">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  <h3 className="text-base font-semibold">By the end you can</h3>
                  <ul className="flex flex-col gap-3">
                    {program.outcomes.map((outcome) => (
                      <li key={outcome} className="flex gap-2.5 text-sm leading-relaxed">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>

            <Reveal direction="left" delay={0.1}>
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  <h3 className="text-base font-semibold">Tools & technologies</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {program.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Reveal>

            <Reveal direction="left" delay={0.15}>
              <Card className="border-primary/25 bg-primary/5">
                <CardContent className="flex flex-col gap-3 p-6">
                  <h3 className="text-base font-semibold">Ready to apply?</h3>
                  <p className="text-sm text-muted-foreground">
                    Applications take about ten minutes and cost nothing.
                  </p>
                  <Button render={<Link to="/signup" />} className="mt-1 w-full">
                    Start application
                  </Button>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* Related */}
      <Section>
        <SectionHeading eyebrow="Other tracks" title="You may also be interested in" />
        <Stagger className="mt-12 grid gap-5 sm:grid-cols-3">
          {related.map((other) => (
            <StaggerItem key={other.slug}>
              <Link to={`/programs/${other.slug}`} className="group block h-full">
                <Card className="h-full transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-lg">
                  <CardContent className="flex h-full flex-col gap-3 p-6">
                    <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <other.icon className="size-5" />
                    </span>
                    <h3 className="text-base font-semibold">{other.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{other.tagline}</p>
                    <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium text-primary">
                      Learn more
                      <ArrowRight className="size-3.5 transition-transform duration-250 group-hover:translate-x-1" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>
    </>
  )
}
