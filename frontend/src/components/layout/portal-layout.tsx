import { AnimatePresence, motion } from 'motion/react'
import {
  Bell,
  ChevronsLeft,
  ClipboardPen,
  Home,
  LogOut,
  Lock,
  Menu,
  Radar,
  Search,
  TriangleAlert,
  UserCircle,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { PageTransition } from '@/components/motion/page-transition'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { UserAvatar } from '@/components/shared/user-avatar'
import {
  ApplicationProvider,
  useApplication,
} from '@/features/applications/application-context'
import { BRAND_ACCENT, BRAND_PRIMARY, BrandMark } from '@/features/marketing/brand'
import { useNotifications } from '@/features/notifications/use-notifications'
import {
  ProfilePictureProvider,
  useProfilePicture,
} from '@/features/profile/picture-context'
import { RegistrationClosedDialog } from '@/features/registration/registration-closed-dialog'
import { useAuth } from '@/hooks/use-auth'
import { relativeTime } from '@/lib/format'
import { LOCKED_HINT_BY_REQUIRES, navForRole, ROLE_LABEL, type PortalNavItem } from '@/lib/portal-nav'
import { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PortalLayout() {
  return (
    <ApplicationProvider>
      <ProfilePictureProvider>
        <TooltipProvider delay={120}>
          <PortalShell />
        </TooltipProvider>
      </ProfilePictureProvider>
    </ApplicationProvider>
  )
}

function PortalShell() {
  const { profile, logout } = useAuth()
  const { pictureUrl } = useProfilePicture()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [headerSearch, setHeaderSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  if (!profile) return null

  const groups = navForRole(profile.role)

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* ------------------------------------------------ desktop sidebar -- */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 232 }}
        transition={{ duration: 0.28, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-background lg:flex print:hidden"
      >
        <SidebarBody
          groups={groups}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </motion.aside>

      {/* ------------------------------------------------- mobile sidebar -- */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-background lg:hidden"
            >
              <SidebarBody groups={groups} collapsed={false} onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------- content -- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Dark shell, not `bg-background`. `--nav-shell` exists precisely
            for a bar that has to stay dark in *both* themes — the public
            marketing header already uses it, so the portal now reads as the
            same product rather than a plain white strip bolted underneath
            it. Controls inside are tinted off white-alpha rather than the
            neutral tokens, which would vanish against it. */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 bg-nav-shell px-3 text-nav-shell-ink shadow-lg shadow-black/10 sm:px-5 print:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/10 transition-colors hover:bg-white/20 lg:hidden"
          >
            <Menu className="size-4" />
          </button>

          {/* Staff only. This was previously an Input with no `value`, no
              `onChange` and no handler — decoration that typed but did
              nothing, shown to every role including candidates, who have a
              single application and nothing to search through. It is now a
              real jump-to-search for staff, and gone entirely for
              candidates rather than kept as a control that lies. */}
          {profile.role !== UserRole.CANDIDATE && (
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault()
                const term = headerSearch.trim()
                if (!term) return
                // Deliberately a jump, not a live filter: this sits in the
                // chrome above every screen, so it has no list of its own to
                // narrow. It hands the term to the Candidates screen, which
                // is the one built to search candidates and codes.
                navigate(`/admin/candidates?search=${encodeURIComponent(term)}`)
              }}
              className="relative hidden max-w-sm flex-1 sm:block"
            >
              <Search className="absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-nav-shell-ink/60" />
              <Input
                type="search"
                value={headerSearch}
                onChange={(event) => setHeaderSearch(event.target.value)}
                placeholder="Search candidates, codes..."
                aria-label="Search candidates"
                className="border-white/15 bg-white/10 pl-9 text-nav-shell-ink placeholder:text-nav-shell-ink/50 focus-visible:border-white/30 focus-visible:ring-white/20"
              />
            </form>
          )}

          <div className="ml-auto flex items-center gap-2">
            {profile.role === UserRole.CANDIDATE && <RegisterAction />}

            <Button
              render={<Link to="/" />}
              variant="ghost"
              size="sm"
              className="hidden text-nav-shell-ink hover:bg-white/10 hover:text-nav-shell-ink sm:inline-flex"
            >
              <Home className="size-4" />
              Website
            </Button>

            {/* Every signed-in role now has a notification source: candidates
                on stage change, admins when a candidate in their bootcamp
                completes an AI interview (2026-08-30). */}
            <NotificationBell />

            <ThemeToggle className="size-8 border-white/15 bg-white/10 text-nav-shell-ink hover:bg-white/20" />

            {/* The account menu is the one header control with enough moving
                parts to fail. A compact fallback keeps the header intact
                instead of dropping a card into a 4rem-tall bar. */}
            <ErrorBoundary
              fallback={
                <span className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs text-destructive">
                  <TriangleAlert className="size-3.5" />
                  Menu unavailable
                </span>
              }
            >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1 pr-3 pl-1 transition-colors hover:bg-white/20"
                  />
                }
              >
                <UserAvatar pictureUrl={pictureUrl} size="sm" />
                {/* Two forms, so the user is never anonymous. Below `sm`
                    the header has no room for a full name beside three
                    other controls — it showed nothing at all — so it falls
                    back to the first name; from `sm` up the whole name is
                    shown, ellipsised by CSS only if it genuinely does not
                    fit, with the full string on hover either way. */}
                <span
                  title={profile.full_name ?? profile.email}
                  className="max-w-[5.5rem] truncate text-[0.8125rem] font-medium sm:hidden"
                >
                  {profile.full_name?.split(' ')[0] ?? 'Account'}
                </span>
                <span
                  title={profile.full_name ?? profile.email}
                  className="hidden max-w-[11rem] truncate text-[0.8125rem] font-medium sm:inline"
                >
                  {profile.full_name ?? 'Account'}
                </span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-72 p-0">
                {/* Base UI requires GroupLabel to sit inside a Group — rendering
                    one loose throws MenuGroupContext is missing and takes the
                    whole portal down, since this menu is in every portal page. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0">
                    {/* An identity panel rather than a caption: the avatar is
                        the same one in the trigger, at a size worth looking
                        at, on a tinted ground that separates who you are from
                        what you can do. Tokens throughout, so both themes
                        follow without a second palette. */}
                    <span className="flex items-center gap-3 rounded-t-md border-b border-border bg-muted/50 px-3.5 py-3.5">
                      <UserAvatar pictureUrl={pictureUrl} size="default" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {profile.full_name ?? 'Account'}
                        </span>
                        {/* `break-all`: an email has no spaces to wrap at, and
                            a long one would otherwise widen the whole menu. */}
                        <span className="truncate text-xs font-normal break-all text-muted-foreground">
                          {profile.email}
                        </span>
                      </span>
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                {/* Two groups, separated: somewhere to go, and the one action
                    that ends the session. Signing out by mis-click is the only
                    real hazard in this menu, so it does not sit flush against
                    the thing above it. */}
                <DropdownMenuGroup className="p-1.5">
                  {/* /account, not /dashboard/profile — the latter is behind the
                      candidate role gate and bounced staff straight back out. */}
                  <DropdownMenuItem
                    render={<Link to="/account" />}
                    className="gap-2.5 rounded-md px-2.5 py-2"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <UserCircle className="size-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">Profile &amp; settings</span>
                      <span className="text-xs text-muted-foreground">
                        Your details and account
                      </span>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="my-0" />

                <DropdownMenuGroup className="p-1.5">
                  <DropdownMenuItem
                    onClick={() => void logout()}
                    variant="destructive"
                    className="gap-2.5 rounded-md px-2.5 py-2"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
                      <LogOut className="size-4" />
                    </span>
                    <span className="text-sm font-medium">Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            </ErrorBoundary>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-5 lg:px-6 print:p-[10mm]">
          <div className="mx-auto max-w-7xl">
            {/* Keyed on the path so a page that failed does not leave its
                fallback showing over every route the user visits next — the
                boundary remounts on navigation and drops the error with it. */}
            <ErrorBoundary key={location.pathname}>
              <PageTransition />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ register action -- */

/**
 * The header's primary candidate action, which is three different things
 * depending on state:
 *
 *   already applied            -> "View application", to the tracker
 *   no application, window shut -> "Register", opens the closed notice
 *   no application, window open -> "Register", to the form
 *
 * The two navigating cases render through `Link` so they stay real anchors —
 * middle-click and "open in new tab" work, and they are announced as links.
 * Only the case that opens a dialog is a button, because only that one has no
 * destination.
 *
 * Kept out of `PortalShell` so the dialog's open state lives beside the thing
 * that opens it rather than in the layout's own state.
 */
function RegisterAction() {
  const { openBootcamps, application, initialLoading } = useApplication()
  const [closedNotice, setClosedNotice] = useState(false)

  // Nothing is known until the *first* fetch settles; a disabled button for a
  // moment beats offering an action that turns out to be the wrong one. A
  // later refetch leaves the label alone rather than flickering it.
  if (initialLoading) {
    return (
      <Button size="sm" disabled>
        <ClipboardPen className="size-4" />
        Register
      </Button>
    )
  }

  // Re-registering for the same intake is refused server-side anyway
  // (`unique (bootcamp_id, profile_id)`), so pointing back at the form would
  // only walk them into a 409.
  if (application) {
    return (
      <Button render={<Link to="/dashboard/track" />} size="sm">
        <Radar className="size-4" />
        View application
      </Button>
    )
  }

  if (openBootcamps.length === 0) {
    return (
      <>
        <Button size="sm" onClick={() => setClosedNotice(true)}>
          <ClipboardPen className="size-4" />
          Register
        </Button>
        <RegistrationClosedDialog open={closedNotice} onOpenChange={setClosedNotice} />
      </>
    )
  }

  return (
    <Button render={<Link to="/dashboard/register" />} size="sm">
      <ClipboardPen className="size-4" />
      Register
    </Button>
  )
}

/* -------------------------------------------------------- notifications -- */

function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="relative grid size-8 place-items-center rounded-lg border border-white/15 bg-white/10 text-nav-shell-ink transition-colors hover:bg-white/20"
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-warning ring-2 ring-nav-shell" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between px-1.5 py-1">
            <DropdownMenuLabel className="p-0 text-sm font-medium">
              Notifications
            </DropdownMenuLabel>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nothing yet — you'll see updates here as things happen.
          </p>
        ) : (
          <DropdownMenuGroup>
            <div className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => !n.read && void markRead(n.id)}
                  className="flex-col items-start gap-0.5 whitespace-normal"
                >
                  <span className="flex w-full items-center gap-1.5">
                    {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    <span className={cn('text-sm font-medium', !n.read && 'text-foreground')}>
                      {n.title}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                  <span className="text-[0.68rem] text-muted-foreground/70">
                    {relativeTime(n.created_at)}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------------------------------------- nav row -- */

const ROW_BASE =
  'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors'

/**
 * One sidebar row, either navigable or locked.
 *
 * A locked row is not a disabled link — it is not a link at all. Rendering an
 * `<a>` that goes nowhere leaves it focusable, in the tab order, and openable
 * in a new tab, all of which promise something the row cannot deliver.
 */
function NavRow({ item, collapsed }: { item: PortalNavItem; collapsed: boolean }) {
  const { hasRegistered, hasClearedPhysicalInterview, loading } = useApplication()

  const unlocked =
    item.requires === 'application'
      ? hasRegistered
      : item.requires === 'onboarding'
        ? hasClearedPhysicalInterview
        : true

  // Locked while loading too. Flashing a row unlocked and then shutting it
  // reads as a bug; the reverse is just a row settling.
  if (item.requires && !unlocked) {
    const hint = LOCKED_HINT_BY_REQUIRES[item.requires]
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <div
              aria-disabled="true"
              className={cn(
                ROW_BASE,
                'cursor-not-allowed text-muted-foreground/45 select-none',
                collapsed && 'justify-center px-0',
              )}
            />
          }
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground/45">
            <item.icon className="size-4" />
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 whitespace-nowrap">{item.label}</span>
              {loading ? (
                <Skeleton className="size-3.5 rounded-full" />
              ) : (
                <Lock className="size-3.5 shrink-0" />
              )}
            </>
          )}
          <span className="sr-only">{hint}</span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {collapsed ? `${item.label} — ${hint}` : hint}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <NavLink
      to={item.href}
      end={item.href.split('/').length <= 2}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          ROW_BASE,
          isActive
            ? 'bg-primary/12 font-semibold text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="portal-nav-active"
              className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary"
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            />
          )}
          {/* Solid fill on the active chip, not a 15% tint. A tinted chip
              on a tinted row was two washes of the same colour and read as
              no chip at all; filling it makes the current page obvious
              from across the room, which is the whole job of this row. */}
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-lg transition-all duration-200',
              isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                : 'bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary',
            )}
          >
            <item.icon className="size-4" />
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 whitespace-nowrap">{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="text-[0.68rem]">
                  {item.badge}
                </Badge>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

