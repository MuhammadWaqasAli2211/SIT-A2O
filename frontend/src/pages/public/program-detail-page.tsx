/**
 * A single programme.
 *
 * One template for every programme, fed by that programme's own `PROGRAMS`
 * record — its curriculum, its skills, its duration/format/level/seats, its
 * accent. Nothing here is written per programme, and the one derived sentence
 * (the "who this suits" line) is a mapping of the existing `level` field
 * defined once in LEVEL_NOTE rather than written out five times.
 *
 * The order is decision-shaped rather than brochure-shaped: what it is, the
 * facts, then the syllabus, with outcomes and tooling beside it and the apply
 * action never far from the reader.
 *
 * ## Two honesty constraints this page is built around
 *
 * **The trust row's avatars are abstract.** The reference this was built to
 * shows photographs of students. This project holds no consented alumni
 * photographs — `TESTIMONIAL_NOTE` in site-data.ts states plainly that even
 * the quotes are "not statements from named individuals" — so the avatars here
 * are accent-tinted glyphs that stand for "students" generally and name
 * nobody. Stock photographs of strangers presented as our graduates would be
 * a straightforward lie, and initials of the illustrative testimonial people
 * would imply those specific people took *this* programme.
 *
 * **The trust row's number is `seats`, not the site-wide total.** The
 * "250,000+ students trained" figure is flagged illustrative and every surface
 * showing it must carry a visible `<StatCaveat />`. `seats` is a real, checked
 * number from the programme's own record, and it is about the programme the
 * reader is actually looking at, so it needs no caveat.
 *
 * There is deliberately no "Watch intro video" button: no such video exists
 * anywhere in this project, and a CTA that goes nowhere costs more trust than
 * a missing one.
 */

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  MapPin,
  Signal,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
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
import { ProgramScene } from '@/features/marketing/program-scene'
import { TechIcon } from '@/features/marketing/tech-icons'
import { getProgram, PROGRAMS, type Program } from '@/lib/site-data'
import { cn } from '@/lib/utils'

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

/** How many decorative avatars the trust row shows before the "+" chip. */
const AVATAR_COUNT = 4

export default function ProgramDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const program = slug ? getProgram(slug) : undefined

  if (!program) return <Navigate to="/programs" replace />

  return (
    <>
      <ProgramHero program={program} />
      <StatBar program={program} />
      <CurriculumBody program={program} />
      <ExploreMore current={program} />
    </>
  )
}

/* ---------------------------------------------------------------- hero -- */

