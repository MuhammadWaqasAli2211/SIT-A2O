import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { PortalLayout } from '@/components/layout/portal-layout'
import { PublicLayout } from '@/components/layout/public-layout'
import HomePage from '@/pages/public/home-page'
import LoginPage from '@/pages/auth/login-page'
import SignupPage from '@/pages/auth/signup-page'
import NotFoundPage from '@/pages/not-found-page'
import { GuestRoute, ProtectedRoute, RoleRoute } from '@/routes/guards'
import { UserRole } from '@/lib/types'

/**
 * Everything except the landing page and auth is lazy-loaded.
 *
 * Recharts alone is a few hundred kilobytes and is only ever used by the admin
 * and super-admin dashboards — a candidate should never download it. Splitting
 * here keeps the first paint small for the page most visitors actually land on.
 */
const ProgramsPage = lazy(() => import('@/pages/public/programs-page'))
const ProgramDetailPage = lazy(() => import('@/pages/public/program-detail-page'))
const AdmissionsPage = lazy(() => import('@/pages/public/admissions-page'))
const AboutPage = lazy(() => import('@/pages/public/about-page'))
const SuccessStoriesPage = lazy(() => import('@/pages/public/success-stories-page'))
const FaqPage = lazy(() => import('@/pages/public/faq-page'))
const ContactPage = lazy(() => import('@/pages/public/contact-page'))

const CandidateDashboardPage = lazy(() => import('@/pages/candidate/dashboard-page'))
const CandidateApplicationPage = lazy(() => import('@/pages/candidate/application-page'))
const CandidateInterviewPage = lazy(() => import('@/pages/candidate/interview-page'))
const CandidateDocumentsPage = lazy(() => import('@/pages/candidate/documents-page'))
const CandidateProfilePage = lazy(() => import('@/pages/candidate/profile-page'))

const AdminDashboardPage = lazy(() => import('@/pages/admin/dashboard-page'))
const AdminCandidatesPage = lazy(() => import('@/pages/admin/candidates-page'))
const AdminInterviewsPage = lazy(() => import('@/pages/admin/interviews-page'))
const AdminPhasesPage = lazy(() => import('@/pages/admin/phases-page'))
const AdminEmailsPage = lazy(() => import('@/pages/admin/emails-page'))

const SuperAdminDashboardPage = lazy(() => import('@/pages/super-admin/dashboard-page'))
const SuperAdminBootcampsPage = lazy(() => import('@/pages/super-admin/bootcamps-page'))
const SuperAdminAdminsPage = lazy(() => import('@/pages/super-admin/admins-page'))
const SuperAdminAnalyticsPage = lazy(() => import('@/pages/super-admin/analytics-page'))

export const router = createBrowserRouter([
  // ------------------------------------------------------------ marketing --
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/programs', element: <ProgramsPage /> },
      { path: '/programs/:slug', element: <ProgramDetailPage /> },
      { path: '/admissions', element: <AdmissionsPage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/success-stories', element: <SuccessStoriesPage /> },
      { path: '/faq', element: <FaqPage /> },
      { path: '/contact', element: <ContactPage /> },
    ],
  },

  // ----------------------------------------------------------------- auth --
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
    ],
  },

  // --------------------------------------------------------------- portal --
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <PortalLayout />,
        children: [
          {
            element: <RoleRoute allow={[UserRole.CANDIDATE]} />,
            children: [
              { path: '/dashboard', element: <CandidateDashboardPage /> },
              { path: '/dashboard/application', element: <CandidateApplicationPage /> },
              { path: '/dashboard/interview', element: <CandidateInterviewPage /> },
              { path: '/dashboard/documents', element: <CandidateDocumentsPage /> },
              { path: '/dashboard/profile', element: <CandidateProfilePage /> },
            ],
          },
          {
            element: <RoleRoute allow={[UserRole.ADMIN, UserRole.SUPER_ADMIN]} />,
            children: [
              { path: '/admin', element: <AdminDashboardPage /> },
              { path: '/admin/candidates', element: <AdminCandidatesPage /> },
              { path: '/admin/interviews', element: <AdminInterviewsPage /> },
              { path: '/admin/phases', element: <AdminPhasesPage /> },
              { path: '/admin/emails', element: <AdminEmailsPage /> },
            ],
          },
          {
            element: <RoleRoute allow={[UserRole.SUPER_ADMIN]} />,
            children: [
              { path: '/super-admin', element: <SuperAdminDashboardPage /> },
              { path: '/super-admin/bootcamps', element: <SuperAdminBootcampsPage /> },
              { path: '/super-admin/admins', element: <SuperAdminAdminsPage /> },
              { path: '/super-admin/analytics', element: <SuperAdminAnalyticsPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
