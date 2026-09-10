/**
 * The public site header.
 *
 * A solid --nav-shell bar rather than the transparent-over-hero treatment it
 * used to have. That token is dark in *both* themes deliberately (see
 * index.css), so every control inside reads on --nav-shell-ink and must not be
 * styled with --foreground, which inverts underneath it.
 *
 * The signed-in cluster on the right is real, not decorative: the bell shows a
 * candidate's actual unread count, and the user block shows the signed-in
 * profile. Signed out, both are replaced by Sign in / Apply now rather than
 * rendered as empty chrome.
 */

import { AnimatePresence, motion } from 'motion/react'
import { Bell, ChevronDown, LayoutDashboard, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { BrandLockup } from '@/features/marketing/brand'
import { SiteSearch } from '@/features/marketing/site-search'
import { useNotifications } from '@/features/notifications/use-notifications'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useScrolled } from '@/hooks/use-scrolled'
import { ROLE_LABEL } from '@/lib/portal-nav'
import { NAV_ITEMS, type NavItem } from '@/lib/site-data'
import { HOME_BY_ROLE, UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PublicHeader() {
  const scrolled = useScrolled(12)
  const location = useLocation()
  const { profile } = useAuth()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  // Any navigation closes whatever was open.
  useEffect(() => {
    setOpenMenu(null)
    setMobileOpen(false)
  }, [location.pathname, location.hash])

  // Prevent the page scrolling behind the mobile drawer.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpenMenu(null)
      setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A small grace period stops the panel flickering shut while the pointer
  // travels from the trigger down into the panel itself.
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 140)
  }
  const cancelClose = () => window.clearTimeout(closeTimer.current)

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 bg-nav-shell transition-shadow duration-300',
          scrolled && 'shadow-lg shadow-black/20',
        )}
      >
        {/* py-2, not py-3: the bar keeps its h-18, but trimming 4px of
            padding each side widens the content box from 48px to 56px, which
            is what lets the logo grow without the bar itself changing. */}
        <div className="mx-auto flex h-18 max-w-[100rem] items-center gap-4 px-4 py-2 sm:px-6 lg:px-8">
          <Link to="/" className="group shrink-0">
            <BrandLockup tone="shell" />
          </Link>

          {/* ------------------------------------------------ desktop nav -- */}
          <nav
            className="hidden items-center gap-0.5 xl:flex"
            onMouseLeave={scheduleClose}
          >
            {NAV_ITEMS.map((item) => (
              <DesktopNavItem
                key={item.label}
                item={item}
                isOpen={openMenu === item.label}
                onOpen={() => {
                  cancelClose()
                  setOpenMenu(item.label)
                }}
                onScheduleClose={scheduleClose}
              />
            ))}
          </nav>

          {/* Search takes the slack between the nav and the actions, so the
              bar stays balanced from `lg` all the way up to the max width. */}
          <SiteSearch className="ml-auto hidden w-full max-w-64 lg:block" />

          {/* `ml-auto` pushes the actions right when the search is hidden;
              from `lg` the search itself carries the auto margin, so this one
              is released or the two would fight over the same slack. */}
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <ThemeToggle className="border-nav-shell-ink/15 text-nav-shell-ink hover:bg-nav-shell-ink/10" />

            {profile && <NotificationBell />}

            {profile ? (
              <>
                <Button
                  render={<Link to={HOME_BY_ROLE[profile.role]} />}
                  size="sm"
                  className="hidden rounded-full sm:inline-flex"
                >
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </Button>
                <UserBlock />
              </>
            ) : (
              <>
                <Button
                  render={<Link to="/login" />}
                  variant="ghost"
                  size="sm"
                  className="hidden rounded-full text-nav-shell-ink hover:bg-nav-shell-ink/10 hover:text-nav-shell-ink sm:inline-flex"
                >
                  Sign in
                </Button>
                <Button
                  render={<Link to="/signup" />}
                  size="sm"
                  className="hidden rounded-full sm:inline-flex"
                >
                  Apply now
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="grid size-9 place-items-center rounded-lg border border-nav-shell-ink/15 text-nav-shell-ink transition-colors hover:bg-nav-shell-ink/10 xl:hidden"
            >
              {mobileOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
            </button>
          </div>
        </div>

        {/* Full-width dropdown panel, shared by every nav item. */}
        <AnimatePresence>
          {openMenu && (
            <MegaPanel
              item={NAV_ITEMS.find((i) => i.label === openMenu)!}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            />
          )}
        </AnimatePresence>
      </header>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}

/* ------------------------------------------------------------- desktop -- */

function DesktopNavItem({
  item,
  isOpen,
  onOpen,
  onScheduleClose,
}: {
  item: NavItem
  isOpen: boolean
  onOpen: () => void
  onScheduleClose: () => void
}) {
  const Icon = item.icon

  if (!item.children) {
    return (
      <NavLink
        to={item.href!}
        onMouseEnter={onScheduleClose}
        className={({ isActive }) =>
          cn(
            'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'text-primary' : 'text-nav-shell-ink/80 hover:text-nav-shell-ink',
          )
        }
      >
        {Icon && <Icon className="size-4 shrink-0" />}
        {item.label}
      </NavLink>
    )
  }

  return (
    <button
      type="button"
      onMouseEnter={onOpen}
      onFocus={onOpen}
      onClick={onOpen}
      aria-expanded={isOpen}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isOpen ? 'text-primary' : 'text-nav-shell-ink/80 hover:text-nav-shell-ink',
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      {item.label}
      <ChevronDown
        className={cn('size-3.5 transition-transform duration-250', isOpen && 'rotate-180')}
      />
    </button>
  )
}

/* ------------------------------------------------------ signed-in cluster -- */

/**
 * Unread count for the signed-in candidate.
 *
 * Candidate-only because that is the only role with a notification source —
 * `/notifications` is candidate-scoped, and polling it as an admin would fetch
 * an empty list every 30 seconds forever. Admins get no bell rather than a
 * bell that is permanently zero.
 */
function NotificationBell() {
  const { profile } = useAuth()
  const isCandidate = profile?.role === UserRole.CANDIDATE
  const { unreadCount } = useNotifications({ enabled: isCandidate })

  if (!isCandidate) return null

  return (
    <Link
      to="/dashboard"
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      className="relative hidden size-9 place-items-center rounded-lg border border-nav-shell-ink/15 text-nav-shell-ink transition-colors hover:bg-nav-shell-ink/10 sm:grid"
    >
      <Bell className="size-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold text-destructive-foreground">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}

/** Avatar, name and role for the signed-in user. */
function UserBlock() {
  const { profile } = useAuth()
  if (!profile) return null

  const name = profile.full_name?.trim() || profile.email
  // Initials from the name, capped at two so a four-part name still fits.
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'

  return (
    <Link
      to={HOME_BY_ROLE[profile.role]}
      className="hidden items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-nav-shell-ink/10 xl:flex"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/20 text-[0.7rem] font-bold text-primary">
        {initials}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="max-w-32 truncate text-[0.8rem] font-semibold text-nav-shell-ink">
          {name}
        </span>
        <span className="text-[0.65rem] text-nav-shell-ink/60">{ROLE_LABEL[profile.role]}</span>
      </span>
      <ChevronDown className="size-3.5 shrink-0 text-nav-shell-ink/60" />
    </Link>
  )
}

function MegaPanel({
  item,
  onMouseEnter,
  onMouseLeave,
}: {
  item: NavItem
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <motion.div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="absolute inset-x-0 top-full hidden border-b border-border/70 bg-background/95 backdrop-blur-xl xl:block"
    >
      <div className="mx-auto max-w-[100rem] px-4 py-7 sm:px-6 lg:px-8">
        <div
          className={cn(
            'grid gap-2',
            item.featured ? 'grid-cols-3' : 'grid-cols-2 lg:max-w-4xl',
          )}
        >
          {item.children!.map((child, index) => (
            <motion.div
              key={child.href}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * index, duration: 0.25 }}
            >
              <Link
                to={child.href}
                className="group flex gap-3 rounded-xl p-3 transition-colors hover:bg-muted"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <child.icon className="size-4.5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{child.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {child.description}
                  </span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------- mobile -- */

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth()
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm xl:hidden"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[min(22rem,88vw)] flex-col overflow-y-auto border-l border-border bg-background pt-20 pb-8 xl:hidden"
          >
            <nav className="flex flex-col gap-1 px-4">
              {NAV_ITEMS.map((item) =>
                item.children ? (
                  <div key={item.label} className="border-b border-border/60 py-1">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                      aria-expanded={expanded === item.label}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-medium"
                    >
                      {item.label}
                      <ChevronDown
                        className={cn(
                          'size-4 text-muted-foreground transition-transform duration-250',
                          expanded === item.label && 'rotate-180',
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {expanded === item.label && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-0.5 pb-2 pl-3">
                            {item.children.map((child) => (
                              <Link
                                key={child.href}
                                to={child.href}
                                onClick={onClose}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <child.icon className="size-4 shrink-0 text-primary" />
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    key={item.label}
                    to={item.href!}
                    onClick={onClose}
                    className="border-b border-border/60 px-3 py-4 text-sm font-medium"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>

            <div className="mt-6 flex flex-col gap-2 px-4">
              {profile ? (
                <Button render={<Link to={HOME_BY_ROLE[profile.role]} />} className="w-full">
                  <LayoutDashboard className="size-4" />
                  Go to dashboard
                </Button>
              ) : (
                <>
                  <Button render={<Link to="/signup" />} className="w-full">
                    Apply now
                  </Button>
                  <Button render={<Link to="/login" />} variant="outline" className="w-full">
                    Sign in
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