function ProgramHero({ program }: { program: Program }) {
  // The final word of the title takes the accent and the underline flourish.
  // Splitting on the last space rather than on a hand-written "emphasis"
  // field: five programmes should not need five pieces of copy to say which
  // word is theirs.
  const words = program.title.split(' ')
  const lead = words.slice(0, -1).join(' ')
  const emphasis = words.at(-1)
  // "Data Science & AI" and "Cloud & DevOps" would otherwise leave the
  // ampersand stranded at the end of a wrapped line. A non-breaking space
  // keeps it attached to the word it joins.
  const tieAmpersand = lead.endsWith('&')

  return (
    <div className="relative overflow-hidden bg-hero-canvas">
      {/* Ambient brand wash, blue into the programme's own accent. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(50% 60% at 15% 0%, color-mix(in srgb, var(--color-primary) 22%, transparent), transparent 70%),' +
            `radial-gradient(45% 55% at 90% 40%, color-mix(in srgb, ${program.accentVar} 22%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-8 lg:px-8 lg:py-24">
        <Reveal direction="up" className="flex flex-col items-start gap-6">
          <Badge
            variant="outline"
            className="gap-1.5 border-primary/30 bg-primary/8 px-3 py-1 text-primary"
          >
            <Sparkles className="size-3.5" />
            {program.level}
          </Badge>

          <h1 className="text-4xl font-semibold tracking-tight text-balance text-hero-ink sm:text-5xl lg:text-6xl lg:leading-[1.05]">
            {lead}
            {tieAmpersand ? <>&nbsp;</> : ' '}
            <span className="relative inline-block whitespace-nowrap text-primary">
              {emphasis}
              {/* The underline flourish. A drawn stroke rather than a border,
                  so it can be slightly loose and sit under the descenders. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                className="absolute inset-x-0 -bottom-1.5 h-2.5 w-full text-flow-500"
              >
                <path
                  d="M3 8.5C40 3.5 92 2.5 197 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            {program.tagline}.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link to="/signup" />} size="lg" className="group h-12 rounded-full px-7">
              Apply for this program
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
            <Button
              render={<Link to="/admissions" />}
              variant="outline"
              size="lg"
              className="h-12 rounded-full px-7"
            >
              How admissions work
            </Button>
          </div>

          <TrustRow program={program} />
        </Reveal>

        <Reveal direction="up" delay={0.12} className="relative">
          <ProgramScene accentVar={program.accentVar} />
          <FloatingBadges program={program} />
        </Reveal>
      </div>
    </div>
  )
}

/**
 * Overlapping avatars plus the programme's real intake size.
 *
 * The avatars carry no names and no faces — see the file header. They say
 * "a cohort of people" and nothing more, which is all the reference's row of
 * photographs actually communicates anyway.
 */
function TrustRow({ program }: { program: Program }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <div className="flex -space-x-3">
        {Array.from({ length: AVATAR_COUNT }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-full border-2 border-hero-canvas text-white shadow-sm"
            style={{
              background: `color-mix(in srgb, ${program.accentVar} ${70 + i * 8}%, var(--color-primary))`,
            }}
          >
            <User className="size-4" />
          </span>
        ))}
        <span className="grid size-10 place-items-center rounded-full border-2 border-hero-canvas bg-card text-xs font-semibold text-primary shadow-sm">
          +
        </span>
      </div>

      <div className="flex flex-col">
        <span className="text-lg font-semibold tracking-tight text-hero-ink">
          {program.seats} seats each intake
        </span>
        <span className="text-sm text-muted-foreground">
          Free, merit-based, open nationwide.
        </span>
      </div>
    </div>
  )
}

/**
 * Technology pills drifting over the illustration.
 *
 * Positions are fixed percentages rather than random, so the layout is the
 * same on every render and can be checked. Each pill gets its own delay and
 * duration so they do not bob in unison, which reads as one moving object
 * rather than several floating ones.
 */
function FloatingBadges({ program }: { program: Program }) {
  const spots = [
    { top: '4%', left: '-4%' },
    { top: '32%', right: '-6%' },
    { bottom: '18%', left: '-7%' },
    { top: '-3%', right: '14%' },
  ]

  return (
    <>
      {program.skills.slice(0, spots.length).map((skill, i) => (
        <span
          key={skill}
          className={cn(
            'absolute z-10 hidden items-center gap-2 rounded-full border border-border/70 bg-card/90 px-3 py-1.5',
            'text-xs font-medium shadow-lg shadow-foreground/5 backdrop-blur-sm sm:inline-flex',
            'animate-float motion-reduce:animate-none',
          )}
          style={{
            ...spots[i],
            animationDelay: `${i * 0.9}s`,
            animationDuration: `${5.5 + i * 0.7}s`,
          }}
        >
          <TechIcon skill={skill} className="size-4 text-primary" />
          {skill}
        </span>
      ))}
    </>
  )
}

/* ------------------------------------------------------------ stat bar -- */

function StatBar({ program }: { program: Program }) {
  const facts = [
    { label: 'Duration', value: program.duration, note: 'Full programme', icon: Clock },
    { label: 'Format', value: program.mode, note: 'Attend either way', icon: MapPin },
    { label: 'Level', value: program.level, note: LEVEL_NOTE[program.level] ?? 'All welcome', icon: Signal },
    { label: 'Seats', value: `${program.seats}`, note: 'Per intake', icon: Users },
  ]

  return (
    <div className="relative z-10 mx-auto -mt-8 max-w-7xl px-4 sm:px-6 lg:-mt-12 lg:px-8">
      <Stagger trigger="mount" className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-xl shadow-foreground/5 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <StaggerItem key={fact.label} className="bg-card">
            <div className="flex h-full flex-col gap-2 p-5">
              <span className="flex items-center gap-2 text-[0.7rem] font-semibold tracking-widest text-muted-foreground uppercase">
                <fact.icon className="size-3.5 text-primary" />
                {fact.label}
              </span>
              <span className="text-lg font-semibold tracking-tight">{fact.value}</span>
              <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {fact.note}
              </span>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  )
}

/* ---------------------------------------------------------- curriculum -- */

function CurriculumBody({ program }: { program: Program }) {
  const topicCount = program.curriculum.reduce((sum, m) => sum + m.topics.length, 0)

  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[1.55fr_1fr] lg:items-start lg:gap-14">
        {/* -------------------------------------------------- modules -- */}
        <div className="flex flex-col gap-7">
          <SectionHeading
            align="left"
            eyebrow="Curriculum"
            title="What you actually learn, week by week"
            description={`${program.curriculum.length} modules and ${topicCount} topics, in the order they are taught. Each one builds on the last — the sequence is the point, not a menu to pick from.`}
          />

          <Accordion className="flex flex-col gap-3">
            {program.curriculum.map((mod, i) => (
              <Reveal key={mod.module} direction="up" delay={i * 0.04}>
                <AccordionItem
                  value={mod.module}
                  className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
                >
                  <AccordionTrigger className="gap-4 px-5 py-4 text-left hover:no-underline">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums text-white"
                      style={{
                        background: `color-mix(in srgb, ${program.accentVar} 80%, var(--color-primary))`,
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold tracking-tight">{mod.module}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {mod.topics.length} topics · {mod.topics[0]}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4">
                    <ul className="flex flex-col gap-2 border-l border-border pl-4">
                      {mod.topics.map((topic) => (
                        <li key={topic} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-flow-600" />
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Reveal>
            ))}
          </Accordion>
        </div>

        {/* -------------------------------------------------- sidebar -- */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-24">
          <Reveal direction="up">
            <Card className="border-flow-500/25 bg-flow-500/6">
              <CardContent className="flex flex-col gap-4 p-6">
                <h3 className="text-base font-semibold tracking-tight">By the end you can</h3>
                <ul className="flex flex-col gap-3">
                  {program.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2.5 text-sm leading-relaxed">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-flow-600" />
                      {outcome}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal direction="up" delay={0.08}>
            <Card className="overflow-hidden border-0 bg-nav-shell text-nav-shell-ink">
              <CardContent className="flex flex-col gap-4 p-6">
                <h3 className="text-base font-semibold tracking-tight">Tools &amp; technologies</h3>
                <p className="text-xs leading-relaxed text-nav-shell-ink/65">
                  The stack this programme actually teaches.
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {program.skills.map((skill) => (
                    <span
                      key={skill}
                      title={skill}
                      className="flex flex-col items-center gap-2 rounded-xl bg-nav-shell-ink/8 p-3 text-center transition-colors hover:bg-nav-shell-ink/15"
                    >
                      <TechIcon skill={skill} className="size-6 text-nav-shell-ink" />
                      <span className="line-clamp-2 text-[0.65rem] leading-tight text-nav-shell-ink/75">
                        {skill}
                      </span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal direction="up" delay={0.16}>
            <Card className="border-primary/25 bg-primary/6">
              <CardContent className="flex flex-col gap-3 p-6">
                <BookOpen className="size-5 text-primary" />
                <h3 className="text-base font-semibold tracking-tight">
                  You build real projects, not just exercises
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Every module ends in something that runs, and the programme ends in a
                  deployed capstone you can show an employer.
                </p>
                <Link
                  to="/success-stories"
                  className="group inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  See where graduates went
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}

/* -------------------------------------------------------- explore more -- */

/**
 * Every other programme, from the real list.
 *
 * Not a hardcoded three: the grid takes whatever `PROGRAMS` holds minus the
 * current one, so adding a sixth programme adds a card here with no edit.
 */
function ExploreMore({ current }: { current: Program }) {
  const others = PROGRAMS.filter((p) => p.slug !== current.slug)

  return (
    <Section
      container={false}
      className="relative overflow-hidden bg-nav-shell text-nav-shell-ink"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(45% 60% at 10% 0%, color-mix(in srgb, var(--color-primary) 55%, transparent), transparent 70%),' +
            'radial-gradient(45% 60% at 90% 100%, color-mix(in srgb, var(--color-flow-500) 30%, transparent), transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 sm:px-6 lg:px-8">
        <Reveal className="flex max-w-2xl flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-nav-shell-ink/25 bg-nav-shell-ink/10 px-3 py-1 text-xs font-semibold tracking-widest uppercase">
            More tracks
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Explore more programs
          </h2>
          <p className="text-nav-shell-ink/70">
            Every track is free, runs the same admissions process, and ends in a portfolio
            you own.
          </p>
        </Reveal>

        <Stagger className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((p) => (
            <StaggerItem key={p.slug} className="h-full">
              <Link
                to={`/programs/${p.slug}`}
                className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-nav-shell-ink/15 bg-nav-shell-ink/6 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-nav-shell-ink/35 hover:bg-nav-shell-ink/10"
              >
                {/* The track's own colour, as a corner wash. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-16 -right-12 size-40 rounded-full opacity-45 blur-2xl transition-opacity duration-300 group-hover:opacity-70"
                  style={{ background: p.accentVar }}
                />

                <span
                  className="relative grid size-11 place-items-center rounded-xl text-white"
                  style={{
                    background: `color-mix(in srgb, ${p.accentVar} 80%, var(--color-primary))`,
                  }}
                >
                  <p.icon className="size-5" />
                </span>

                <span className="relative flex flex-col gap-1.5">
                  <span className="font-semibold tracking-tight">{p.title}</span>
                  <span className="line-clamp-2 text-sm leading-relaxed text-nav-shell-ink/65">
                    {p.tagline}
                  </span>
                </span>

                <span className="relative mt-auto inline-flex items-center gap-1.5 text-sm font-medium">
                  View program
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal>
          <Button
            render={<Link to="/programs" />}
            variant="outline"
            size="lg"
            className="h-12 rounded-full border-nav-shell-ink/30 bg-transparent px-7 text-nav-shell-ink hover:bg-nav-shell-ink/10 hover:text-nav-shell-ink"
          >
            View all programs
            <ArrowRight className="size-4" />
          </Button>
        </Reveal>
      </div>
    </Section>
  )
}
