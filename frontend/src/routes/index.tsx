import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { PortalLayout } from '@/components/layout/portal-layout'
import { PublicLayout } from '@/components/layout/public-layout'
import HomePage from '@/pages/public/home-page'
import LoginPage from '@/pages/auth/login-page'
import SignupPage from '@/pages/auth/signup-page'
import NotFoundPage from '@/pages/not-found-page'
import { AdminBootcampLayout } from '@/routes/admin-layout'
import { RouteErrorBoundary } from '@/routes/error-boundary'
import { GuestRoute, ProtectedRoute, RequiresApplication, RoleRoute } from '@/routes/guards'
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
const CandidateTrackPage = lazy(() => import('@/pages/candidate/track-page'))
const CandidateRegisterPage = lazy(() => import('@/pages/candidate/register-page'))
const CandidateApplicationPage = lazy(() => import('@/pages/candidate/application-page'))
const CandidateInterviewPage = lazy(() => import('@/pages/candidate/interview-page'))
const CandidateDocumentsPage = lazy(() => import('@/pages/candidate/documents-page'))

// One account screen for every role, rather than a candidate-only profile page
// that staff could reach from the topbar and get bounced out of.
const AccountPage = lazy(() => import('@/pages/account-page'))

const AdminDashboardPage = lazy(() => import('@/pages/admin/dashboard-page'))
const AdminCandidatesPage = lazy(() => import('@/pages/admin/candidates-page'))
const AdminInterviewsPage = lazy(() => import('@/pages/admin/interviews-page'))
const AdminPhasesPage = lazy(() => import('@/pages/admin/phases-page'))
const AdminEmailsPage = lazy(() => import('@/pages/admin/emails-page'))
const AdminDocumentsPage = lazy(() => import('@/pages/admin/documents-page'))

const SuperAdminDashboardPage = lazy(() => import('@/pages/super-admin/dashboard-page'))
const SuperAdminBootcampsPage = lazy(() => import('@/pages/super-admin/bootcamps-page'))
const SuperAdminAdminsPage = lazy(() => import('@/pages/super-admin/admins-page'))
const SuperAdminAnalyticsPage = lazy(() => import('@/pages/super-admin/analytics-page'))
const SuperAdminProgramsPage = lazy(() => import('@/pages/super-admin/programs-page'))

// Attached to every top-level branch so a crash inside one section renders the
// boundary rather than white-screening the whole app.
const onError = { errorElement: <RouteErrorBoundary /> }

export const router = createBrowserRouter([
  // ------------------------------------------------------------ marketing --
  {
    element: <PublicLayout />,
    ...onError,
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
    ...onError,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
    ],
  },

  // --------------------------------------------------------------- portal --
  {
    element: <ProtectedRoute />,
    ...onError,
    children: [
      {
        element: <PortalLayout />,
        children: [
          // Any signed-in role. Sits outside the role gates because it is the
          // one screen every role legitimately shares.
          { path: '/account', element: <AccountPage />, ...onError },

          {
            element: <RoleRoute allow={[UserRole.CANDIDATE]} />,
            ...onError,
            children: [
              // Open to any signed-in candidate: the overview explains what to
              // do next, the tracker explains the process in demo mode, and
              // the profile belongs to the account rather than to any intake.
              { path: '/dashboard', element: <CandidateDashboardPage /> },
              { path: '/dashboard/track', element: <CandidateTrackPage /> },
              // The registration form itself: open to any signed-in candidate,
              // since completing it is what creates an application.
              { path: '/dashboard/register', element: <CandidateRegisterPage /> },
              // Kept so old links and bookmarks still land somewhere real.
              { path: '/dashboard/profile', element: <Navigate to="/account" replace /> },

              // Everything here describes a submitted application, so it stays
              // shut until one exists. Signing up is not registering.
              {
                element: <RequiresApplication />,
                children: [
                  { path: '/dashboard/application', element: <CandidateApplicationPage /> },
                  { path: '/dashboard/interview', element: <CandidateInterviewPage /> },
                  { path: '/dashboard/documents', element: <CandidateDocumentsPage /> },
                ],
              },
            ],
          },

          // Staff. The outer gate admits both roles so the bootcamp provider
          // loads once for either; the inner gate narrows to super admins.
          // Nesting them this way means a super admin can use the per-bootcamp
          // tools without a second provider or a duplicated route table.
          {
            element: <RoleRoute allow={[UserRole.ADMIN, UserRole.SUPER_ADMIN]} />,
            ...onError,
            children: [
              {
                element: <AdminBootcampLayout />,
                children: [
                  { path: '/admin', element: <AdminDashboardPage /> },
                  { path: '/admin/candidates', element: <AdminCandidatesPage /> },
                  { path: '/admin/interviews', element: <AdminInterviewsPage /> },
                  { path: '/admin/phases', element: <AdminPhasesPage /> },
                  { path: '/admin/emails', element: <AdminEmailsPage /> },
                  { path: '/admin/documents', element: <AdminDocumentsPage /> },

                  {
                    element: <RoleRoute allow={[UserRole.SUPER_ADMIN]} />,
                    ...onError,
                    children: [
                      { path: '/super-admin', element: <SuperAdminDashboardPage /> },
                      { path: '/super-admin/bootcamps', element: <SuperAdminBootcampsPage /> },
                      { path: '/super-admin/admins', element: <SuperAdminAdminsPage /> },
                      { path: '/super-admin/analytics', element: <SuperAdminAnalyticsPage /> },
                      { path: '/super-admin/programs', element: <SuperAdminProgramsPage /> },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
