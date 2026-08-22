import { PageHeader } from '@/components/shared/portal-ui'
import { RegistrationForm } from '@/features/registration/registration-form'

export default function CandidateRegisterPage() {
  return (
    <>
      <PageHeader
        title="Bootcamp registration"
        description="Four short sections. Your answers are validated as you go, and you can step back at any point."
      />
      <RegistrationForm />
    </>
  )
}
