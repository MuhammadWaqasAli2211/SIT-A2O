/**
 * HR assessment, platform-wide.
 *
 * The per-bootcamp screen at /admin/hr-assessment shows one intake at a time
 * via the shared BootcampSwitcher. This mirrors the split already established
 * for completed interviews and for analytics: a super admin sees every intake
 * by default and narrows with the bootcamp filter built into the panel,
 * rather than picking one up front.
 *
 * Same table, same stats, same export, same two modals — `HrAssessmentPanel`
 * is the one component both pages render.
 */

import { PageHeader } from '@/components/shared/portal-ui'
import { HrAssessmentPanel } from '@/features/hr-assessment/panel'

export default function SuperAdminHrAssessmentPage() {
  return (
    <>
      <PageHeader
        title="HR assessment"
        description="Screening results and onboarding paperwork across every intake."
      />
      <HrAssessmentPanel />
    </>
  )
}
