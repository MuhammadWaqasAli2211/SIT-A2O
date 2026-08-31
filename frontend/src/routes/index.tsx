import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { PortalLayout } from '@/components/layout/portal-layout'
import { PublicLayout } from '@/components/layout/public-layout'
import HomePage from '@/pages/public/home-page'
import NotFoundPage from '@/pages/not-found-page'
import { AdminBootcampLayout } from '@/routes/admin-layout'
import { RouteErrorBoundary } from '@/routes/error-boundary'
import {
  GuestRoute,
  ProtectedRoute,
  RequiresApplication,
  RequiresOnboardingUnlocked,
  RoleRoute,
} from '@/routes/guards'
import { UserRole } from '@/lib/types'

/**
 * Everything except the landing page is lazy-loaded.
 *
 * Recharts alone is a few hundred kilobytes and is only ever used by the admin
 * and super-admin dashboards — a candidate should never download it. Splitting
 * here keeps the first paint small for the page most visitors actually land on.
 *
 * The auth pages used to be eager alongside the landing page. They are not any
 * more: nothing on the landing page needs them, so bundling them into the main
 * chunk only made the most-visited route heavier. They carry their own
 * illustration and alumni dial now, which made that cost visible.
 */
const LoginPage = lazy(() => import('@/pages/auth/login-page'))
const SignupPage = lazy(() => import('@/pages/auth/signup-page'))

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
const StudentFolderPage = lazy(() => import('@/pages/candidate/student-folder-page'))
const OnboardingFormPage = lazy(() => import('@/pages/candidate/onboarding-form-page'))
const DocumentsHubPage = lazy(() => import('@/pages/candidate/documents-hub-page'))

// One account screen for every role, rather than a candidate-only profile page
// that staff could reach from the topbar and get bounced out of.
const AccountPage = lazy(() => import('@/pages/account-page'))

const AdminDashboardPage = lazy(() => import('@/pages/admin/dashboard-page'))
const AdminCandidatesPage = lazy(() => import('@/pages/admin/candidates-page'))
const AdminInterviewsPage = lazy(() => import('@/pages/admin/interviews-page'))
const AdminPhasesPage = lazy(() => import('@/pages/admin/phases-page'))
const AdminEmailsPage = lazy(() => import('@/pages/admin/emails-page'))
const AdminAiInterviewsPage = lazy(() => import('@/pages/admin/ai-interviews-page'))
const AdminOnboardingCandidatesPage = lazy(() => import('@/pages/admin/onboarding-candidates-page'))
const AdminOnboardingCandidatePage = lazy(() => import('@/pages/admin/onboarding-candidate-page'))
const AdminBackgroundVerificationPreviewPage = lazy(
  () => import('@/pages/admin/onboarding-preview/background-verification-page'),
)
const AdminEmploymentApplicationPreviewPage = lazy(
  () => import('@/pages/admin/onboarding-preview/employment-application-page'),
)
const AdminHalfNamaPreviewPage = lazy(() => import('@/pages/admin/onboarding-preview/half-nama-page'))

const SuperAdminDashboardPage = lazy(() => import('@/pages/super-admin/dashboard-page'))
const SuperAdminBootcampsPage = lazy(() => import('@/pages/super-admin/bootcamps-page'))
const SuperAdminAdminsPage = lazy(() => import('@/pages/super-admin/admins-page'))
const SuperAdminAnalyticsPage = lazy(() => import('@/pages/super-admin/analytics-page'))
const SuperAdminProgramsPage = lazy(() => import('@/pages/super-admin/programs-page'))
const SuperAdminPermissionsPage = lazy(() => import('@/pages/super-admin/permissions-page'))
const SuperAdminAiInterviewsPage = lazy(() => import('@/pages/super-admin/ai-interviews-page'))

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
                ],
              },

              // Student's Folder: locked until Physical Interview clears — a
              // stricter gate than RequiresApplication above, so its own guard
              // rather than nested inside it.
              {
                element: <RequiresOnboardingUnlocked />,
                children: [
                  { path: '/dashboard/documents', element: <StudentFolderPage /> },
                  { path: '/dashboard/documents/forms/:slug', element: <OnboardingFormPage /> },
                  { path: '/dashboard/documents/hub', element: <DocumentsHubPage /> },
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
                  // Results from the external AI Interviewer, distinct from
                  // /admin/interviews, which schedules our own physical round.
                  { path: '/admin/ai-interviews', element: <AdminAiInterviewsPage /> },
                  // Review of the 4 onboarding forms + Documents Hub uploads.
                  { path: '/admin/onboarding', element: <AdminOnboardingCandidatesPage /> },
                  {
                    path: '/admin/onboarding/:applicationId',
                    element: <AdminOnboardingCandidatePage />,
                  },
                  // Onboarding forms, built ahead of the phase that uses them.
                  // Admin-only preview: no candidate route exists yet.
                  {
                    path: '/admin/onboarding-preview/background-verification',
                    element: <AdminBackgroundVerificationPreviewPage />,
                  },
                  {
                    path: '/admin/onboarding-preview/employment-application',
                    element: <AdminEmploymentApplicationPreviewPage />,
                  },
                  {
                    path: '/admin/onboarding-preview/half-nama',
                    element: <AdminHalfNamaPreviewPage />,
                  },

                  {
                    element: <RoleRoute allow={[UserRole.SUPER_ADMIN]} />,
                    ...onError,
                    children: [
                      { path: '/super-admin', element: <SuperAdminDashboardPage /> },
                      { path: '/super-admin/bootcamps', element: <SuperAdminBootcampsPage /> },
                      { path: '/super-admin/admins', element: <SuperAdminAdminsPage /> },
                      { path: '/super-admin/analytics', element: <SuperAdminAnalyticsPage /> },
                      { path: '/super-admin/programs', element: <SuperAdminProgramsPage /> },
                      {
                        path: '/super-admin/permissions',
                        element: <SuperAdminPermissionsPage />,
                      },
                      {
                        path: '/super-admin/ai-interviews',
                        element: <SuperAdminAiInterviewsPage />,
                      },
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
