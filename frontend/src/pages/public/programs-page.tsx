/**
 * The programme catalogue.
 *
 * Five tracks is few enough to show all of them and too many to hold in your
 * head at once, which is the specific problem a course-listing page has to
 * solve. So this does two things the previous version did not:
 *
 * - **Filters that say what they did.** Format and experience level, with a
 *   live count and a visible way back out. A filter that silently empties a
 *   grid reads as a broken page.
 * - **A comparison table.** Cards are good for reading one programme and bad
 *   for choosing between five, because the fields never line up. The table
 *   puts duration, format, level and seats in columns you can run an eye
 *   down. Both views render the same filtered set, so they can never
 *   disagree about what matches.
 *
 * Everything shown comes from `PROGRAMS`. No programme copy is written here.
 */

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Clock,
  LayoutGrid,
  MapPin,
  Rows3,
  Signal,
  Users,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section, SectionHeading } from '@/components/shared/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PROGRAMS, type Program } from '@/lib/site-data'
import { cn } from '@/lib/utils'

const FORMATS = ['All', 'On-campus', 'Online', 'Hybrid'] as const
type Format = (typeof FORMATS)[number]

/**
 * The level filter, derived from the data rather than hardcoded.
 *
 * `level` is free text on `Program` ("Beginner friendly", "Maths basics
 * required", …), so listing the options by hand would leave the filter one
 * edit behind the moment a track's wording changed.
 */
const LEVELS: readonly string[] = ['All', ...new Set(PROGRAMS.map((p) => p.level))]
type Level = string

function matchesFormat(mode: string, filter: Format) {
  if (filter === 'All') return true
  // "On-campus + Online" is the hybrid case; a plain equality test would
  // otherwise file it under neither.
  if (filter === 'Hybrid') return mode.includes('+')
  return mode === filter
}

type View = 'grid' | 'table'

