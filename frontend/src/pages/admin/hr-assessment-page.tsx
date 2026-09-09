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
import { BootcampSwitcher, NoBootcampSelected } from '@/features/admin/components'
import { HrAssessmentPanel } from '@/features/hr-assessment/panel'
import { useBootcamp } from '@/hooks/use-bootcamp'

export default function AdminHrAssessmentPage() {
  const { selected, selectedId } = useBootcamp()

  return (
    <>
      <PageHeader
        title="HR assessment"
        description={
          selected
            ? `Screening results and onboarding paperwork for ${selected.name}.`
            : 'Pick an intake to review its candidates.'
        }
        actions={<BootcampSwitcher />}
      />

      {!selectedId ? (
        <NoBootcampSelected icon={ClipboardList} />
      ) : (
        <HrAssessmentPanel bootcampId={selectedId} bootcampName={selected?.name} />
      )}
    </>
  )
}
