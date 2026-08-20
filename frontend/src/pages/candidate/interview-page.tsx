import { motion } from 'motion/react'
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Info,
  MapPin,
  Navigation,
  Timer,
  TriangleAlert,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/portal-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

const SCORE_BREAKDOWN = [
  { label: 'Communication', score: 88 },
  { label: 'Problem solving', score: 79 },
  { label: 'Motivation & commitment', score: 92 },
  { label: 'Technical aptitude', score: 71 },
]

export default function CandidateInterviewPage() {
  return (
    <>
      <PageHeader
        title="Interview & assessment"
        description="Your screening result and details for the upcoming physical assessment."
        actions={
          <Button variant="outline">
            <CalendarPlus className="size-4" />
            Add to calendar
          </Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Attendance is required</AlertTitle>
          <AlertDescription>
            Missing the physical assessment without prior notice ends your application for
            this intake. If you cannot attend, contact admissions before the date.
          </AlertDescription>
        </Alert>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Upcoming assessment */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06 }}
        >
          <Card className="relative overflow-hidden border-warning/35">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -right-12 size-48 rounded-full bg-warning/12 blur-3xl"
            />
            <CardHeader className="relative">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Physical assessment</CardTitle>
                <Badge className="bg-warning/20 text-warning-foreground dark:text-warning">
                  Upcoming
                </Badge>
              </div>
              <CardDescription>One-to-one session with the admissions team</CardDescription>
            </CardHeader>

            <CardContent className="relative flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <CalendarClock className="size-4.5" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Date & time
                    </span>
                    <span className="text-sm font-medium">16 Oct 2026</span>
                    <span className="text-sm text-muted-foreground">11:00 AM</span>
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="size-4.5" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Location
                    </span>
                    <span className="text-sm font-medium">Bahadurabad Campus</span>
                    <span className="text-sm text-muted-foreground">Room 204, 2nd floor</span>
                  </span>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Timer className="size-4 text-muted-foreground" />
                  Arrive 15 minutes early
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Report to the reception desk with your candidate code slip. Sessions run
                  to a strict schedule and late arrivals may be rescheduled to a later
                  intake.
                </p>
              </div>

              <Button variant="outline" className="w-full">
                <Navigation className="size-4" />
                Get directions
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Screening result */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
        >
          <Card className="border-success/35">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Screening interview</CardTitle>
                <Badge className="bg-success/15 text-success">Passed</Badge>
              </div>
              <CardDescription>Batch 2 · 08 October 2026, 11:00</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <div className="flex items-end justify-between">
                <span className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Overall score
                  </span>
                  <span className="text-3xl font-semibold tracking-tight">82.5</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-md bg-success/12 px-2 py-1 text-xs font-medium text-success">
                  <CheckCircle2 className="size-3.5" />
                  Above threshold (65.0)
                </span>
              </div>

              <Separator />

              <div className="flex flex-col gap-4">
                {SCORE_BREAKDOWN.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 + index * 0.08 }}
                    className="flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{item.score}</span>
                    </div>
                    <Progress value={item.score}>
                      <ProgressTrack>
                        <ProgressIndicator />
                      </ProgressTrack>
                    </Progress>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* What to expect */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What to expect at the assessment</CardTitle>
            <CardDescription>
              It is a conversation, not a written exam. Come as you are.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                {
                  title: 'A short conversation',
                  body: 'Fifteen to twenty minutes with a member of the admissions team about your background and goals.',
                },
                {
                  title: 'Confirming your track',
                  body: 'We check that the programme you applied to is the right fit, and suggest an alternative if it is not.',
                },
                {
                  title: 'Your questions',
                  body: 'Time is set aside for whatever you want to ask about the course, the schedule, or life after graduation.',
                },
              ].map((item, index) => (
                <div key={item.title} className="flex flex-col gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-sm leading-relaxed text-muted-foreground">{item.body}</span>
                </div>
              ))}
            </div>

            <Alert className="mt-6">
              <TriangleAlert className="size-4" />
              <AlertDescription>
                Bring your original CNIC or B-Form. Without it, we cannot verify your
                identity and the session cannot proceed.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
