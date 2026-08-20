/**
 * Shared Recharts styling.
 *
 * Recharts renders tooltips as inline-styled DOM rather than Tailwind classes,
 * so the theme tokens have to be handed to it explicitly. Centralising the
 * object keeps every chart in the app visually consistent and theme-aware.
 */

export const chartTooltipStyle = {
  contentStyle: {
    background: 'var(--color-popover)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.625rem',
    fontSize: '0.8125rem',
    boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.18)',
    color: 'var(--color-popover-foreground)',
  },
  labelStyle: {
    color: 'var(--color-foreground)',
    fontWeight: 500,
    marginBottom: '0.25rem',
  },
  itemStyle: {
    color: 'var(--color-muted-foreground)',
  },
} as const

export const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const
