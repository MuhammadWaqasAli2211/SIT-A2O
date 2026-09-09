import {
  BarChart3,
  BrainCircuit,
  Building2,
  CalendarClock,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutDashboard,
  Mail,
  Radar,
  ShieldCheck,
  UserCircle,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import { UserRole } from '@/lib/types'

export interface PortalNavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Shown as a count chip on the right of the nav row. */
  badge?: string
  /**
   * Gate this item behind a condition beyond merely being signed in.
   *
   * 'application': having registered for a bootcamp. Signing up creates a
   * User; registering creates an Application. These pages describe an
   * Application, so before one exists there is nothing for them to show —
   * they render locked rather than as empty shells implying a pipeline the
   * user has not entered.
   *
   * 'onboarding': having cleared the Physical Interview stage. Student's
   * Folder describes onboarding paperwork, which does not exist to fill in
   * until the application has actually reached that stage.
   */
  requires?: 'application' | 'onboarding'
}

/** Shown on locked items, in the tooltip and to screen readers. */
export const LOCKED_HINT = 'Available after you register'

export const LOCKED_HINT_BY_REQUIRES: Record<'application' | 'onboarding', string> = {
  application: LOCKED_HINT,
  onboarding: 'Available once your Physical Interview is cleared',
}

export interface PortalNavGroup {
  heading: string
  items: PortalNavItem[]
}

const CANDIDATE_NAV: PortalNavGroup[] = [
  {
    heading: 'My application',
    items: [
      // Open to anyone with an account: the overview explains what to do next,
      // and the tracker explains the process in demo mode.
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Track application', href: '/dashboard/track', icon: Radar },

      // Everything below describes a submitted application.
      {
        label: 'Application',
        href: '/dashboard/application',
        icon: FileText,
        requires: 'application',
      },
      {
        label: 'Interview',
        href: '/dashboard/interview',
        icon: CalendarClock,
        requires: 'application',
      },
      {
        label: "Student's Folder",
        href: '/dashboard/documents',
        icon: GraduationCap,
        requires: 'onboarding',
      },
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
  { label: 'Candidates', href: '/admin/candidates', icon: UsersRound },
  { label: 'Interviews', href: '/admin/interviews', icon: CalendarClock },
  // Results from the external AI screening service. Separate from
  // 'Interviews' above, which schedules our own physical round — the two are
  // different rounds against different systems, so they get different rows.
  { label: 'AI interviews', href: '/admin/ai-interviews', icon: BrainCircuit },
  // Review of the 4 onboarding forms + Documents Hub uploads, per candidate.
  { label: 'Onboarding', href: '/admin/onboarding', icon: GraduationCap },
  // Layers, not ShieldCheck: ShieldCheck is already 'Administrators' in the
  // super-admin nav below, and a phase-gate control is not a permissions
  // control — the two rows read as the same concept under one icon.
  { label: 'Phases', href: '/admin/phases', icon: Layers },
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
      { label: 'AI permissions', href: '/super-admin/permissions', icon: KeyRound },
      { label: 'AI interviews', href: '/super-admin/ai-interviews', icon: BrainCircuit },
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
