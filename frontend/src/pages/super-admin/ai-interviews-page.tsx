/**
 * Completed AI interviews, platform-wide.
 *
 * The per-bootcamp "Completed" tab on /admin/ai-interviews only ever shows
 * one intake at a time, via the shared BootcampSwitcher — there is no "every
 * bootcamp at once" mode there. This mirrors the split already established
 * elsewhere (bootcamp_stats vs platform_stats, /admin vs /super-admin/
 * analytics): a super admin sees everything by default here, and narrows
 * with the bootcamp filter built into the panel below rather than picking
 * one intake up front.
 *
 * Same table, same stats, same export, same report dialog as the admin tab —
 * `CompletedInterviewsPanel` is the one component both pages render.
 */

import { PageHeader } from '@/components/shared/portal-ui'
import { CompletedInterviewsPanel } from '@/features/ai-interview/completed-interviews'

export default function SuperAdminAiInterviewsPage() {
  return (
    <>
      <PageHeader
        title="Completed interviews"
        description="Every finished AI screening across every intake."
      />
      <CompletedInterviewsPanel />
    </>
  )
}
