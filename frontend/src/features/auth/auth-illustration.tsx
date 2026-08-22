import { cn } from '@/lib/utils'

/**
 * The brand pane's illustration: the bootcamp journey as a rising path.
 *
 * Original flat line-art, drawn around the idea the product is built on — a
 * candidate starts at a laptop, works through the phases, and finishes as a
 * graduate. Three risers, three figures, left to right.
 *
 * Inline SVG rather than an asset on purpose:
 *
 * - it costs no network request and cannot flash in late,
 * - it is crisp at any size, and
 * - every colour is a theme token, so light and dark are the same markup. A
 *   PNG would need two exports and would still be wrong the next time the
 *   brand colour moved.
 *
 * Figures are built from filled shapes rather than plain strokes. A head and
 * four lines reads as a stick figure — fine for a whiteboard, too crude to
 * put on a sign-in screen.
 */
export function AuthIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 300"
      fill="none"
      className={cn('h-auto w-full', className)}
      // Bleeds off the pane's right and bottom, so the lower-left of the
      // scene is what must survive an awkward aspect ratio.
      preserveAspectRatio="xMinYMax meet"
      role="img"
      aria-label="Illustration of students progressing from their first class to graduation"
    >
      {/* Local palette. Three tones plus line work — past that, flat line-art
          starts to look like clip art. */}
      <g
        style={
          {
            '--ink': 'var(--auth-pane-ink)',
            '--gold': 'var(--chart-3)',
            '--riser': 'color-mix(in oklch, var(--auth-pane), black 26%)',
            '--riser-top': 'color-mix(in oklch, var(--auth-pane), white 10%)',
          } as React.CSSProperties
        }
      >
        {/* ---------------------------------------------------- backdrop -- */}
        <circle cx="252" cy="146" r="120" stroke="var(--ink)" strokeOpacity="0.14" strokeWidth="1.5" />
        <circle cx="252" cy="146" r="88" stroke="var(--ink)" strokeOpacity="0.09" strokeWidth="1.5" />

        {/* ------------------------------------------------------ risers -- */}
        <g>
          <rect x="40" y="230" width="98" height="52" rx="5" fill="var(--riser)" fillOpacity="0.55" />
          <rect x="151" y="194" width="98" height="88" rx="5" fill="var(--riser)" fillOpacity="0.72" />
          <rect x="262" y="152" width="98" height="130" rx="5" fill="var(--riser)" fillOpacity="0.88" />
          {/* Top faces — the single highlight that turns a rectangle into a step. */}
          <rect x="40" y="230" width="98" height="4" rx="2" fill="var(--riser-top)" />
          <rect x="151" y="194" width="98" height="4" rx="2" fill="var(--riser-top)" />
          <rect x="262" y="152" width="98" height="4" rx="2" fill="var(--riser-top)" />
        </g>

        {/* ------------------------------------- 1 · first class, at a desk -- */}
        <g>
          {/* desk */}
          <rect x="56" y="212" width="66" height="3.5" rx="1.75" fill="var(--ink)" opacity="0.9" />
          <rect x="62" y="215" width="3" height="15" rx="1.5" fill="var(--ink)" opacity="0.5" />
          <rect x="113" y="215" width="3" height="15" rx="1.5" fill="var(--ink)" opacity="0.5" />
          {/* laptop: lid and base */}
          <path d="M84 212v-14a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v14" fill="var(--ink)" fillOpacity="0.28" stroke="var(--ink)" strokeWidth="2.6" strokeLinejoin="round" />
          {/* seated student */}
          <circle cx="70" cy="184" r="8.5" fill="var(--ink)" />
          <path d="M59 212v-9a11 11 0 0 1 22 0v9Z" fill="var(--ink)" />
          {/* arm reaching to the keyboard */}
          <path d="M79 202h9" stroke="var(--ink)" strokeWidth="4.5" strokeLinecap="round" />
        </g>

        {/* ------------------------------------- 2 · mid-course, at a board -- */}
        <g>
          {/* board */}
          <rect x="152" y="112" width="52" height="38" rx="4" fill="var(--ink)" fillOpacity="0.16" stroke="var(--ink)" strokeWidth="2.4" />
          <path d="M161 124h20M161 132h30M161 140h14" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.85" />
          {/* standing student, one arm up to the board */}
          <circle cx="216" cy="152" r="9" fill="var(--ink)" />
          <path d="M205 194v-27a11 11 0 0 1 22 0v27Z" fill="var(--ink)" />
          <path d="M209 170l-10-14" stroke="var(--ink)" strokeWidth="4.8" strokeLinecap="round" />
          <path d="M224 172l9 7" stroke="var(--ink)" strokeWidth="4.8" strokeLinecap="round" />
        </g>

        {/* ------------------------------------------- 3 · the graduate -- */}
        <g>
          {/* gown: a widening silhouette, which is what makes it read as a
              graduate rather than another standing figure */}
          <path d="M293 152l9-38a9 9 0 0 1 18 0l9 38Z" fill="var(--ink)" />
          <circle cx="311" cy="103" r="9.5" fill="var(--ink)" />
          {/* arm raised, holding the cap aloft */}
          <path d="M320 122l14-16" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
          <path d="M301 124l-11 12" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
          {/* stole, in the accent tone */}
          <path d="M304 114l4 26M318 114l-4 26" stroke="var(--gold)" strokeWidth="3.2" strokeLinecap="round" />
        </g>

        {/* mortarboard, thrown up — the moment the whole pipeline is for */}
        <g transform="rotate(-12 344 96)">
          <path d="M326 96l18-7.5L362 96l-18 7.5Z" fill="var(--gold)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M333 99v7c0 2.6 5 4.4 11 4.4s11-1.8 11-4.4v-7" fill="var(--gold)" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M362 96v10" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="362" cy="108" r="2.6" fill="var(--ink)" />
        </g>

        {/* --------------------------------------------------- the climb -- */}
        {/* Drawn after the risers so it sits over them rather than being cut. */}
        {/* Starts clear of the desk — begun any further left and the first
            milestone pip lands on top of the laptop. */}
        <path
          d="M130 212c18-4 30-14 42-34s24-42 38-67"
          stroke="var(--gold)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="1 9"
        />
        <circle cx="130" cy="212" r="4.2" fill="var(--gold)" />
        <circle cx="172" cy="178" r="4.2" fill="var(--gold)" />
        <circle cx="210" cy="111" r="4.2" fill="var(--gold)" />

        {/* Ground: fades at both ends so the scene sits in space, not on a
            hard edge that would fight the pane's rounded corner. */}
        <defs>
          <linearGradient id="auth-ground" x1="0" x2="1">
            <stop offset="0" stopColor="var(--ink)" stopOpacity="0" />
            <stop offset="0.25" stopColor="var(--ink)" stopOpacity="0.34" />
            <stop offset="1" stopColor="var(--ink)" stopOpacity="0.34" />
          </linearGradient>
        </defs>
        <path d="M8 282h404" stroke="url(#auth-ground)" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
