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
    heading: 'Account',
    items: [{ label: 'Profile', href: '/dashboard/profile', icon: UserCircle }],
  },
]

const ADMIN_NAV: PortalNavGroup[] = [
  {
    heading: 'Bootcamp',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { label: 'Candidates', href: '/admin/candidates', icon: Users, badge: '441' },
      { label: 'Interviews', href: '/admin/interviews', icon: CalendarClock },
      { label: 'Phases', href: '/admin/phases', icon: ShieldCheck },
    ],
  },
  {
    heading: 'Communication',
    items: [{ label: 'Emails', href: '/admin/emails', icon: Mail, badge: '6' }],
  },
]

const SUPER_ADMIN_NAV: PortalNavGroup[] = [
  {
    heading: 'Overview',
    items: [
      { label: 'Dashboard', href: '/super-admin', icon: LayoutDashboard },
      { label: 'Analytics', href: '/super-admin/analytics', icon: BarChart3 },
    ],
  },
  {
    heading: 'Management',
    items: [
      { label: 'Bootcamps', href: '/super-admin/bootcamps', icon: Building2, badge: '5' },
      { label: 'Administrators', href: '/super-admin/admins', icon: ShieldCheck, badge: '4' },
    ],
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
