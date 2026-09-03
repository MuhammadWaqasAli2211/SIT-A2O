/**
 * The numbers inside the hero's dashboard preview.
 *
 * ## These are illustrative. They are not this platform's data.
 *
 * A deliberate decision, not an oversight, and the split is precise:
 *
 *   REAL, from `/bootcamps/open`  — which intake is open, its number, its
 *                                   name, its registration deadline. Anything
 *                                   the page *asserts about admissions* comes
 *                                   from the server. See use-open-bootcamp.ts.
 *
 *   ILLUSTRATIVE, from this file — the figures inside the product screenshot:
 *                                   application counts, the trend curve, the
 *                                   status split.
 *
 * Why not real aggregates: `/bootcamps/open` is the only public endpoint, and
 * its schema says so in as many words — "Deliberately narrower than
 * BootcampOut: no internal status, no counts." Publishing live counts would
 * need a new public endpoint and would put a quiet week's low application
 * number on the front page of the site. The preview is a picture of the admin
 * product, in the same role as a screenshot in a feature tour; it is not a
 * dashboard and does not claim to be one.
 *
 * This does not contradict the portal's real-data rule. That rule is why
 * `lib/mock-data.ts` was deleted from the portal, and every figure an admin or
 * candidate is shown while *making a decision* is fetched. Nothing here is
 * shown to anyone making a decision. The homepage already carries illustrative
 * figures on the same footing in `site-data.ts` (STATS: "250,000+ trained").
 *
 * The preview is labelled in the UI as a product preview so a visitor is never
 * left to assume these are live numbers — see dashboard-preview.tsx.
 *
 * The shapes below intentionally mirror the real admin dashboard's
 * `BootcampStats` (`applications_over_time`, a status split) so the marketing
 * preview and `pages/admin/dashboard-charts.tsx` stay visually the same
 * product. If these ever do become real, the swap is this module only.
 */

/** A stat card in the preview's top row. */
export interface PreviewStat {
  label: string
  value: number
  /** Month-over-month movement, rendered as the small green trend line. */
  trend: number
  /** Which chart token tints the card's icon chip. */
  tone: 'primary' | 'gold' | 'blue' | 'amber'
}

export const PREVIEW_STATS: readonly PreviewStat[] = [
  { label: 'Total Applications', value: 12842, trend: 18.6, tone: 'primary' },
  { label: 'Shortlisted', value: 4276, trend: 14.3, tone: 'amber' },
  { label: 'In Progress', value: 3422, trend: 12.8, tone: 'blue' },
  { label: 'Completed', value: 2365, trend: 20.4, tone: 'gold' },
]

/** One point on the "Applications Over Time" curve. */
export interface PreviewPoint {
  /** Axis label. Short, because the preview card is narrow. */
  date: string
  applications: number
}

/**
 * Five labelled weeks with intermediate points between them, so the line has
 * the irregular week-to-week shape a real intake produces rather than a smooth
 * arc. Only the five week starts carry a tick label.
 */
export const PREVIEW_TREND: readonly PreviewPoint[] = [
  { date: 'May 01', applications: 980 },
  { date: '', applications: 1240 },
  { date: '', applications: 1120 },
  { date: 'May 08', applications: 1680 },
  { date: '', applications: 1520 },
  { date: '', applications: 2080 },
  { date: 'May 15', applications: 1840 },
  { date: '', applications: 2260 },
  { date: '', applications: 2020 },
  { date: 'May 22', applications: 2842 },
  { date: '', applications: 2540 },
  { date: '', applications: 2980 },
  { date: 'May 29', applications: 3320 },
]

/** A segment of the donut, and one row of its legend. */
export interface PreviewSlice {
  label: string
  value: number
  tone: 'primary' | 'amber' | 'blue' | 'red'
}

export const PREVIEW_SPLIT: readonly PreviewSlice[] = [
  { label: 'Shortlisted', value: 4276, tone: 'primary' },
  { label: 'In Progress', value: 3422, tone: 'amber' },
  { label: 'Completed', value: 2365, tone: 'blue' },
  { label: 'Rejected', value: 2779, tone: 'red' },
]

export const PREVIEW_TOTAL = PREVIEW_SPLIT.reduce((sum, slice) => sum + slice.value, 0)

/**
 * Chart tones mapped to theme tokens.
 *
 * Gold, blue and red are --chart-3 / --chart-2 / --chart-5 rather than new
 * tokens: those three already *are* those colours, and the real admin charts
 * read from the same set via `CHART_COLORS`, so the preview and the product
 * cannot drift apart on colour.
 */
export const TONE_COLOR = {
  primary: 'var(--color-chart-1)',
  blue: 'var(--color-chart-2)',
  gold: 'var(--color-chart-3)',
  amber: 'var(--color-warning)',
  red: 'var(--color-chart-5)',
} as const

/** The same mapping as Tailwind classes, for the icon chips. */
export const TONE_CHIP: Record<PreviewStat['tone'], string> = {
  primary: 'bg-chart-1/12 text-chart-1',
  amber: 'bg-warning/15 text-warning',
  blue: 'bg-chart-2/12 text-chart-2',
  gold: 'bg-chart-3/15 text-chart-3',
}

/** Ranges offered by the preview's period dropdown. */
export const PREVIEW_RANGES = ['This Month', 'Last 3 Months', 'This Year'] as const
export type PreviewRange = (typeof PREVIEW_RANGES)[number]

/**
 * The trend series for a given range.
 *
 * The dropdown genuinely changes the chart rather than being decoration, so
 * each range needs its own series. Derived from the base curve rather than
 * three hand-typed arrays: a longer range is the same shape sampled coarser
 * and scaled up, which is what a real cumulative series does.
 */
export function trendForRange(range: PreviewRange): PreviewPoint[] {
  if (range === 'This Month') return [...PREVIEW_TREND]

  const months =
    range === 'Last 3 Months'
      ? ['Mar', 'Apr', 'May']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Sample the base curve across the month count, scaled so a wider window
  // reads as a larger cumulative total.
  return months.map((month, index) => {
    // The `?? 0` is unreachable — the modulo keeps the index in range — but
    // the compiler cannot see that, and asserting past it would be a lie the
    // next person has to re-verify.
    const base = PREVIEW_TREND[(index * 3) % PREVIEW_TREND.length]?.applications ?? 0
    const growth = 1 + index * 0.12
    return { date: month, applications: Math.round(base * growth) }
  })
}
