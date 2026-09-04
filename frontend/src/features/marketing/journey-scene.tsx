/**
 * The "student life → professional life" transition panel.
 *
 * ## Original artwork
 *
 * Hand-authored SVG. Nothing here is traced from, derived from, or licensed
 * out of a stock library, and no generative image tool produced it. Both
 * figures are deliberately anonymous silhouettes — a head is a plain circle
 * with no features, no skin tone, no hair, no face — so the panel depicts a
 * *role* rather than a person. That is a hard requirement for a marketing
 * page: a rendered or photographed figure here would read as a real graduate
 * of this programme, and there is no such person to point at.
 *
 * Vector rather than a raster export so it recolours with the theme (both
 * palettes are token-driven), stays sharp at any density, and costs a few
 * kilobytes in the same request as the page rather than a separate download.
 *
 * ## Why the aspect ratio is fixed rather than the height
 *
 * The container carries `aspect-[1600/380]` and the SVG uses `meet`, so the
 * container's ratio always equals the viewBox's. That is the only arrangement
 * where the scene is neither cropped nor letterboxed at any viewport width.
 *
 * The obvious alternative — a fixed band height with `slice` — silently fails
 * on wide screens: `slice` scales to cover the width, so the wider the
 * viewport the more vertical crop a fixed height implies. At 2560px against a
 * 20rem band it would scale by 2.13 and show only ~150 of the 380 viewBox
 * units, cutting both figures off at the neck. Hence the 4.2:1 viewBox — a
 * band-shaped canvas the design is drawn to fit, rather than a squarer one
 * cropped down to a band.
 */

import { motion, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'

/** Ground line. Every figure and tower stands on it. */
const BASE = 380

export function JourneyScene({ className }: { className?: string }) {
  const reduce = useReducedMotion()

  return (
    // min-h floors the band on a phone, where 4.2:1 of a 375px viewport is
    // only ~89px and the scene degrades into a smear. Above the floor the
    // aspect governs; at the floor `meet` centres the scene and the surplus
    // reads as the hero's own ground, since the container is transparent.
    <div
      className={cn(
        'relative isolate aspect-[1600/380] min-h-36 w-full overflow-hidden',
        className,
      )}
    >
      <svg
        viewBox="0 0 1600 380"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        className="size-full"
      >
        <defs>
          {/* Ground: green at the student end, warming to gold at the
              professional end. */}
          <linearGradient id="js-ground" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.16" />
            <stop offset="50%" stopColor="var(--color-brand-500)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity="0.18" />
          </linearGradient>

          <linearGradient id="js-skyline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity="0.03" />
          </linearGradient>

          <linearGradient id="js-figure-left" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-600)" />
            <stop offset="100%" stopColor="var(--color-brand-500)" />
          </linearGradient>

          <linearGradient id="js-figure-right" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity="0.55" />
          </linearGradient>

          <radialGradient id="js-glow-green">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="js-glow-gold">
            <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="js-path" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-brand-500)" />
            <stop offset="100%" stopColor="var(--color-chart-3)" />
          </linearGradient>
        </defs>

        <rect width="1600" height={BASE} fill="url(#js-ground)" />

        {/* ------------------------------------------------------ skyline -- */}
        {/* Rects rather than one long path: each tower's x/width/height is
            independently readable and adjustable, where a single `h…v…` path
            hides an arithmetic chain that has to sum to exactly 1600. */}
        <g fill="url(#js-skyline)">
          {TOWERS.map(([x, width, top]) => (
            <rect key={x} x={x} y={top} width={width} height={BASE - top} />
          ))}
        </g>
        {/* Lit windows, so the towers read as a city at dusk. */}
        <g fill="var(--color-chart-3)" opacity="0.3">
          {WINDOWS.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="5" height="7" rx="1.5" />
          ))}
        </g>

        {/* --------------------------------------------------- left half -- */}
        <ellipse cx="330" cy="230" rx="250" ry="180" fill="url(#js-glow-green)" />

        {/* The archway the student is walking out of. Two concentric strokes
            so it reads as a lit portal rather than a flat outline. */}
        <path
          d="M215 352V232a115 115 0 0 1 230 0v120"
          fill="none"
          stroke="var(--color-brand-500)"
          strokeOpacity="0.4"
          strokeWidth="3"
        />
        <path
          d="M237 352V234a93 93 0 0 1 186 0v118"
          fill="none"
          stroke="var(--color-brand-300)"
          strokeOpacity="0.28"
          strokeWidth="2"
        />

        {/* Code motif: abstract bracket and line glyphs, not readable text. */}
        <g
          stroke="var(--color-brand-500)"
          strokeOpacity="0.42"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M150 168l-16 16 16 16" />
          <path d="M510 168l16 16-16 16" />
          <path d="M128 232h26M128 248h42M128 264h20" />
          <path d="M486 232h26M472 248h42M498 264h20" />
        </g>

        {/* Student, walking away: shoulders square to the viewer, backpack
            proud on both sides, legs mid-stride. */}
        <g fill="url(#js-figure-left)">
          <circle cx="330" cy="168" r="25" />
          <path d="M303 200h54a14 14 0 0 1 14 14v68a10 10 0 0 1-10 10h-62a10 10 0 0 1-10-10v-68a14 14 0 0 1 14-14Z" />
          <rect x="291" y="208" width="15" height="48" rx="7.5" opacity="0.7" />
          <rect x="354" y="208" width="15" height="48" rx="7.5" opacity="0.7" />
          <path d="M314 292h15l-4 60h-17Z" />
          <path d="M337 292h15l9 60h-17Z" />
        </g>

        {/* -------------------------------------------------- right half -- */}
        <ellipse cx="1270" cy="230" rx="250" ry="180" fill="url(#js-glow-gold)" />

        {/* Professional, facing the viewer: jacket over a collar V. Same
            anonymous head. */}
        <g fill="url(#js-figure-right)">
          <circle cx="1270" cy="164" r="25" />
          <path d="M1239 196h62a19 19 0 0 1 19 19v69a8 8 0 0 1-8 8h-84a8 8 0 0 1-8-8v-69a19 19 0 0 1 19-19Z" />
          <path d="M1249 292h17l-3 60h-18Z" />
          <path d="M1272 292h17l4 60h-18Z" />
        </g>
        {/* Shirt V and tie. The tie is the gold accent, which is what makes
            the silhouette read as suited rather than simply darker. */}
        <path d="M1270 196l-15 13 15 29 15-29Z" fill="var(--color-card)" opacity="0.92" />
        <path d="M1270 213l-7 8 7 25 7-25Z" fill="var(--color-chart-3)" />

        {/* --------------------------------------- the connecting path -- */}
        {/* The one line that makes this a transition rather than two separate
            portraits: it leaves the archway and arrives at the suited figure,
            changing colour as it crosses. */}
        <motion.path
          d="M470 360C640 360 700 322 800 322s160 38 330 38"
          fill="none"
          stroke="url(#js-path)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="10 12"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.8 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: reduce ? 0 : 1.4, ease: 'easeInOut' }}
        />
      </svg>

      {/* Labels as HTML rather than <text>, so they take the page's own font
          stack and sizing scale instead of needing SVG font plumbing. */}
      <span className="pointer-events-none absolute top-[10%] left-[6%] text-[0.6rem] font-bold tracking-[0.2em] text-primary/75 uppercase sm:text-xs">
        Student life
      </span>
      <span className="pointer-events-none absolute top-[10%] right-[6%] text-[0.6rem] font-bold tracking-[0.2em] text-chart-3 uppercase sm:text-xs">
        Professional life
      </span>
    </div>
  )
}

