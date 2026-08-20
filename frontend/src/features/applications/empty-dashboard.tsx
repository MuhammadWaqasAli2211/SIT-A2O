/**
 * What a candidate sees before they have applied to anything.
 *
 * Three jobs: say what is open right now, explain the steps ahead, and
 * show that people finish. Deliberately not an `EmptyState` placeholder — this
 * is the screen that has to convert somebody who just created an account.
 */

import { motion } from 'motion/react'
import { ArrowRight, CalendarDays, Compass, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Countdown } from '@/components/shared/countdown'
import { JourneyStepper } from '@/components/shared/journey-stepper'
import { StoryBubble } from '@/components/shared/story-bubble'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { OpenBootcamp } from '@/features/applications/api'
import { TESTIMONIALS } from '@/lib/site-data'
import { TOTAL_STEPS } from '@/lib/stages'

/** Three reads as a set; more turns the section into a wall of text. */
const STORIES = TESTIMONIALS.slice(0, 3)

export function EmptyDashboard({
  firstName,
  openBootcamps,
}: {
  firstName: string
  openBootcamps: readonly OpenBootcamp[]
}) {
  const hasOpen = openBootcamps.length > 0

  return (
    <div className="flex flex-col gap-8">
      {/* ------------------------------------------------------------ hero -- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <div
            aria-hidden="true"
            className="animate-aurora pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/20 blur-3xl"
          />
          <CardContent className="relative flex flex-col gap-6 p-7 sm:p-9">
            <div className="flex flex-col gap-3">
              <Badge variant="secondary" className="w-fit gap-1.5">
                <Sparkles className="size-3.5" />
                No application yet
              </Badge>

              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Welcome, {firstName}.
              </h2>

              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Your account is ready. The next step is choosing an intake and
                submitting an application — after that you get a candidate code
                that follows you through all {TOTAL_STEPS} steps, and this
                page turns into a live tracker.
              </p>
            </div>

            {hasOpen ? (
              <div className="flex flex-col gap-3">
                {openBootcamps.map((bootcamp) => (
                  <div
                    key={bootcamp.id}
                    className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="font-medium">{bootcamp.name}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {bootcamp.starts_at && (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="size-3.5" />
                            Starts {formatDate(bootcamp.starts_at)}
                          </span>
                        )}
                        <span>
                          {bootcamp.programs.length} program
                          {bootcamp.programs.length === 1 ? '' : 's'}
                        </span>
                      </span>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-3 sm:flex-row sm:items-center">
                      {bootcamp.registration_deadline && (
                        <Countdown
                          deadline={bootcamp.registration_deadline}
                          label="Applications close in"
                        />
                      )}
                      <Button render={<Link to="/dashboard/application" />}>
                        Apply now
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    No bootcamps are currently open
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Registration opens a few weeks before each intake. We will
                    email you when the next one does.
                  </span>
                </div>
                <Button
                  render={<Link to="/programs" />}
                  variant="outline"
                  className="shrink-0"
                >
                  <Compass className="size-4" />
                  Browse programs
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>

      {/* -------------------------------------------------------- explainer -- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Here is how it works</CardTitle>
            <CardDescription>
              {TOTAL_STEPS} steps from application to first class. Each one
              opens on a deadline, and you are emailed the moment it does.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden pt-2 pb-7">
            <JourneyStepper mode="demo" />
          </CardContent>
        </Card>
      </motion.section>

      {/* ---------------------------------------------------------- stories -- */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-base font-semibold">They started exactly here</h3>
          <p className="text-sm text-muted-foreground">
            Graduates who once had an empty dashboard too.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {STORIES.map((story, index) => (
            <StoryBubble key={story.name} story={story} delay={index * 0.08} />
          ))}
        </div>
      </section>
    </div>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
