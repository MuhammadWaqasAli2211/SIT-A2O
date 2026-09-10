/**
 * The programme hero's illustration.
 *
 * Original artwork rather than a stock photograph, for two reasons. The site
 * contains no photographs at all — `journey-scene`, `dashboard-preview` and
 * `application-flow-card` are all drawn — so a photo here would be the one
 * odd surface. And a drawn scene can take the programme's own accent
 * (`accentVar`), which means five programmes get five visibly different heroes
 * out of one component instead of five stock images that have to be sourced,
 * licensed and kept consistent.
 *
 * What it depicts is an editor window over a terminal — the thing every one
 * of these programmes actually puts you in front of — rather than a generic
 * "learning" metaphor. The code lines are decorative bars, not real syntax:
 * fake code that almost parses is more distracting than obviously abstract
 * bars, and it would go stale against the curriculum.
 *
 * `aria-hidden` throughout: the hero states the programme in text beside this,
 * so describing the drawing again to a screen reader adds noise, not meaning.
 */

import { cn } from '@/lib/utils'

/** Row widths, as a fraction of the editor body. Irregular on purpose —
 *  evenly stepped bars read as a chart, not as code. */
const CODE_ROWS = [
  { w: 0.52, indent: 0 },
  { w: 0.7, indent: 0.06 },
  { w: 0.4, indent: 0.12 },
  { w: 0.62, indent: 0.12 },
  { w: 0.34, indent: 0.06 },
  { w: 0.58, indent: 0 },
]

export function ProgramScene({
  accentVar,
  className,
}: {
  /** The programme's own `--track-*` reference, e.g. `var(--color-track-3)`. */
  accentVar: string
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative aspect-[4/3] w-full select-none', className)}
      style={{ '--scene-accent': accentVar } as React.CSSProperties}
    >
      {/* Ambient wash. Sits behind everything and carries the accent, so the
          whole scene shifts colour per programme without recolouring parts. */}
      <div
        className="absolute inset-0 rounded-[2rem] opacity-70 blur-2xl"
        style={{
          background:
            'radial-gradient(60% 60% at 30% 25%, color-mix(in srgb, var(--scene-accent) 45%, transparent), transparent 70%),' +
            'radial-gradient(55% 55% at 75% 80%, color-mix(in srgb, var(--color-flow-500) 35%, transparent), transparent 70%)',
        }}
      />

      {/* Editor window */}
      <div className="absolute inset-x-[6%] top-[8%] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl shadow-foreground/10">
        <div className="flex items-center gap-1.5 border-b border-border/70 bg-muted/50 px-3.5 py-2.5">
          <span className="size-2.5 rounded-full bg-destructive/60" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/60" />
          <span className="ml-2 h-1.5 w-20 rounded-full bg-border" />
        </div>

        <div className="flex flex-col gap-2.5 p-4 sm:p-5">
          {CODE_ROWS.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-1.5 w-3 shrink-0 rounded-full bg-border" />
              <span
                className="h-2 rounded-full"
                style={{
                  width: `${row.w * 100}%`,
                  marginInlineStart: `${row.indent * 100}%`,
                  // The first and fourth rows take the accent; the rest stay
                  // neutral. A fully accented block reads as a colour swatch
                  // rather than as code.
                  background:
                    i === 0 || i === 3
                      ? 'color-mix(in srgb, var(--scene-accent) 70%, transparent)'
                      : 'var(--color-muted)',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Terminal, tucked under the editor's bottom-right corner so the two
          overlap — a stack of panels reads as a workspace, two separated
          rectangles read as a diagram. */}
      <div className="absolute right-[2%] bottom-[4%] w-[58%] overflow-hidden rounded-xl border border-border/70 bg-nav-shell shadow-xl shadow-foreground/20">
        <div className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[0.7rem] leading-none font-bold"
              style={{ color: 'var(--color-flow-500)' }}
            >
              ▸
            </span>
            <span className="h-1.5 w-16 rounded-full bg-nav-shell-ink/50" />
          </div>
          <span className="h-1.5 w-24 rounded-full bg-nav-shell-ink/25" />
          <span className="h-1.5 w-12 rounded-full bg-nav-shell-ink/25" />
          <div className="flex items-center gap-1.5 pt-0.5">
            <span
              className="size-1.5 rounded-full"
              style={{ background: 'var(--color-flow-500)' }}
            />
            <span className="h-1.5 w-20 rounded-full bg-nav-shell-ink/40" />
          </div>
        </div>
      </div>
    </div>
  )
}