/**
 * The skyline, as [x, width, topY] triples spanning 0…1600.
 *
 * Widths are listed rather than derived so the row can be edited without
 * re-deriving every following x — and the last tower ending exactly at 1600 is
 * checkable by eye.
 */
const TOWERS: readonly [number, number, number][] = [
  [0, 70, 290], [70, 52, 252], [122, 44, 290], [166, 62, 226], [228, 48, 290],
  [276, 76, 202], [352, 55, 254], [407, 67, 206], [474, 45, 272], [519, 84, 182],
  [603, 57, 240], [660, 64, 206], [724, 50, 262], [774, 79, 196], [853, 52, 244],
  [905, 69, 214], [974, 48, 268], [1022, 74, 190], [1096, 60, 246], [1156, 67, 212],
  [1223, 43, 278], [1266, 64, 232], [1330, 72, 198], [1402, 49, 266], [1451, 96, 222],
  [1547, 53, 286],
]

/**
 * Lit windows, as [x, y] pairs.
 *
 * A fixed list rather than Math.random(): a random scatter would re-roll on
 * every re-render, which reads as the skyline flickering.
 */
const WINDOWS: readonly [number, number][] = [
  [86, 268], [96, 300], [180, 244], [196, 276], [290, 222], [306, 258],
  [322, 300], [366, 272], [420, 224], [436, 262], [530, 200], [548, 240],
  [566, 288], [582, 216], [674, 224], [690, 262], [706, 300], [788, 214],
  [804, 252], [820, 296], [916, 232], [932, 272], [1036, 208], [1052, 248],
  [1068, 292], [1112, 264], [1170, 230], [1186, 270], [1280, 250], [1296, 288],
  [1344, 216], [1360, 256], [1376, 300], [1466, 240], [1482, 280], [1498, 320],
]
