/**
 * The navbar's search field.
 *
 * It genuinely searches. The reference design puts a "Search anything…" pill
 * in the header, and shipping that as a decorative input — a box that takes
 * text and does nothing — is worse than not having one: a visitor who types
 * into it and gets silence learns the site is broken, not that the feature is
 * unfinished.
 *
 * What it searches is everything the marketing site actually holds: the
 * programme catalogue and the navigable pages, both already in `site-data.ts`
 * as static data. So this is a client-side filter with no endpoint behind it —
 * there is no server-side search API and this does not pretend there is. It
 * deliberately does not reach into candidate or application data; nothing
 * behind sign-in is searchable from a public header.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CornerDownLeft,
  FileText,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { NAV_ITEMS, PROGRAMS } from '@/lib/site-data'
import { cn } from '@/lib/utils'

interface Hit {
  label: string
  hint: string
  href: string
  icon: LucideIcon
  /** Lowercased haystack, built once. */
  haystack: string
}

/**
 * Real destinations that are deliberately not in the header dropdowns.
 *
 * The legal pages belong in the footer, not the navbar — but somebody typing
 * "privacy" or "cnic" into the search box is looking for exactly them, and a
 * search that cannot find a page the site actually has is a search that
 * teaches people not to use it. Listed here rather than added to `NAV_ITEMS`,
 * which would put them in the header menus as a side effect.
 *
 * The haystacks carry the terms people search by rather than the page's own
 * title: nobody types "Privacy Policy" when what they want to know is what
 * happens to their CNIC.
 */
const EXTRA_PAGES: Hit[] = [
  {
    label: 'Privacy Policy',
    hint: 'What we collect, who sees it, and how long we keep it',
    href: '/privacy',
    icon: ShieldCheck,
    haystack:
      'privacy policy data protection cnic b-form photograph documents gdpr delete my data cookies third party supabase interviewerai recording',
  },
  {
    label: 'Terms of Service',
    hint: 'The rules for applying and taking part',
    href: '/terms',
    icon: FileText,
    haystack:
      'terms of service conditions rules eligibility deadlines fees conduct disqualification ai interview recording consent governing law',
  },
]

/**
 * The searchable index, built once at module load.
 *
 * Programmes carry their skills into the haystack, so "react" or "docker"
 * finds the track that teaches it even though neither word is in its title.
 */
const INDEX: Hit[] = [
  ...PROGRAMS.map((program) => ({
    label: program.title,
    hint: program.tagline,
    href: `/programs/${program.slug}`,
    icon: program.icon,
    haystack: [program.title, program.tagline, program.level, ...program.skills]
      .join(' ')
      .toLowerCase(),
  })),
  // Nav children are the page index: every destination the header offers,
  // flattened. Top-level items without an href are pure dropdown triggers and
  // have nothing to navigate to, so they contribute only their children.
  ...NAV_ITEMS.flatMap((item) =>
    (item.children ?? []).map((child) => ({
      label: child.label,
      hint: child.description,
      href: child.href,
      icon: child.icon,
      haystack: `${item.label} ${child.label} ${child.description}`.toLowerCase(),
    })),
  ),
  ...EXTRA_PAGES,
]

const MAX_HITS = 6

export function SiteSearch({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const hits = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length < 2) return []
    return INDEX.filter((hit) => hit.haystack.includes(needle)).slice(0, MAX_HITS)
  }, [query])

  /**
   * The highlighted row, clamped during render rather than reset from an
   * effect. Typing shrinks `hits` under a cursor that was valid a keystroke
   * ago; correcting that in an effect would render one frame pointing at a row
   * that is no longer there, then render again.
   */
  const active = hits.length === 0 ? -1 : Math.min(cursor, hits.length - 1)

  // A click anywhere else dismisses the panel. Pointerdown rather than click so
  // the panel is gone before the click lands on whatever was underneath it.
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as globalThis.Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const go = (hit: Hit) => {
    setQuery('')
    setOpen(false)
    navigate(hit.href)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!hits.length) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((active + 1) % hits.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((active - 1 + hits.length) % hits.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const hit = hits[active]
      if (hit) go(hit)
    }
  }

  const showPanel = open && query.trim().length >= 2

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border border-nav-shell-ink/15 bg-nav-shell-ink/8',
          'px-3.5 py-2 transition-colors focus-within:border-primary/50 focus-within:bg-nav-shell-ink/12',
        )}
      >
        <Search className="size-4 shrink-0 text-nav-shell-ink/50" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            // Reset the highlight here, at the event that invalidated it,
            // rather than in an effect reacting to the result.
            setCursor(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search anything..."
          aria-label="Search programmes and pages"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="site-search-results"
          className={cn(
            'w-full min-w-0 bg-transparent text-sm text-nav-shell-ink outline-none',
            'placeholder:text-nav-shell-ink/45',
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="shrink-0 text-nav-shell-ink/50 transition-colors hover:text-nav-shell-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          id="site-search-results"
          role="listbox"
          className={cn(
            'absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl',
            'border border-border bg-popover shadow-xl',
          )}
        >
          {hits.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-muted-foreground">
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {hits.map((hit, index) => (
                <li key={hit.href} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onClick={() => go(hit)}
                    onMouseEnter={() => setCursor(index)}
                    className={cn(
                      'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors',
                      index === active && 'bg-muted',
                    )}
                  >
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <hit.icon className="size-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{hit.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{hit.hint}</span>
                    </span>
                    {index === active && (
                      <CornerDownLeft className="mt-1.5 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
