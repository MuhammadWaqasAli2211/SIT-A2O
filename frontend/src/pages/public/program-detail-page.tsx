/**
 * A single programme.
 *
 * The page has one job: get somebody from "this looks interesting" to either
 * applying or ruling it out, without them having to guess at anything. So the
 * order is deliberately decision-shaped rather than brochure-shaped — facts,
 * then who it suits, then what you will be able to do, then the module list,
 * then how to apply — with the apply panel sticky beside all of it so the
 * action is never scrolled away from.
 *
 * The curriculum is the reason people come here, so it is the widest column
 * and its modules carry a visible sequence (01 → 06). A flat accordion of
 * equal-looking rows hides the one thing that matters about a syllabus, which
 * is that it builds.
 *
 * Nothing on this page is written per programme. Every word comes from the
 * `PROGRAMS` entry, and the one derived thing — the "who this suits" line —
 * is a mapping of the existing `level` field, defined once in LEVEL_NOTE
 * below rather than written out five times.
 */

import { ArrowRight, BookOpen, CheckCircle2, Clock, MapPin, Signal, Users } from 'lucide-react'
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

/**
 * What each `level` value means in practice.
 *
 * Keyed by the exact string `PROGRAMS` uses. An unrecognised level falls
 * through to `undefined` and the line simply does not render — better a
 * missing sentence than a confident one about a level nobody defined.
 */
const LEVEL_NOTE: Record<string, string> = {
  'Beginner friendly': 'No prior coding experience assumed. You will start from the fundamentals.',
  'Some coding helpful': 'You will move faster if you have written code before, but it is not a requirement.',
  'Maths basics required': 'Comfort with school-level algebra and statistics matters more here than coding experience.',
  Intermediate: 'Built for people who already write code and want the operational skills around it.',
}

export default function ProgramDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const program = slug ? getProgram(slug) : undefined

  if (!program) return <Navigate to="/programs" replace />

  const related = PROGRAMS.filter((p) => p.slug !== program.slug).slice(0, 3)
  const levelNote = LEVEL_NOTE[program.level]
  const moduleCount = program.curriculum.length
  const topicCount = program.curriculum.reduce((sum, m) => sum + m.topics.length, 0)

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

      {/* ---------------------------------------------------- key facts -- */}
      <Section className="py-14">
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <StaggerItem key={fact.label} className="h-full">
              <Card className="h-full transition-transform duration-300 hover:-translate-y-1">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <fact.icon className="size-5" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xs tracking-wide text-muted-foreground uppercase">
                      {fact.label}
                    </span>
                    <span className="text-sm font-medium">{fact.value}</span>
                  </span>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>

        {levelNote && (
          <Reveal delay={0.2} className="mt-6">
            <p className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
              <Signal className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium">{program.level}.</span>{' '}
                <span className="text-muted-foreground">{levelNote}</span>
              </span>
            </p>
          </Reveal>
        )}
      </Section>

      {/* -------------------------------------- curriculum + apply panel -- */}
      <Section className="border-y border-border bg-muted/25 pt-4">
        <div className="grid gap-14 lg:grid-cols-[1.55fr_1fr] lg:items-start">
          <div className="min-w-0">
            <SectionHeading
              align="left"
              eyebrow="Curriculum"
              title="What you will cover"
              description={`${moduleCount} modules and ${topicCount} topics, run in sequence so each one builds on the last. The track finishes with work you can show an employer.`}
            />

            <Reveal delay={0.1} className="mt-8">
              <Accordion
                className="w-full"
                // The first module opens by default. A syllabus behind six
                // closed rows asks the reader to take on faith that there is
                // anything in it.
                defaultValue={
                  program.curriculum[0] ? [program.curriculum[0].module] : []
                }
              >
                {program.curriculum.map((module, index) => (
                  <AccordionItem key={module.module} value={module.module}>
                    <AccordionTrigger className="gap-4 py-4 text-left">
                      <span className="flex items-center gap-3.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{module.module}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {module.topics.length} topics
                          </span>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="flex flex-col gap-2 pt-1 pl-[3.125rem]">
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

          <div className="flex flex-col gap-5 lg:sticky lg:top-28">
            <Reveal direction="left">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  <h2 className="text-base font-semibold">By the end you can</h2>
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

            <Reveal direction="left" delay={0.08}>
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  <h2 className="text-base font-semibold">Tools &amp; technologies</h2>
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

            <Reveal direction="left" delay={0.14}>
              <Card className="border-primary/25 bg-primary/5">
                <CardContent className="flex flex-col gap-3 p-6">
                  <h2 className="text-base font-semibold">Ready to apply?</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Applications take about ten minutes and cost nothing. You get your
                    candidate code immediately and can track every stage from your portal.
                  </p>
                  <Button render={<Link to="/signup" />} className="mt-1 w-full">
                    Start application
                  </Button>
                  <Link
                    to="/faq"
                    className="text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Questions first? Read the FAQs
                  </Link>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------- related -- */}
      <Section>
        <SectionHeading
          eyebrow="Other tracks"
          title="You may also be interested in"
          description="One application per intake, so it is worth comparing before you commit."
        />

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-3">
          {related.map((other) => (
            <StaggerItem key={other.slug} className="h-full">
              <Link to={`/programs/${other.slug}`} className="group block h-full">
                <Card className="h-full transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-lg">
                  <CardContent className="flex h-full flex-col gap-3 p-6">
                    <span className="grid size-10 w-fit place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <other.icon className="size-5" />
                    </span>
                    <h3 className="text-base font-semibold">{other.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {other.tagline}
                    </p>
                    <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-medium text-primary">
                      Learn more
                      <ArrowRight className="size-3.5 transition-transform duration-250 group-hover:translate-x-1" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.2} className="mt-12 flex justify-center">
          <Button render={<Link to="/programs" />} variant="outline" size="lg" className="group h-11">
            <BookOpen className="size-4" />
            Compare all five tracks
          </Button>
        </Reveal>
      </Section>
    </>
  )
}
