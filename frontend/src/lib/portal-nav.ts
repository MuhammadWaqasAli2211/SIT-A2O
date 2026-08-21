import {
  BarChart3,
  Building2,
  CalendarClock,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { UserRole } from '@/lib/types'

export interface PortalNavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Shown as a count chip on the right of the nav row. */
  badge?: string
}

export interface PortalNavGroup {
  heading: string
  items: PortalNavItem[]
}

const CANDIDATE_NAV: PortalNavGroup[] = [
  {
    heading: 'My application',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Application', href: '/dashboard/application', icon: FileText },
      { label: 'Interview', href: '/dashboard/interview', icon: CalendarClock },
      { label: 'Documents', href: '/dashboard/documents', icon: GraduationCap },
    ],
  },
  {
    // Shared with staff at the same path — one account screen, every role.
    heading: 'Account',
    items: [{ label: 'Profile', href: '/account', icon: UserCircle }],
  },
]

// Sidebar counts are deliberately absent: a number here would have to be
// refetched on every navigation to stay honest, and a stale one is worse
// than none.
//
// Shared between both staff navs so an admin and a super admin get the same
// per-bootcamp tools in the same order.
const BOOTCAMP_TOOLS: PortalNavItem[] = [
  { label: 'Candidates', href: '/admin/candidates', icon: Users },
  { label: 'Interviews', href: '/admin/interviews', icon: CalendarClock },
  { label: 'Documents', href: '/admin/documents', icon: FileText },
  { label: 'Phases', href: '/admin/phases', icon: ShieldCheck },
  { label: 'Emails', href: '/admin/emails', icon: Mail },
]

const ADMIN_NAV: PortalNavGroup[] = [
  {
    heading: 'Bootcamp',
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }, ...BOOTCAMP_TOOLS],
  },
  {
    heading: 'Account',
    items: [{ label: 'Profile', href: '/account', icon: UserCircle }],
  },
]

const SUPER_ADMIN_NAV: PortalNavGroup[] = [
  {
    heading: 'Platform',
    items: [
      { label: 'Overview', href: '/super-admin', icon: LayoutDashboard },
      { label: 'Analytics', href: '/super-admin/analytics', icon: BarChart3 },
      { label: 'Bootcamps', href: '/super-admin/bootcamps', icon: Building2 },
      { label: 'Administrators', href: '/super-admin/admins', icon: ShieldCheck },
      { label: 'Programs', href: '/super-admin/programs', icon: GraduationCap },
    ],
  },
  {
    // A super admin runs the same per-bootcamp tools an admin does; the
    // selected intake comes from the switcher on each screen.
    heading: 'Selected bootcamp',
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }, ...BOOTCAMP_TOOLS],
  },
  {
    heading: 'Account',
    items: [{ label: 'Profile', href: '/account', icon: UserCircle }],
  },
]

export function navForRole(role: UserRole): PortalNavGroup[] {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return SUPER_ADMIN_NAV
    case UserRole.ADMIN:
      return ADMIN_NAV
    default:
      return CANDIDATE_NAV
  }
}

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Bootcamp Admin',
  CANDIDATE: 'Candidate',
}
