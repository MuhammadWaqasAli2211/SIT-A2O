import { AnimatePresence, motion } from 'motion/react'
import {
  Bell,
  ChevronsLeft,
  ClipboardPen,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  UserCircle,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

import { PageTransition } from '@/components/motion/page-transition'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { navForRole, ROLE_LABEL } from '@/lib/portal-nav'
import { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PortalLayout() {
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
            {/* Registration opens in Phase 2; present but inert for now. */}
            {profile.role === UserRole.CANDIDATE && (
              <Button
                size="sm"
                onClick={() =>
                  toast('Registration opens soon', {
                    description:
                      'Bootcamp applications are not open yet. You will be emailed when registration begins.',
                  })
                }
              >
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
                <DropdownMenuLabel>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{profile.full_name ?? 'Account'}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {profile.email}
                    </span>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link to="/dashboard/profile" />}>
                  <UserCircle className="size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void logout()} variant="destructive">
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <PageTransition />
          </div>
        </main>
      </div>
    </div>
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
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href.split('/').length <= 2}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
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
