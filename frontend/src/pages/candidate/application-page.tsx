/**
 * The candidate's application: what they submitted, or the form to submit one.
 *
 * Both live on one screen because which the candidate needs depends entirely
 * on whether they have applied — routing them to a separate "apply" page would
 * mean guessing that before the data loads.
 */

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Send,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Stagger, StaggerItem } from '@/components/motion/reveal'
import { PendingLabel } from '@/components/shared/pending-label'
import { EmptyState, PageHeader, StageBadge, Timeline } from '@/components/shared/portal-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AsyncSection } from '@/features/admin/components'
import { candidateApi } from '@/features/candidate/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import { STAGE_LABEL, type ApplicationDetail, type PublicBootcamp } from '@/lib/types'
import { cn } from '@/lib/utils'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function CandidateApplicationPage() {
  const { data, error, initialLoading, refetch } = useAsync(
    () => candidateApi.myApplications(),
    [],
  )

  const applications = data ?? []

  return (
    <>
      <PageHeader
        title="My application"
        description={
          applications.length > 0
            ? 'Everything you submitted, and how it has progressed.'
            : 'Apply to an open intake to get started.'
        }
      />

      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refetch}
      >
        {applications.length === 0 ? (
          <ApplyFlow onApplied={refetch} />
        ) : (
          <Stagger className="flex flex-col gap-5">
            {applications.map((application) => (
              <StaggerItem key={application.id}>
                <SubmittedApplication application={application} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </AsyncSection>
    </>
  )
}

function SubmittedApplication({ application }: { application: ApplicationDetail }) {
  const timeline = application.timeline.map((entry, index) => ({
    label: STAGE_LABEL[entry.to_stage],
    date: formatDate(entry.created_at),
    status: (index === application.timeline.length - 1 ? 'active' : 'done') as 'active' | 'done',
    detail: entry.reason ?? undefined,
  }))

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">{application.program.title}</CardTitle>
          <CardDescription>{application.bootcamp_name}</CardDescription>
        </div>
        <Badge variant="outline" className="shrink-0 font-mono text-xs font-normal">
          {application.candidate_code}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={application.stage} />
          {application.status !== 'ACTIVE' && (
            <Badge variant="outline">{application.status}</Badge>
          )}
          <Badge variant="outline" className="font-normal">
            Applied {formatDate(application.applied_at)}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Track" value={application.program.title} />
          <Field label="Candidate code" value={application.candidate_code} mono />
          {application.program.duration && (
            <Field label="Duration" value={application.program.duration} />
          )}
          {application.program.mode && (
            <Field label="Mode" value={application.program.mode} />
          )}
        </div>

        {application.statement && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Your statement</span>
            <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              {application.statement}
            </p>
          </div>
        )}

        <Separator />

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium">Progress</h3>
          <Timeline items={timeline} />
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium', mono && 'font-mono')}>{value}</span>
    </div>
  )
}

/* ------------------------------------------------------------ apply flow -- */

function ApplyFlow({ onApplied }: { onApplied: () => void }) {
  const { data, error, initialLoading, refetch } = useAsync(
    () => candidateApi.openBootcamps(),
    [],
  )

  const [bootcampId, setBootcampId] = useState<string | null>(null)
  const [programId, setProgramId] = useState<string | null>(null)
  const [statement, setStatement] = useState('')

  const open = data ?? []
  const chosen = open.find((b) => b.id === bootcampId) ?? null

  const submit = useMutation(() =>
    candidateApi.apply({
      bootcamp_id: bootcampId!,
      program_id: programId!,
      statement: statement.trim() || undefined,
    }),
  )

  async function apply() {
    const created = await submit.run()
    if (created) {
      toast.success(`Application submitted — your code is ${created.candidate_code}`)
      onApplied()
    }
  }

  return (
    <AsyncSection
      initialLoading={initialLoading}
      error={error}
      onRetry={refetch}
    >
      {open.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No intakes are open right now"
          description="Registration opens ahead of each bootcamp. Check back soon, or follow the announcements on the main site."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1 · Choose an intake</CardTitle>
              <CardDescription>These are accepting applications now.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {open.map((bootcamp) => (
                <BootcampOption
                  key={bootcamp.id}
                  bootcamp={bootcamp}
                  selected={bootcampId === bootcamp.id}
                  onSelect={() => {
                    setBootcampId(bootcamp.id)
                    // The chosen track must belong to the chosen intake.
                    setProgramId(null)
                  }}
                />
              ))}
            </CardContent>
          </Card>

          {chosen && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">2 · Choose your track</CardTitle>
                <CardDescription>
                  What you want to study on {chosen.name}.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {chosen.programs.map((program) => (
                  <button
                    key={program.id}
                    type="button"
                    onClick={() => setProgramId(program.id)}
                    className={cn(
                      'flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors',
                      programId === program.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {program.title}
                      {programId === program.id && (
                        <CheckCircle2 className="size-4 text-primary" />
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">{program.tagline}</span>
                    <span className="text-xs text-muted-foreground">
                      {[program.duration, program.mode, program.level]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {chosen && programId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3 · Tell us why</CardTitle>
                <CardDescription>
                  Optional, but it helps — a few sentences about why you want this place.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="statement">Statement of purpose</Label>
                  <textarea
                    id="statement"
                    rows={5}
                    maxLength={2000}
                    value={statement}
                    onChange={(event) => setStatement(event.target.value)}
                    className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="self-end text-xs text-muted-foreground">
                    {statement.length} / 2000
                  </span>
                </div>

                {submit.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>{submit.error}</AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    You can apply to each intake once. Your track cannot be changed afterwards
                    without an administrator's help.
                  </AlertDescription>
                </Alert>

                <Button onClick={apply} disabled={submit.pending} className="self-start">
                  <Send className="size-4" />
                  <PendingLabel
                    idle="Submit application"
                    pending="Submitting…"
                    isPending={submit.pending}
                  />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AsyncSection>
  )
}

function BootcampOption({
  bootcamp,
  selected,
  onSelect,
}: {
  bootcamp: PublicBootcamp
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        {bootcamp.name}
        {selected && <CheckCircle2 className="size-4 text-primary" />}
      </span>
      {bootcamp.description && (
        <span className="text-sm text-muted-foreground">{bootcamp.description}</span>
      )}
      <span className="flex flex-wrap gap-2 pt-1">
        {bootcamp.starts_at && (
          <Badge variant="outline" className="font-normal">
            Starts {formatDate(bootcamp.starts_at)}
          </Badge>
        )}
        {bootcamp.registration_deadline && (
          <Badge variant="outline" className="font-normal">
            Apply by {formatDate(bootcamp.registration_deadline)}
          </Badge>
        )}
      </span>
    </button>
  )
}
