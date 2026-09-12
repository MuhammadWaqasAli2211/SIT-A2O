/**
 * The one loader in this app.
 *
 * Whatever is being waited for — a route's chunk, a table's rows, a card's
 * figures — it is this component at a different size. That is the point: two
 * different loading treatments make an app feel like two apps stitched
 * together, and the user should never have to learn that a grey box and a
 * spinner mean the same thing.
 *
 * ## The motion
 *
 * Three complete rings, each its own distinct 3D tilt, crossing through one
 * another like three hoops held at different angles around a common centre
 * — and each ring's ellipse is completely static. What moves is a short
 * glowing comet travelling around each fixed path, never the path itself.
 *
 * Three mechanisms were tried before this one, each wrong in a different,
 * specific way:
 *
 * 1. A static SVG ellipse per shell, the whole shape rotated as one rigid
 *    piece — visually a spinning bracket, never a real orbit, and SVG's flat
 *    coordinate system meant the three "shells" were the same ellipse at
 *    three different *planar* rotations, never actually tilted in 3D.
 * 2. A single point (plus a long fading trail of copies behind it) revolving
 *    on each tilted plane. Real 3D motion, but the wrong picture: a comet
 *    made of discrete copies reads as one ring with a gradient of colour
 *    along it, not as three independent, fully-drawn loops.
 * 3. Three whole rings, correctly tilted and crossing — but each ring's
 *    entire ellipse was spun as one rigid piece (the *tilt* animated, via an
 *    outer `rotate()` composed in before the static tilt). That produced
 *    real, visible motion, but the wrong motion: the reference shows fixed
 *    racetracks with light travelling on them, not hoops physically
 *    tumbling. Every ring's outline was moving when it should never move at
 *    all.
 *
 * This version keeps attempt 3's shapes (three rings, three distinct tilts,
 * genuinely crossing) but replaces *what animates*. Each ring is drawn once
 * as a static SVG `<circle>` inside a container with a fixed — never
 * animated — 3D tilt. A `stroke-dasharray` splits its stroke into a short
 * lit comet and a long invisible gap; only `stroke-dashoffset` animates,
 * which slides that dash pattern along the path without moving the path
 * itself, the same racetrack-with-a-moving-light technique already used by
 * `.brand-spin-dash` in index.css. Each circle sets `pathLength="100"`,
 * which normalises `stroke-dasharray`/`stroke-dashoffset` to 0-100 units
 * regardless of that ring's actual pixel radius, so one pair of keyframes
 * (`page-ring-cw`/`page-ring-ccw` in index.css) covers every ring at every
 * size. Structure, outside in:
 *
 *   .stage  — perspective: establishes the 3D camera distance
 *     .ring — a STATIC rotateX/rotateY tilt, own per ring, never animated,
 *             transform-style: preserve-3d so the circle inside projects in
 *             3D as a tilted ellipse that never itself moves
 *       <svg><circle>  — the fixed racetrack; only its stroke-dashoffset
 *             animates (`page-ring-a/b/c` in index.css), sliding a
 *             comet-length dash around a path that stays put
 *
 * Plain HTML/CSS 3D transforms (not SVG transforms) still do the tilting,
 * for the same reason as before: `transform-style: preserve-3d` and
 * `perspective` are the standard way to get real, browser-computed 3D
 * projection, and are far more consistent on ordinary elements than on
 * nested SVG `<g>`s. The SVG here only draws the stroke; it is not asked to
 * do the 3D.
 *
 * Colours are the brand's blue-to-green flow — `--primary`, `--info`,
 * `--flow-500` — not literals, which is what makes one set of markup correct
 * in both themes: those tokens already carry light and dark values.
 *
 * No text. The motion is the message, and centred text sat on top of three
 * moving shapes was never legible against them.
 *
 * CSS animation, not Framer Motion. This renders inside Suspense
 * fallbacks — exactly the moment a lazily-loaded chunk, the motion runtime
 * included, may not have arrived — and it mounts and unmounts constantly
 * inside data-fetch states. A loader that needs JS to appear is missing
 * precisely when it is needed, and CSS animations restart cleanly on every
 * mount with no state to carry.
 */

import { cn } from '@/lib/utils'

export type LoaderSize = 'sm' | 'md' | 'lg'

/** Ring box (in both a Tailwind class and its raw px, see below), the
 *  vertical room the surrounding block reserves, and the 3D camera
 *  distance — kept proportional to the box so the tilt reads the same at
 *  every size instead of flattening out at 128px or over-warping at 48px.
 *
 *  `perspective` is roughly 8-9x the box, which keeps the tilt genuinely
 *  three-dimensional without collapsing it. */
const SIZE: Record<LoaderSize, { box: string; boxPx: number; block: string; perspective: number }> = {
  /** Inside a card or a small panel. */
  sm: { box: 'size-12', boxPx: 48, block: 'min-h-28', perspective: 420 },
  /** The default for a section waiting on its data. */
  md: { box: 'size-20', boxPx: 80, block: 'min-h-[18rem]', perspective: 700 },
  /** A whole view: a route's chunk, or the pre-shell auth check. */
  lg: { box: 'size-32', boxPx: 128, block: 'min-h-[60vh]', perspective: 1100 },
}

