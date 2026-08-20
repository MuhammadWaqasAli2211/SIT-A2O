import { motion } from 'motion/react'
import {
  CalendarClock,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react'

import { PageHeader, StatusDot } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
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
import { BOOTCAMPS, type BootcampRow } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<BootcampRow['status'], 'success' | 'warning' | 'neutral' | 'info'> = {
  REG_OPEN: 'success',
  INTERVIEWING: 'warning',
  COMPLETED: 'neutral',
  DRAFT: 'info',
}

const STATUS_LABEL: Record<BootcampRow['status'], string> = {
  REG_OPEN: 'Registration open',
  INTERVIEWING: 'Interviewing',
  COMPLETED: 'Completed',
  DRAFT: 'Draft',
}

export default function SuperAdminBootcampsPage() {
  return (
    <>
      <PageHeader
        title="Bootcamps"
        description="Create intakes, assign administrators, and monitor capacity."
        actions={
          <Button>
            <Plus className="size-4" />
            New bootcamp
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {BOOTCAMPS.map((bootcamp, index) => {
          const fill = Math.min(100, Math.round((bootcamp.applicants / bootcamp.seats) * 100))
          const unassigned = bootcamp.admin === 'Unassigned'

          return (
            <motion.div
              key={bootcamp.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
            >
              <Card
                className={cn(
                  'h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
                  unassigned && 'border-dashed',
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                        {String(bootcamp.number).padStart(2, '0')}
                      </span>
                      <div className="flex flex-col gap-1">
                        <CardTitle className="text-base">{bootcamp.name}</CardTitle>
                        <CardDescription>
                          Starts{' '}
                          {new Date(bootcamp.startsAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </CardDescription>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label={`Actions for ${bootcamp.name}`}
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Open dashboard</DropdownMenuItem>
                        <DropdownMenuItem>Assign administrator</DropdownMenuItem>
                        <DropdownMenuItem>Edit details</DropdownMenuItem>
                        <DropdownMenuItem>Export applicants</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive">Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusDot
                      tone={STATUS_TONE[bootcamp.status]}
                      label={STATUS_LABEL[bootcamp.status]}
                    />
                    <Badge variant="outline" className="gap-1 text-[0.7rem]">
                      <Users className="size-3" />
                      {bootcamp.seats} seats
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Applications</span>
                      <span className="font-medium tabular-nums">
                        {bootcamp.applicants} / {bootcamp.seats}
                      </span>
                    </div>
                    <Progress value={fill}>
                      <ProgressTrack>
                        <ProgressIndicator />
                      </ProgressTrack>
                    </Progress>
                    {bootcamp.applicants > bootcamp.seats && (
                      <span className="text-xs text-muted-foreground">
                        Oversubscribed by {bootcamp.applicants - bootcamp.seats} applicants
                      </span>
                    )}
                  </div>

                  <div
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border p-3',
                      unassigned ? 'border-warning/40 bg-warning/5' : 'border-border',
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-lg',
                          unassigned
                            ? 'bg-warning/15 text-warning-foreground dark:text-warning'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {unassigned ? (
                          <UserCog className="size-4" />
                        ) : (
                          <ShieldCheck className="size-4" />
                        )}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          Administrator
                        </span>
                        <span className="text-sm font-medium">{bootcamp.admin}</span>
                      </span>
                    </span>

                    {unassigned && (
                      <Button size="sm" variant="outline">
                        Assign
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2 border-t border-border pt-4">
                    <Button size="sm" variant="outline" className="flex-1">
                      <CalendarClock className="size-3.5" />
                      Phases
                    </Button>
                    <Button size="sm" className="flex-1">
                      Open dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </>
  )
}
