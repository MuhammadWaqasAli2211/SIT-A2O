import { motion } from 'motion/react'
import {
  CalendarClock,
  CheckCircle2,
  Lock,
  LockOpen,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/shared/portal-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { PHASES } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const PHASE_DETAIL: Record<string, { blurb: string; gate: string }> = {
  REGISTRATION: {
    blurb: 'Candidates submit applications and receive their candidate code.',
    gate: 'While closed, no new applications are accepted.',
  },
  INTERVIEW: {
    blurb: 'Batches are generated and invitations sent. Screening results recorded.',
    gate: 'While closed, candidates cannot be advanced past interview.',
  },
  FORM: {
    blurb: 'Selected candidates submit bank and identity details for enrolment.',
    gate: 'While closed, the onboarding form is locked for all candidates.',
  },
  ONBOARDING: {
    blurb: 'Final confirmation, class allocation, and handover to Agilytic.',
    gate: 'While closed, enrolment cannot be finalised.',
  },
}

export default function AdminPhasesPage() {
  const [phases, setPhases] = useState(PHASES)

  const togglePhase = (phaseKey: string) => {
    setPhases((prev) =>
      prev.map((p) => (p.phase === phaseKey ? { ...p, isOpen: !p.isOpen } : p)),
    )
  }

  return (
    <>
      <PageHeader
        title="Phases & deadlines"
        description="Each stage is gated. Opening or closing a phase takes effect immediately for every candidate."
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>Deadlines are enforced on the server</AlertTitle>
          <AlertDescription>
            Closing a phase blocks the action for everyone, including admins. A candidate
            cannot be advanced past a closed phase without reopening it first — and every
            reopen is recorded in the audit log.
          </AlertDescription>
        </Alert>
      </motion.div>

      <div className="flex flex-col gap-5">
        {phases.map((phase, index) => {
          const detail = PHASE_DETAIL[phase.phase]!

          return (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <Card
                className={cn(
                  'transition-all duration-300',
                  phase.isOpen ? 'border-success/35' : 'border-border',
                )}
              >
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'grid size-11 shrink-0 place-items-center rounded-xl transition-colors',
                          phase.isOpen
                            ? 'bg-success/12 text-success'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {phase.isOpen ? <LockOpen className="size-5" /> : <Lock className="size-5" />}
                      </span>

                      <div className="flex flex-col gap-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          {phase.label}
                          {phase.isOpen ? (
                            <Badge className="bg-success/15 text-success">Open</Badge>
                          ) : (
                            <Badge variant="outline">Closed</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{detail.blurb}</CardDescription>
                      </div>
                    </div>

                    <Button
                      variant={phase.isOpen ? 'outline' : 'default'}
                      onClick={() => togglePhase(phase.phase)}
                    >
                      {phase.isOpen ? (
                        <>
                          <Lock className="size-4" />
                          Close phase
                        </>
                      ) : (
                        <>
                          <LockOpen className="size-4" />
                          Open phase
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${phase.phase}-opens`}>Opens at</Label>
                      <Input
                        id={`${phase.phase}-opens`}
                        type="date"
                        defaultValue={phase.opensAt}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${phase.phase}-deadline`}>Deadline</Label>
                      <Input
                        id={`${phase.phase}-deadline`}
                        type="date"
                        defaultValue={phase.deadlineAt}
                      />
                    </div>
                  </div>

                  {phase.progress > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-medium">{phase.progress}%</span>
                      </div>
                      <Progress value={phase.progress}>
                        <ProgressTrack>
                          <ProgressIndicator />
                        </ProgressTrack>
                      </Progress>
                    </div>
                  )}

                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <span>{detail.gate}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className="size-4" />
                      Closes{' '}
                      {new Date(phase.deadlineAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <Button size="sm" variant="ghost">
                      <CheckCircle2 className="size-3.5" />
                      Save changes
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
