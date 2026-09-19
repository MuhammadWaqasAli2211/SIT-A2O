/**
 * HR Assessment for the selected intake.
 *
 * Distinct from /admin/onboarding, which is the review-and-act screen for one
 * candidate's folder. This is the reviewer's roster: everyone in onboarding,
 * with their AI screening result beside their paperwork, and either one
 * openable without leaving the list. Neither half is new data — the point is
 * that nothing else puts them on the same row.
 */

import { ClipboardList } from 'lucide-react'

import { PageHeader } from '@/components/shared/portal-ui'
import { BootcampSwitcher, BootcampGate } from '@/features/admin/components'
import { HrAssessmentPanel } from '@/features/hr-assessment/panel'
import { PhysicalInterviewAnnounceButton } from '@/features/physical-interview/announce-section'
import { useBootcamp } from '@/hooks/use-bootcamp'

export default function AdminHrAssessmentPage() {
  const { selected, selectedId, loading: bootcampLoading } = useBootcamp()

  return (
    <>
      <PageHeader
        title="HR assessment"
        description={
          bootcampLoading
            ? undefined
            : selected
              ? `Screening results and onboarding paperwork for ${selected.name}.`
              : 'Pick an intake to review its candidates.'
        }
        actions={
          <>
            {/* Beside the switcher, like the AI interviews page's announce
                control: a once-per-round action, not page content. */}
            {selectedId && <PhysicalInterviewAnnounceButton bootcampId={selectedId} />}
            <BootcampSwitcher />
          </>
        }
      />

      <BootcampGate icon={ClipboardList}>
        {(selectedId) => (
          <HrAssessmentPanel bootcampId={selectedId} bootcampName={selected?.name} />
        )}
      </BootcampGate>
    </>
  )
}