/**
 * One ring: a fixed 3D tilt that never animates, a diameter (as a fraction
 * of the box), a colour, and the existing spin timing class (`page-ring-a/
 * b/c`) — now driving `stroke-dashoffset` in index.css rather than a
 * transform, so the reduced-motion override and the independent,
 * non-harmonic durations already there keep applying unchanged.
 *
 * Tilts deliberately combine both X and Y per ring, each a different
 * combination, so the three ellipses visibly cross rather than sitting as
 * near-parallel planes.
 *
 * Every ring is `inset-0` on the same stage and rotates about its own centre,
 * so all three centres are the same point by construction — there is no
 * per-ring position to drift. An earlier revision slid one ring sideways to
 * separate it from another; that treated the symptom. Two rings look
 * conjoined when their projected *major axes* nearly coincide, and moving one
 * of them off-centre only breaks the atom's shared-centre geometry while
 * leaving the near-parallel angles that caused it.
 *
 * What actually keeps them legible is even angular spacing. Measured from
 * these tilts (projected through the same perspective the browser applies),
 * the major axes land at: purple 167.2deg, cyan 48.3deg, green 109.2deg —
 * spacings of 61.1 / 60.9 / 58.1, near enough the ideal 60/60/60. Purple and
 * green are fixed at 58.1deg apart, so cyan bisects the remaining 121.9deg
 * gap, which is the most even arrangement available without moving them.
 * Cyan's `rotateX` is set from the mean of the other two rings' foreshortening
 * so it reads as one of a set rather than a flatter or rounder odd one out.
 */
const RINGS = [
  { spin: 'page-ring-a', tilt: 'rotateX(62deg) rotateY(-12deg)', diameterFraction: 0.92, color: 'var(--primary)' },
  { spin: 'page-ring-b', tilt: 'rotateZ(-132.6deg) rotateX(60.6deg)', diameterFraction: 0.98, color: 'var(--info)' },
  { spin: 'page-ring-c', tilt: 'rotateX(28deg) rotateY(-52deg) rotateZ(20deg)', diameterFraction: 1, color: 'var(--flow-500)' },
] as const

/** Of the normalised 0-100 `pathLength`, how much of the circle is lit at
 *  once. A short ~24-unit comet read as a tick mark rather than a trail —
 *  generous but not full: ~75% keeps a clear dark gap so the motion (and
 *  the fact that this is a ring, not a closed disc) stays legible, while
 *  giving the glowing arc real visual weight. `stroke-linecap="round"`
 *  below softens both ends of that arc into a taper rather than a hard
 *  cut, which combined with the blur filter is what reads as a trail
 *  fading out rather than a stroke that just stops. */
const DASH_LENGTH = 75

function Ring({
  spin,
  tilt,
  diameterPx,
  borderPx,
  color,
}: {
  spin: string
  tilt: string
  diameterPx: number
  borderPx: number
  color: string
}) {
  const r = diameterPx / 2 - borderPx
  return (
    <div
      className="absolute inset-0"
      style={{ transform: tilt, transformStyle: 'preserve-3d' }}
    >
      {/* The racetrack: position and size are the only things set here, and
          neither one is ever touched by an animation — that is what keeps
          the ellipse itself completely still. Centred in real pixels for
          the same reason the earlier point-based radius had to be:
          percentages on a transformed/positioned element resolve against
          the wrong box far too easily to trust here. */}
      <svg
        width={diameterPx}
        height={diameterPx}
        className="absolute overflow-visible"
        style={{ top: '50%', left: '50%', marginTop: -diameterPx / 2, marginLeft: -diameterPx / 2 }}
      >
        <circle
          cx={diameterPx / 2}
          cy={diameterPx / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={borderPx}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${DASH_LENGTH} ${100 - DASH_LENGTH}`}
          /* `motion-essential` exempts this from the global reduced-motion
             reset in index.css. That reset lives in `@layer base` and uses
             `!important`, and cascade layers invert for important
             declarations — so it can only be escaped by not matching the
             selector, never overridden from outside the layer. Without it
             the dashoffset animation never runs and every ring shows a
             static, motionless arc instead of a travelling comet. */
          className={cn(spin, 'motion-essential')}
          style={{ filter: `drop-shadow(0 0 ${borderPx * 1.6}px ${color})` }}
        />
      </svg>
    </div>
  )
}

export function AppLoader({
  size = 'md',
  className,
  label = 'Loading',
  fullScreen = false,
  bare = false,
}: {
  size?: LoaderSize
  className?: string
  /** Announced to screen readers. Never drawn — see the note above. */
  label?: string
  /** Covers the viewport, for the pre-shell auth check only. */
  fullScreen?: boolean
  /** Just the atom, with no centring block — for a caller that owns its own
   *  layout and only wants the mark. */
  bare?: boolean
}) {
  const { box, boxPx, block, perspective } = SIZE[size]
  // A thin, sharp line at every size rather than a fixed pixel count — thick
  // enough to read as a ring, thin enough not to blur into a solid disc once
  // the glow is added.
  const borderPx = Math.max(1.5, boxPx * 0.022)

  const atom = (
    /* One camera for all three rings, and every ring `inset-0` within it, so
       they share a single centre and a single viewpoint. */
    <div
      className={cn('relative', box, className)}
      style={{ perspective: `${perspective}px` }}
      aria-hidden="true"
    >
      {RINGS.map(({ diameterFraction, ...ring }) => (
        <Ring key={ring.spin} diameterPx={diameterFraction * boxPx} borderPx={borderPx} {...ring} />
      ))}
    </div>
  )

  if (bare) return atom

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        'grid w-full place-items-center',
        fullScreen ? 'min-h-screen bg-background' : block,
      )}
    >
      {atom}
    </div>
  )
}