/* --------------------------------------------------------------- sidebar -- */

function SidebarBody({
  groups,
  collapsed,
  onToggleCollapse,
  onClose,
}: {
  groups: ReturnType<typeof navForRole>
  collapsed: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
}) {
  const { profile } = useAuth()

  return (
    <>
      {/* Same `--nav-shell` as the content header, so the dark bar runs
          edge to edge across the top of the app instead of stopping at the
          sidebar's edge. */}
      <div className="flex h-14 items-center justify-between bg-nav-shell px-3 text-nav-shell-ink">
        <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
          {/* 44px tall inside the 56px bar, leaving 6px of clearance, so the
              bar's own height never has to change. Height only — the width is
              the artwork's own 1.09:1. No wrapper box or CSS rounding: the
              mark is transparent artwork carrying its own extruded depth and
              contact shadow, and a `rounded-*` + `overflow-hidden` wrapper
              would clip that shadow off. */}
          <span className="block h-11 w-auto shrink-0">
            <BrandMark />
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-none whitespace-nowrap">
              <span className="text-sm font-semibold tracking-tight">
                {/* Green, matching BrandLockup: the mark is a blue B flowing
                    into a green arrow, and the name splits the same way. */}
                {BRAND_PRIMARY} <span className="text-flow-500 dark:text-flow-600">{BRAND_ACCENT}</span>
              </span>
              <span className="text-[0.65rem] font-medium tracking-[0.14em] text-nav-shell-ink/60 uppercase">
                {profile ? ROLE_LABEL[profile.role] : 'Portal'}
              </span>
            </span>
          )}
        </Link>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-8 place-items-center rounded-lg transition-colors hover:bg-white/15"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto p-2.5 scrollbar-none">
        {groups.map((group) => (
          <div key={group.heading} className="flex flex-col gap-1">
            {!collapsed && (
              <h3 className="px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.heading}
              </h3>
            )}
            {group.items.map((item) => (
              <NavRow key={item.href} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      {onToggleCollapse && (
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            <ChevronsLeft
              className={cn('size-4 shrink-0 transition-transform duration-300', collapsed && 'rotate-180')}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </>
  )
}
