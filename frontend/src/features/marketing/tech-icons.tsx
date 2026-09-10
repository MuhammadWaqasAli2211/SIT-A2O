/**
 * Technology logos for a programme's "Tools & technologies" card.
 *
 * The icons are Simple Icons SVGs vendored into `public/tech/` — see the
 * LICENCE note there for why they are vendored rather than installed, and for
 * the trademark position. This module is only the mapping and the renderer.
 *
 * Skills come from each programme's own `skills` array in site-data.ts, and
 * not every skill is a product with a logo: "REST APIs", "Wireframing" and
 * "User research" are practices, not tools. Those fall through to a neutral
 * glyph rather than being dropped, because the card is describing what the
 * programme covers and a silently missing entry would understate it.
 */

import { Boxes, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Skill label -> Simple Icons slug, for the skills that name a real product.
 *
 * Keyed by the exact string `PROGRAMS[].skills` uses, so a rename there is a
 * miss here rather than a silent mismatch. `HTML & CSS` is one skill covering
 * two technologies; it takes the HTML5 mark, since that is the one that reads
 * at tile size.
 */
const ICON_SLUG: Record<string, string> = {
  'HTML & CSS': 'html5',
  JavaScript: 'javascript',
  React: 'react',
  'React Native': 'react',
  'Node.js': 'nodedotjs',
  MongoDB: 'mongodb',
  Git: 'git',
  Flutter: 'flutter',
  Dart: 'dart',
  Python: 'python',
  Pandas: 'pandas',
  NumPy: 'numpy',
  'scikit-learn': 'scikitlearn',
  // The programmes teach SQL generally rather than one engine; the PostgreSQL
  // mark is the least brand-specific way to say "relational database".
  SQL: 'postgresql',
  Linux: 'linux',
  Docker: 'docker',
  Kubernetes: 'kubernetes',
  'CI/CD': 'githubactions',
  AWS: 'amazonwebservices',
  Monitoring: 'grafana',
  Figma: 'figma',
}

/** Shown for a skill that is a practice rather than a product. */
const FALLBACK: LucideIcon = Boxes

/**
 * One technology tile.
 *
 * Rendered as a CSS mask rather than an `<img>`: these SVGs carry no `fill`,
 * so as an image they paint solid black and stay black in dark mode. Masking
 * hands the colour to `background-color`, which can then be a theme token and
 * adapt to both themes.
 */
export function TechIcon({ skill, className }: { skill: string; className?: string }) {
  const slug = ICON_SLUG[skill]

  if (!slug) {
    const Icon = FALLBACK
    return <Icon className={cn('size-5', className)} aria-hidden="true" />
  }

  return (
    <span
      aria-hidden="true"
      className={cn('block size-5 bg-current', className)}
      style={{
        maskImage: `url(/tech/${slug}.svg)`,
        WebkitMaskImage: `url(/tech/${slug}.svg)`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}
