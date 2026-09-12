/**
 * Onboarded stats — the two halves of the end of the pipeline.
 *
 * Split into tabs because they answer different questions from different
 * sources. "Onboarding" is our own database: how far through their paperwork
 * this intake's candidates are. "Agilytics joins" is the handover: who we
 * invited to the workspace and who actually arrived.
 *
 * Both are read-only. The one action on this page is the join check, and it
 * is a button rather than something a page load does: their workspace-wide
 * response reports students as counts, so resolving whether one candidate has
 * joined costs one HTTP request, and a screen that did it on every render
 * would issue a request per candidate per refresh.
 */

import { GraduationCap, RefreshCw, TrendingUp, Users } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { AppLoader } from '@/components/shared/app-loader'
import { PendingLabel } from '@/components/shared/pending-label'
import { PageHeader, StatCard } from '@/components/shared/portal-ui'
import { Reveal } from '@/components/motion/reveal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { agilyticsApi, onboardingApi } from '@/features/admin/api'
import { AsyncSection, BootcampSwitcher, BootcampGate } from '@/features/admin/components'
import { AgilyticsStatusBadge, agilyticsStateOf } from '@/features/agilytics/status-badge'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import type { AgilyticsCandidateRow, OnboardingCandidateSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Big enough to cover an intake in one fetch — these are per-cohort figures,
 *  and paginating a statistic would make it wrong rather than shorter. */
const ALL = 500

export default function AdminOnboardedStatsPage() {
  const { selected, loading: bootcampLoading } = useBootcamp()

  return (
    <>
      <PageHeader
        title="Onboarded stats"
        description={
          bootcampLoading
            ? undefined
            : selected
              ? `Paperwork progress and Agilytics handover for ${selected.name}.`
              : 'Pick an intake to see its onboarding and handover figures.'
        }
        actions={<BootcampSwitcher />}
      />

      <BootcampGate icon={TrendingUp}>
        {(selectedId) => (
          <Tabs defaultValue="onboarding">
            <TabsList>
              <TabsTrigger value="onboarding">Onboarding stats</TabsTrigger>
              <TabsTrigger value="agilytics">Agilytics joins</TabsTrigger>
            </TabsList>

            <TabsContent value="onboarding">
              <OnboardingStatsTab bootcampId={selectedId} />
            </TabsContent>
            <TabsContent value="agilytics">
              <AgilyticsStatsTab bootcampId={selectedId} bootcampName={selected?.name} />
            </TabsContent>
          </Tabs>
        )}
      </BootcampGate>
    </>
  )
}

/* ------------------------------------------------------ tab A: onboarding -- */

function OnboardingStatsTab({ bootcampId }: { bootcampId: string }) {
  // The same endpoint the Onboarding folder grid is built from, so the two
  // screens cannot disagree about how far anybody has got.
  const { data, error, initialLoading, refetch } = useAsync(
    () => onboardingApi.listCandidates(bootcampId, { limit: ALL, offset: 0 }),
    [bootcampId],
  )

  const rows = useMemo(() => data?.items ?? [], [data])
  const stats = useMemo(() => summarise(rows), [rows])

  return (
    <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
      <div className="flex flex-col gap-4 pt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="In onboarding" value={stats.total} icon={Users} tone="primary" />
          <StatCard
            label="Forms complete"
            value={stats.formsComplete}
            icon={GraduationCap}
            tone="info"
            hint={`${pct(stats.formsComplete, stats.total)} of the cohort`}
          />
          <StatCard
            label="All documents approved"
            value={stats.docsSettled}
            icon={GraduationCap}
            tone="success"
            hint={`${pct(stats.docsSettled, stats.total)} of the cohort`}
          />
          <StatCard
            label="Awaiting review"
            value={stats.pendingReview}
            icon={RefreshCw}
            tone="warning"
            hint={stats.rejected > 0 ? `${stats.rejected} rejected document(s)` : undefined}
          />
        </div>

        <Reveal direction="none" duration={0.3}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Paperwork progress</CardTitle>
              <CardDescription>
                Every candidate in onboarding, by how much of their folder is done.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ProgressBar
                label="Forms submitted"
                done={stats.formsSubmitted}
                total={stats.formsExpected}
                tone="bg-info"
              />
              <ProgressBar
                label="Documents uploaded"
                done={stats.docsUploaded}
                total={stats.docsRequired}
                tone="bg-primary"
              />
              <ProgressBar
                label="Documents approved"
                done={stats.docsApproved}
                total={stats.docsRequired}
                tone="bg-success"
              />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </AsyncSection>
  )
}

interface OnboardingSummary {
  total: number
  formsComplete: number
  formsSubmitted: number
  formsExpected: number
  docsSettled: number
  docsUploaded: number
  docsApproved: number
  docsRequired: number
  pendingReview: number
  rejected: number
}

function summarise(rows: OnboardingCandidateSummary[]): OnboardingSummary {
  const sum = (pick: (r: OnboardingCandidateSummary) => number) =>
    rows.reduce((total, row) => total + pick(row), 0)

  return {
    total: rows.length,
    formsComplete: rows.filter((r) => r.forms_submitted >= r.forms_total).length,
    formsSubmitted: sum((r) => r.forms_submitted),
    formsExpected: sum((r) => r.forms_total),
    // "Settled" rather than "approved": a folder with nothing left pending and
    // nothing rejected is the one an admin never has to open again.
    docsSettled: rows.filter(
      (r) => r.hub_unlocked && r.documents_pending === 0 && r.documents_rejected === 0,
    ).length,
    docsUploaded: sum((r) => r.documents_uploaded),
    docsApproved: sum((r) => r.documents_approved),
    docsRequired: sum((r) => r.documents_required),
    pendingReview: sum((r) => r.documents_pending),
    rejected: sum((r) => r.documents_rejected),
  }
}

/* -------------------------------------------------------- tab B: agilytics -- */

function AgilyticsStatsTab({
  bootcampId,
  bootcampName,
}: {
  bootcampId: string
  bootcampName?: string
}) {
  const membership = useAsync(() => agilyticsApi.eligible(bootcampId), [bootcampId])
  // Their workspace-wide read. Kept separate from the membership lookup above
  // because it is the half that can fail on their side, and our own figures
  // stay meaningful when it does.
  const workspace = useAsync(() => agilyticsApi.state(bootcampId), [bootcampId])

  const sync = useMutation(() => agilyticsApi.syncJoins(bootcampId))

  const rows = useMemo(
    () => [...(membership.data?.new ?? []), ...(membership.data?.already_invited ?? [])],
    [membership.data],
  )
  const invited = rows.filter((r) => r.invited_at)
  const joined = rows.filter((r) => r.joined_at)

  async function check() {
    const out = await sync.run()
    if (!out) return
    toast.success(
      out.advanced.length > 0
        ? `${out.advanced.length} candidate(s) joined and moved to Onboarded`
        : `Checked ${out.checked} — no new joins`,
    )
    membership.refetch()
    workspace.refetch()
  }

  return (
    <AsyncSection
      initialLoading={membership.initialLoading}
      error={membership.error}
      onRetry={membership.refetch}
    >
      <div className="flex flex-col gap-4 pt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Eligible" value={rows.length} icon={Users} tone="primary" />
          <StatCard label="Invited" value={invited.length} icon={RefreshCw} tone="info" />
          <StatCard label="Joined" value={joined.length} icon={GraduationCap} tone="success" />
          <StatCard
            label="Join rate"
            value={invited.length === 0 ? 0 : Math.round((joined.length / invited.length) * 100)}
            suffix="%"
            icon={TrendingUp}
            tone="warning"
            hint={invited.length === 0 ? 'Nobody invited yet' : `of ${invited.length} invited`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Join state is our own record, stamped when Agilytics confirmed it.
          </p>
          <Button variant="outline" onClick={check} disabled={sync.pending || invited.length === 0}>
            <RefreshCw className="size-4" />
            <PendingLabel idle="Check for new joins" pending="Checking…" isPending={sync.pending} />
          </Button>
        </div>

        {sync.error && (
          <Alert variant="destructive">
            <AlertDescription>{sync.error}</AlertDescription>
          </Alert>
        )}

        <WorkspacePanel state={workspace} bootcampName={bootcampName} />

        <Reveal direction="none" duration={0.3}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Candidates</CardTitle>
              <CardDescription>
                Everyone who has cleared the Physical Interview, and where they are in the handover.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nobody has cleared the Physical Interview yet.
                </p>
              ) : (
                rows.map((row) => <CandidateLine key={row.application_id} row={row} />)
              )}
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </AsyncSection>
  )
}