export default function ProgramsPage() {
  const [format, setFormat] = useState<Format>('All')
  const [level, setLevel] = useState<Level>('All')
  const [view, setView] = useState<View>('grid')

  const visible = useMemo(
    () =>
      PROGRAMS.filter(
        (p) => matchesFormat(p.mode, format) && (level === 'All' || p.level === level),
      ),
    [format, level],
  )

  const filtered = format !== 'All' || level !== 'All'
  const reset = () => {
    setFormat('All')
    setLevel('All')
  }

  return (
    <>
      <PageHero
        eyebrow="Programs"
        title="Every track is free. Pick the one that fits your goals."
        description="Five specialisations built with hiring partners and taught by working practitioners. Compare duration, format and outcomes, then apply to the one you want."
        crumbs={[{ label: 'Programs' }]}
      />

      <Section>
        {/* ------------------------------------------------------ filters -- */}
        <Reveal className="flex flex-col gap-5 border-b border-border pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <FilterRow
                label="Format"
                options={FORMATS}
                value={format}
                onChange={setFormat}
              />
              <FilterRow label="Level" options={LEVELS} value={level} onChange={setLevel} />
            </div>

            <ViewToggle view={view} onChange={setView} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{visible.length}</span>{' '}
              of {PROGRAMS.length} programmes
            </p>
            {filtered && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <X className="size-3" />
                Clear filters
              </button>
            )}
          </div>
        </Reveal>

        {/* ------------------------------------------------------ results -- */}
        {visible.length === 0 ? (
          <Reveal className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
            <p className="font-medium">No programmes match those filters</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              No track currently runs in that combination of format and level. Widening
              either one will bring results back.
            </p>
            <Button variant="outline" onClick={reset}>
              Clear filters
            </Button>
          </Reveal>
        ) : view === 'grid' ? (
          // `key` on the filter state so the stagger replays when the set
          // changes — otherwise a filtered-in card appears with no entrance.
          <Stagger key={`${format}-${level}`} className="mt-10 grid gap-6 lg:grid-cols-2">
            {visible.map((program) => (
              <StaggerItem key={program.slug} className="h-full">
                <ProgramCard program={program} />
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Reveal className="mt-10">
            <ComparisonTable programs={visible} />
          </Reveal>
        )}
      </Section>

      {/* --------------------------------------------------------- helper -- */}
      <Section className="border-t border-border bg-muted/25">
        <SectionHeading
          eyebrow="Not sure yet?"
          title="Pick the outcome, not the technology"
          description="Most people arrive knowing they want a job in tech and not much beyond that — which is fine. Tell us your background and what you want to be doing in a year, and we will tell you which track gets you there."
        />
        <Reveal delay={0.15} className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Button render={<Link to="/contact" />} size="lg" className="group h-11 px-6">
            Talk to admissions
            <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
          </Button>
          <Button render={<Link to="/faq" />} variant="outline" size="lg" className="h-11 px-6">
            Read the FAQs
          </Button>
        </Reveal>
      </Section>
    </>
  )
}

/* --------------------------------------------------------------- filters -- */

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-14 shrink-0 text-sm font-medium text-muted-foreground">
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
            value === option
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const options: { key: View; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'grid', label: 'Cards', icon: LayoutGrid },
    { key: 'table', label: 'Compare', icon: Rows3 },
  ]

  return (
    <div
      role="group"
      aria-label="Result layout"
      className="flex shrink-0 gap-1 rounded-full border border-border p-1"
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={view === option.key}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
            view === option.key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <option.icon className="size-4" />
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ card -- */

function ProgramCard({ program }: { program: Program }) {
  return (
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
          <Fact icon={Clock} label="Duration" value={program.duration} />
          <Fact icon={MapPin} label="Format" value={program.mode} />
          <Fact icon={Users} label="Seats" value={String(program.seats)} />
        </dl>

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            You will finish able to
          </p>
          <ul className="flex flex-col gap-1.5">
            {program.outcomes.slice(0, 2).map((outcome) => (
              <li key={outcome} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                {outcome}
              </li>
            ))}
          </ul>
        </div>

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
  )
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex items-center justify-center gap-1 text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3" /> {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

/* ------------------------------------------------------------- compare -- */

/**
 * Side-by-side comparison.
 *
 * Scrolls horizontally inside its own container rather than widening the
 * page: five programmes across four fact columns does not fit a phone, and a
 * body that scrolls sideways breaks every other section on the page with it.
 */
function ComparisonTable({ programs }: { programs: Program[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
        <caption className="sr-only">
          Programmes compared by duration, format, level and seats per intake
        </caption>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th scope="col" className="p-4 font-semibold">
              Programme
            </th>
            <th scope="col" className="p-4 font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" /> Duration
              </span>
            </th>
            <th scope="col" className="p-4 font-semibold">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-muted-foreground" /> Format
              </span>
            </th>
            <th scope="col" className="p-4 font-semibold">
              <span className="flex items-center gap-1.5">
                <Signal className="size-3.5 text-muted-foreground" /> Level
              </span>
            </th>
            <th scope="col" className="p-4 font-semibold">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5 text-muted-foreground" /> Seats
              </span>
            </th>
            <th scope="col" className="p-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {programs.map((program) => (
            <tr
              key={program.slug}
              className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
            >
              <th scope="row" className="p-4 font-medium">
                <span className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <program.icon className="size-4.5" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    {program.title}
                    <span className="text-xs font-normal text-muted-foreground">
                      {program.skills.slice(0, 3).join(' · ')}
                    </span>
                  </span>
                </span>
              </th>
              <td className="p-4 text-muted-foreground">{program.duration}</td>
              <td className="p-4 text-muted-foreground">{program.mode}</td>
              <td className="p-4 text-muted-foreground">{program.level}</td>
              <td className="p-4 tabular-nums text-muted-foreground">{program.seats}</td>
              <td className="p-4 text-right">
                <Button
                  render={<Link to={`/programs/${program.slug}`} />}
                  variant="ghost"
                  size="sm"
                  className="group/row"
                >
                  Details
                  <ArrowRight className="size-3.5 transition-transform duration-250 group-hover/row:translate-x-1" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
