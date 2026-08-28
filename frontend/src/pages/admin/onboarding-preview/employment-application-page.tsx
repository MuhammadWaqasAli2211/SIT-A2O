import { PageHeader } from '@/components/shared/portal-ui'
import { EmploymentApplicationForm } from '@/features/onboarding/employment-application-form'

/**
 * Admin-only preview of the digital "Employment Application Form"
 * (SWIT-IHR-FAF-03). UI-only for now — no backend, no candidate-facing
 * route. See the form component for the auto-save and print/PDF behaviour.
 */
export default function AdminEmploymentApplicationPreviewPage() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Employment Application Form"
          description="Preview only. Not yet visible to candidates — this becomes part of the onboarding phase after selection."
        />
      </div>
      <EmploymentApplicationForm />
    </>
  )
}
