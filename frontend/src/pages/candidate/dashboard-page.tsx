import { motion } from 'motion/react'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader, StatCard, Timeline } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { useAuth } from '@/hooks/use-auth'
import { MY_APPLICATION } from '@/lib/mock-data'

export default function CandidateDashboardPage() {
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  const completed = MY_APPLICATION.timeline.filter((t) => t.status === 'done').length
  const percent = Math.round((completed / MY_APPLICATION.timeline.length) * 100)

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Track your application through every stage of the process."
        actions={
          <Button render={<Link to="/dashboard/application" />} variant="outline">
            <FileText className="size-4" />
            View application
          </Button>
        }
      />

      {/* Candidate code banner */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-6"
      >
        <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-10 size-52 rounded-full bg-primary/15 blur-3xl animate-aurora"
          />
          <CardContent className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Your candidate code
              </span>
              <span className="font-mono text-3xl font-semibold tracking-tight">
                {MY_APPLICATION.code}
              </span>
              <span className="text-sm text-muted-foreground">
                {MY_APPLICATION.program} · {MY_APPLICATION.bootcamp}
              </span>
            </div>

            <div className="flex w-full max-w-xs flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{percent}%</span>
              </div>
              <Progress value={percent}>
                <ProgressTrack>
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
              <span className="text-xs text-muted-foreground">
                {completed} of {MY_APPLICATION.timeline.length} stages complete
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current stage" value={3} suffix=" of 5" icon={Trophy} hint="Physical assessment" delay={0} />
        <StatCard label="Interview score" value={82.5} decimals={1} icon={CheckCircle2} trend={12} hint="above average" delay={0.06} />
        <StatCard label="Days until next stage" value={4} icon={Clock} hint="16 October" delay={0.12} />
        <StatCard label="Documents pending" value={2} icon={FileText} hint="CNIC, bank details" delay={0.18} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your journey</CardTitle>
              <CardDescription>
                Every stage is deadline-gated. You will be emailed when the next one opens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline items={MY_APPLICATION.timeline} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Side column */}
        <div className="flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
          >
            <Card className="border-warning/35 bg-warning/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-warning/20 text-warning-foreground dark:text-warning">
                    <CalendarClock className="size-4" />
                  </span>
                  <CardTitle className="text-base">Next up</CardTitle>
                </div>
                <CardDescription>Physical assessment — attendance is required</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <dl className="flex flex-col gap-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                    <dt className="sr-only">Date and time</dt>
                    <dd>16 October 2026, 11:00 AM</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <dt className="sr-only">Location</dt>
                    <dd>Bahadurabad Campus, Room 204</dd>
                  </div>
                </dl>
                <Button render={<Link to="/dashboard/interview" />} className="mt-1 w-full">
                  View details
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.22 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bring with you</CardTitle>
                <CardDescription>Required at the assessment</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {[
                  { label: 'Original CNIC or B-Form', ready: true },
                  { label: 'Printed candidate code slip', ready: true },
                  { label: 'Educational certificates', ready: false },
                  { label: 'Two passport photographs', ready: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm">
                      <CheckCircle2
                        className={
                          item.ready ? 'size-4 shrink-0 text-success' : 'size-4 shrink-0 text-muted-foreground/40'
                        }
                      />
                      {item.label}
                    </span>
                    {item.ready ? (
                      <Badge variant="secondary" className="text-[0.68rem]">
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[0.68rem]">
                        Pending
                      </Badge>
                    )}
                  </div>
                ))}

                <Button variant="outline" className="mt-2 w-full">
                  <Download className="size-4" />
                  Download code slip
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  )
}
