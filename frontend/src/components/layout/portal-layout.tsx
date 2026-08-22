import { AnimatePresence, motion } from 'motion/react'
import {
  Bell,
  ChevronsLeft,
  ClipboardPen,
  GraduationCap,
  Home,
  LogOut,
  Lock,
  Menu,
  Search,
  TriangleAlert,
  UserCircle,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

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
import {
  ApplicationProvider,
  useApplication,
} from '@/features/applications/application-context'
import { useAuth } from '@/hooks/use-auth'
import { LOCKED_HINT, navForRole, ROLE_LABEL, type PortalNavItem } from '@/lib/portal-nav'
import { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PortalLayout() {
  return (
    <ApplicationProvider>
      <TooltipProvider delay={120}>
        <PortalShell />
      </TooltipProvider>
    </ApplicationProvider>
  )
}

function PortalShell() {
  const { profile, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  if (!profile) return null

  const groups = navForRole(profile.role)
  const initials =
    profile.full_name
      ?.split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? profile.email[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* ------------------------------------------------ desktop sidebar -- */}
      <motion.aside
        animate={{ width: collapsed ? 78 : 264 }}
        transition={{ duration: 0.28, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-background lg:flex"
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border transition-colors hover:bg-muted lg:hidden"
          >
            <Menu className="size-4.5" />
          </button>

          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search candidates, codes..."
              aria-label="Search"
              className="pl-9"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Opens the bootcamp application form. Rendered through `Link`
                rather than a click handler calling navigate(), so it stays a
                real anchor: middle-click, ctrl-click and "open in new tab" all
                work, and it is announced as a link rather than a button. */}
            {profile.role === UserRole.CANDIDATE && (
              <Button render={<Link to="/dashboard/register" />} size="sm">
                <ClipboardPen className="size-4" />
                Register
              </Button>
            )}

            <Button render={<Link to="/" />} variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Home className="size-4" />
              Website
            </Button>

            <button
              type="button"
              aria-label="Notifications"
              className="relative grid size-9 place-items-center rounded-lg border border-border transition-colors hover:bg-muted"
            >
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
            </button>

            <ThemeToggle />

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
                    className="flex items-center gap-2 rounded-lg border border-border py-1 pr-2 pl-1 transition-colors hover:bg-muted"
                  />
                }
              >
                <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </span>
                <span className="hidden text-sm font-medium sm:inline">
                  {profile.full_name?.split(' ')[0] ?? 'Account'}
                </span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                {/* Base UI requires GroupLabel to sit inside a Group — rendering
                    one loose throws MenuGroupContext is missing and takes the
                    whole portal down, since this menu is in every portal page. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {profile.full_name ?? 'Account'}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {profile.email}
                      </span>
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {/* /account, not /dashboard/profile — the latter is behind the
                    candidate role gate and bounced staff straight back out. */}
                <DropdownMenuItem render={<Link to="/account" />}>
                  <UserCircle className="size-4" />
                  Profile & settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void logout()} variant="destructive">
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </ErrorBoundary>
          </div>
        </header>

        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-8">
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

/* -------------------------------------------------------------- nav row -- */

const ROW_BASE =
  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors'

/**
 * One sidebar row, either navigable or locked.
 *
 * A locked row is not a disabled link — it is not a link at all. Rendering an
 * `<a>` that goes nowhere leaves it focusable, in the tab order, and openable
 * in a new tab, all of which promise something the row cannot deliver.
 */
function NavRow({ item, collapsed }: { item: PortalNavItem; collapsed: boolean }) {
  const { hasRegistered, loading } = useApplication()

  const gated = item.requires === 'application'

  // Locked while loading too. Flashing a row unlocked and then shutting it
  // reads as a bug; the reverse is just a row settling.
  if (gated && !hasRegistered) {
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
          <item.icon className="size-4.5 shrink-0" />
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
          <span className="sr-only">{LOCKED_HINT}</span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {collapsed ? `${item.label} — ${LOCKED_HINT}` : LOCKED_HINT}
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
            ? 'bg-primary/10 text-primary'
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
          <item.icon className="size-4.5 shrink-0" />
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
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-none whitespace-nowrap">
              <span className="text-sm font-semibold tracking-tight">Saylani</span>
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
            className="grid size-8 place-items-center rounded-lg transition-colors hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-3 scrollbar-none">
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
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            <ChevronsLeft
              className={cn('size-4.5 shrink-0 transition-transform duration-300', collapsed && 'rotate-180')}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </>
  )
}
