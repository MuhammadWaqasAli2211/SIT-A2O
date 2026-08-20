import { motion } from 'motion/react'
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  Mail,
  MoreHorizontal,
  PlayCircle,
  Users,
} from 'lucide-react'

import { PageHeader, StatCard, StatusDot } from '@/components/shared/portal-ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { INTERVIEW_BATCHES, type InterviewBatch } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<InterviewBatch['status'], 'success' | 'warning' | 'neutral'> = {
  completed: 'success',
  in_progress: 'warning',
  scheduled: 'neutral',
}

const STATUS_LABEL: Record<InterviewBatch['status'], string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  scheduled: 'Scheduled',
}

export default function AdminInterviewsPage() {
  const totalCapacity = INTERVIEW_BATCHES.reduce((sum, b) => sum + b.capacity, 0)
  const totalAssigned = INTERVIEW_BATCHES.reduce((sum, b) => sum + b.assigned, 0)
  const totalAttended = INTERVIEW_BATCHES.reduce((sum, b) => sum + b.attended, 0)
  const completed = INTERVIEW_BATCHES.filter((b) => b.status === 'completed').length

  return (
    <>
      <PageHeader
        title="Interview batches"
        description="Candidates are grouped into timed slots. Invitations go out per batch."
        actions={
          <>
            <Button variant="outline">
              <Mail className="size-4" />
              Send invitations
            </Button>
            <Button>
              <CalendarPlus className="size-4" />
              Create batch
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total capacity" value={totalCapacity} icon={Users} hint="across 6 batches" delay={0} />
        <StatCard label="Slots assigned" value={totalAssigned} icon={CheckCircle2} hint={`${Math.round((totalAssigned / totalCapacity) * 100)}% filled`} delay={0.06} />
        <StatCard label="Attended" value={totalAttended} icon={PlayCircle} trend={-8} hint="no-shows tracked" delay={0.12} />
        <StatCard label="Batches completed" value={completed} suffix={` of ${INTERVIEW_BATCHES.length}`} icon={Clock} delay={0.18} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {INTERVIEW_BATCHES.map((batch, index) => {
          const fillPercent = Math.round((batch.assigned / batch.capacity) * 100)
          const attendancePercent = batch.assigned
            ? Math.round((batch.attended / batch.assigned) * 100)
            : 0

          return (
            <motion.div
              key={batch.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
            >
              <Card
                className={cn(
                  'h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
                  batch.status === 'in_progress' && 'border-warning/40',
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        Batch {batch.batchNumber}
                        {batch.status === 'in_progress' && (
                          <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-warning" />
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {new Date(batch.date).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'long',
                        })}{' '}
                        · {batch.slot}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusDot tone={STATUS_TONE[batch.status]} label={STATUS_LABEL[batch.status]} />
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label={`Actions for batch ${batch.batchNumber}`}
                              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View candidates</DropdownMenuItem>
                          <DropdownMenuItem>Send reminder</DropdownMenuItem>
                          <DropdownMenuItem>Edit slot</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive">Cancel batch</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Seats assigned</span>
                      <span className="font-medium tabular-nums">
                        {batch.assigned} / {batch.capacity}
                      </span>
                    </div>
                    <Progress value={fillPercent}>
                      <ProgressTrack>
                        <ProgressIndicator />
                      </ProgressTrack>
                    </Progress>
                  </div>

                  {batch.status === 'completed' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Attendance</span>
                        <span className="font-medium tabular-nums">
                          {batch.attended} / {batch.assigned} ({attendancePercent}%)
                        </span>
                      </div>
                      <Progress value={attendancePercent}>
                        <ProgressTrack>
                          <ProgressIndicator />
                        </ProgressTrack>
                      </Progress>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    {batch.status === 'scheduled' && (
                      <>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Users className="size-3.5" />
                          Assign candidates
                        </Button>
                        <Button size="sm" className="flex-1">
                          <Mail className="size-3.5" />
                          Send invites
                        </Button>
                      </>
                    )}
                    {batch.status === 'in_progress' && (
                      <Button size="sm" className="w-full">
                        <CheckCircle2 className="size-3.5" />
                        Record attendance
                      </Button>
                    )}
                    {batch.status === 'completed' && (
                      <Button size="sm" variant="outline" className="w-full">
                        View results
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-6"
      >
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CalendarPlus className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Need another batch?</p>
              <p className="max-w-md text-sm text-muted-foreground">
                The reference split is 50 / 50 / 25 across 10:00, 11:00, and 12:00. Batch
                sizes can be adjusted per bootcamp.
              </p>
            </div>
            <Button variant="outline">
              <CalendarPlus className="size-4" />
              Create batch
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
