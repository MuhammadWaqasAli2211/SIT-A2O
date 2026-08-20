import { ArrowRight, Clock, GraduationCap, MapPin, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section } from '@/components/shared/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PROGRAMS } from '@/lib/site-data'
import { cn } from '@/lib/utils'

const MODES = ['All', 'On-campus', 'Online', 'Hybrid'] as const

function matchesMode(programMode: string, filter: (typeof MODES)[number]) {
  if (filter === 'All') return true
  if (filter === 'Hybrid') return programMode.includes('+')
  if (filter === 'On-campus') return programMode === 'On-campus'
  return programMode === 'Online'
}

export default function ProgramsPage() {
  const [mode, setMode] = useState<(typeof MODES)[number]>('All')
  const visible = PROGRAMS.filter((p) => matchesMode(p.mode, mode))

  return (
    <>
      <PageHero
        eyebrow="Programs"
        title="Every track is free. Pick the one that fits your goals."
        description="Five specialisations built with hiring partners and taught by working practitioners. Compare duration, format, and outcomes below."
        crumbs={[{ label: 'Programs' }]}
      />

      <Section>
        <Reveal className="mb-10 flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-medium text-muted-foreground">Format</span>
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              aria-pressed={mode === option}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200',
                mode === option
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {option}
            </button>
          ))}
        </Reveal>

        {visible.length === 0 ? (
          <Reveal className="rounded-2xl border border-dashed border-border py-20 text-center">
            <p className="text-sm text-muted-foreground">
              No programs match this format right now.
            </p>
          </Reveal>
        ) : (
          <Stagger key={mode} className="grid gap-6 lg:grid-cols-2">
            {visible.map((program) => (
              <StaggerItem key={program.slug}>
                <Card className="group h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                  <CardContent className="flex h-full flex-col gap-5 p-7">
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className={cn(
                          'grid size-12 place-items-center rounded-xl bg-gradient-to-br text-primary transition-transform duration-300 group-hover:scale-110',
                          program.accent,
                        )}
                      >
                        <program.icon className="size-6" />
                      </span>
                      <Badge variant="secondary">{program.level}</Badge>
                    </div>

                    <div className="flex flex-col gap-2">
                      <h2 className="text-xl font-semibold tracking-tight">{program.title}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {program.description}
                      </p>
                    </div>

                    <dl className="grid grid-cols-3 gap-3 rounded-xl bg-muted/50 p-4 text-center">
                      <div className="flex flex-col gap-1">
                        <dt className="flex items-center justify-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                          <Clock className="size-3" /> Duration
                        </dt>
                        <dd className="text-sm font-medium">{program.duration}</dd>
                      </div>
                      <div className="flex flex-col gap-1">
                        <dt className="flex items-center justify-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                          <MapPin className="size-3" /> Format
                        </dt>
                        <dd className="text-sm font-medium">{program.mode}</dd>
                      </div>
                      <div className="flex flex-col gap-1">
                        <dt className="flex items-center justify-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                          <Users className="size-3" /> Seats
                        </dt>
                        <dd className="text-sm font-medium">{program.seats}</dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-1.5">
                      {program.skills.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-[0.7rem]">
                          {skill}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-auto flex gap-2 pt-2">
                      <Button
                        render={<Link to={`/programs/${program.slug}`} />}
                        className="group/btn flex-1"
                      >
                        View curriculum
                        <ArrowRight className="size-4 transition-transform duration-250 group-hover/btn:translate-x-1" />
                      </Button>
                      <Button render={<Link to="/signup" />} variant="outline">
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Section>

      <Section className="border-t border-border bg-muted/25">
        <Reveal className="flex flex-col items-center gap-6 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="size-6" />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Not sure which track suits you?
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Our admissions team can talk through your background and goals, and point you
            at the programme where you are most likely to succeed.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link to="/contact" />} size="lg" className="h-11">
              Talk to admissions
            </Button>
            <Button render={<Link to="/faq" />} variant="outline" size="lg" className="h-11">
              Read the FAQs
            </Button>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