function CandidateLine({ row }: { row: AgilyticsCandidateRow }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2">
      <span className="font-mono text-xs whitespace-nowrap">{row.candidate_code}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.full_name ?? '—'}</span>
      <span className="hidden truncate text-xs text-muted-foreground md:block">{row.email}</span>
      <AgilyticsStatusBadge state={agilyticsStateOf(row)} />
    </div>
  )
}

/**
 * Their side of the workspace.
 *
 * Rendered as a soft failure rather than an error boundary: their endpoint
 * being unreachable is a fact about them, and it must not blank out our own
 * invited/joined figures above, which are read from our database and stay
 * true regardless.
 */
function WorkspacePanel({
  state,
  bootcampName,
}: {
  state: ReturnType<
    typeof useAsync<ReturnType<typeof agilyticsApi.state> extends Promise<infer T> ? T : never>
  >
  bootcampName?: string
}) {
  const data = state.data

  if (state.initialLoading) {
    return (
      <Card>
        <CardContent className="grid min-h-28 place-items-center">
          <AppLoader size="sm" label="Reading the Agilytics workspace" />
        </CardContent>
      </Card>
    )
  }

  if (state.error || !data) {
    return (
      <Alert>
        <AlertDescription>
          Could not read the Agilytics workspace right now, so the figures below are ours alone.{' '}
          {state.error}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data.provisioned) {
    return (
      <Alert>
        <AlertDescription>
          {bootcampName ?? 'This intake'} has not been provisioned in Agilytics yet.
        </AlertDescription>
      </Alert>
    )
  }

  const breakdown: [string, number | null, string][] = [
    ['Approved', data.approved, 'bg-success'],
    ['Pending', data.pending, 'bg-warning'],
    ['Left', data.left, 'bg-muted-foreground'],
    ['Rejected', data.rejected, 'bg-destructive'],
    ['Revoked', data.revoked, 'bg-destructive/60'],
  ]
  const present = breakdown.filter(([, value]) => value !== null && value !== undefined)

  return (
    <Reveal direction="none" duration={0.3}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {data.workspace_name ?? 'Agilytics workspace'}
              </CardTitle>
              <CardDescription>
                {data.total_members ?? 0} member
                {data.total_members === 1 ? '' : 's'} on their side.
              </CardDescription>
            </div>
            {data.students_count !== null && (
              <Badge variant="outline" className="font-normal">
                {data.students_count} student
                {data.students_count === 1 ? '' : 's'} · {data.leads_count ?? 0} lead
                {data.leads_count === 1 ? '' : 's'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {present.map(([label, value, tone]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
              >
                <span className={cn('size-2 rounded-full', tone)} />
                {label}
                <span className="font-semibold tabular-nums">{value}</span>
              </span>
            ))}
          </div>

          {data.tracks.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {data.tracks.map((track) => (
                <ProgressBar
                  key={track.track_id ?? track.track_name ?? 'track'}
                  label={track.track_name ?? 'Untitled track'}
                  done={track.member_count}
                  total={data.total_members || track.member_count}
                  tone="bg-primary"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Reveal>
  )
}

/* --------------------------------------------------------------- shared -- */

function pct(part: number, whole: number): string {
  if (whole === 0) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}

function ProgressBar({
  label,
  done,
  total,
  tone,
}: {
  label: string
  done: number
  total: number
  tone: string
}) {
  const ratio = total === 0 ? 0 : Math.min(1, done / total)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', tone)}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}
