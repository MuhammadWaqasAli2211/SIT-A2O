import { PageHeader } from '@/components/shared/portal-ui'
import { BackgroundVerificationForm } from '@/features/onboarding/background-verification-form'

/**
 * Admin-only preview of the digital "Background Verification Form"
 * (SWIT-IHR-FAF-11). UI-only for now — no backend, no candidate-facing
 * route. See the form component for the auto-save and print/PDF behaviour.
 */
export default function AdminBackgroundVerificationPreviewPage() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Background Verification Form"
          description="Preview only. Not yet visible to candidates — this becomes part of the onboarding phase after selection."
        />
      </div>
      <BackgroundVerificationForm />
    </>
  )
}
