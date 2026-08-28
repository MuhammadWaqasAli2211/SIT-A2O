import { PageHeader } from '@/components/shared/portal-ui'
import { HalfNamaForm } from '@/features/onboarding/half-nama-form'

/**
 * Admin-only preview of the digital "Half Nama" oath form. UI-only for
 * now — no backend, no candidate-facing route. Pure Urdu, RTL throughout;
 * see the form component for the auto-save and print/PDF behaviour.
 */
export default function AdminHalfNamaPreviewPage() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Half Nama (Oath Form)"
          description="Preview only. Not yet visible to candidates — this becomes part of the onboarding phase after selection."
        />
      </div>
      <HalfNamaForm />
    </>
  )
}
