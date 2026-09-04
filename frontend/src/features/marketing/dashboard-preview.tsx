/**
 * The floating admin-dashboard preview in the hero.
 *
 * A miniature of the real admin product: the same icon rail, the same stat-card
 * shape, the same two chart panels the admin dashboard actually renders. Built
 * from live components rather than an image so it recolours with the theme,
 * stays sharp at any density, and can respond to a pointer — the range
 * dropdown really opens, the donut really highlights.
 *
 * The figures inside are illustrative and the card says so. See the header of
 * preview-data.ts for the real/illustrative split and the reasoning.
 */

import { lazy, Suspense } from 'react'
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Search,
  Settings,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { Counter } from '@/components/motion/counter'
import { PREVIEW_STATS, TONE_CHIP } from '@/features/marketing/preview-data'
import { cn } from '@/lib/utils'

// Recharts stays out of the marketing entry chunk. See preview-charts.tsx.
const PreviewCharts = lazy(() => import('@/features/marketing/preview-charts'))

/** The rail down the left edge. Mirrors the portal's own nav order. */
const RAIL: { icon: LucideIcon; label: string }[] = [
  { icon: LayoutGrid, label: 'Overview' },
  { icon: Users, label: 'Candidates' },
  { icon: ClipboardList, label: 'Applications' },
  { icon: CalendarDays, label: 'Interviews' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Settings, label: 'Settings' },
]

/**
 * One icon per stat card, keyed by label rather than positional.
 *
 * A parallel array would silently pair the wrong icon with the wrong stat the
 * first time either list is reordered.
 */
const STAT_ICON: Record<string, LucideIcon> = {
  'Total Applications': ClipboardList,
  Shortlisted: Users,
  'In Progress': TrendingUp,
  Completed: Star,
}

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-primary/10',
        className,
      )}
      /*
        A labelled group, deliberately not `role="img"`.

        role="img" would collapse the whole subtree to a single label, which
        reads well until you remember the period dropdown inside is a real
        focusable control: keyboard focus would still land on it while the
        accessibility tree no longer describes it. A focusable element that
        assistive tech cannot name is worse than a slightly longer read.

        The "figures are illustrative" caveat is not carried in a label here —
        it is real text at the foot of the card, so it reaches everyone by the
        same route rather than only screen-reader users.
      */
      role="group"
      aria-label="Admin dashboard preview"
    >
      {/* ------------------------------------------------------- icon rail -- */}
      <div className="hidden shrink-0 flex-col items-center gap-1 bg-nav-shell px-2 py-4 sm:flex">
        {RAIL.map((item, index) => (
          <span
            key={item.label}
            title={item.label}
            className={cn(
              'grid size-8 place-items-center rounded-lg transition-colors',
              index === 0
                ? 'bg-primary text-primary-foreground'
                : 'text-nav-shell-ink/45 hover:text-nav-shell-ink',
            )}
          >
            <item.icon className="size-4" />
          </span>
        ))}
        <span className="mt-auto grid size-8 place-items-center rounded-lg text-nav-shell-ink/45">
          <LogOut className="size-4" />
        </span>
      </div>

      {/*
        ------------------------------------------------------------ body --
        A container, not a viewport consumer. Everything inside sizes off this
        card's own width, because the card lives in a grid column whose width
        does not track the breakpoints: at 1280px the hero splits in two and
        this column is ~600px, while at 1024px the hero has already stacked and
        the same card is ~960px. Keyed to `lg:` it would lay out for four stat
        cards exactly when it is narrowest.
      */}
      <div className="@container flex min-w-0 flex-1 flex-col gap-3.5 p-4 sm:p-5">
        <PreviewHeader />

        <div className="grid grid-cols-2 gap-2.5 @lg:grid-cols-4">
          {PREVIEW_STATS.map((stat) => {
            const Icon = STAT_ICON[stat.label] ?? ClipboardList
            return (
              <div
                key={stat.label}
                className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[0.68rem] leading-tight text-muted-foreground">
                    {stat.label}
                  </span>
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-md',
                      TONE_CHIP[stat.tone],
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                </div>

                {/* Counts up on entry, using the same primitive the real stats
                    band uses — and it holds the final value for reduced
                    motion and for screen readers. */}
                <span className="text-lg leading-none font-bold tracking-tight sm:text-xl">
                  <Counter to={stat.value} duration={1.8} />
                </span>

                {/* Wraps rather than overflows: "18.6% vs last month" is at
                    the edge of fitting a quarter-width card. */}
                <span className="flex flex-wrap items-center gap-x-1 text-[0.6rem] text-success">
                  <TrendingUp className="size-3 shrink-0" />
                  {stat.trend}%
                  <span className="text-muted-foreground">vs last month</span>
                </span>
              </div>
            )
          })}
        </div>

        {/* Reserves the loaded panels' height so the card does not jump when
            the Recharts chunk arrives. */}
        <Suspense
          fallback={<div className="h-[13.5rem] animate-pulse rounded-xl bg-muted/60" />}
        >
          <PreviewCharts />
        </Suspense>

        <p className="text-[0.6rem] leading-tight text-muted-foreground/70">
          Preview of the admin dashboard. Figures shown are illustrative.
        </p>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- header -- */

function PreviewHeader() {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-bold tracking-tight sm:text-base">
          Welcome back, Admin! 👋
        </span>
        <span className="truncate text-[0.68rem] text-muted-foreground">
          Here's what's happening today.
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-muted-foreground sm:block">
          <Search className="size-4" />
        </span>
        <span className="relative hidden text-muted-foreground sm:block">
          <Bell className="size-4" />
          <span className="absolute -top-1 -right-1 grid size-3 place-items-center rounded-full bg-destructive text-[0.5rem] font-bold text-destructive-foreground">
            3
          </span>
        </span>

        <span className="flex items-center gap-1.5">
          {/* Initials, not a photograph. The reference shows a stock portrait;
              a marketing page must not imply a real, identifiable person is a
              user of this platform. */}
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/12 text-[0.6rem] font-bold text-primary">
            AU
          </span>
          <span className="hidden flex-col leading-tight lg:flex">
            <span className="text-[0.68rem] font-semibold">Admin User</span>
            <span className="text-[0.6rem] text-muted-foreground">Super Admin</span>
          </span>
          <ChevronDown className="hidden size-3 text-muted-foreground lg:block" />
        </span>
      </div>
    </div>
  )
}
