/**
 * The registration route.
 *
 * Guards on the registration window before mounting the form. Previously the
 * form mounted unconditionally and, with no open intake, rendered a track
 * dropdown with nothing in it — five steps the candidate could walk through
 * and never submit. Not mounting it at all is the difference between "closed"
 * and "broken".
 *
 * The check is the same one the server enforces: `/bootcamps/open` is filtered
 * by `is_phase_open()`, flag and clock together.
 */

import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/shared/portal-ui'
import { Skeleton } from '@/components/ui/skeleton'
import { useApplication } from '@/features/applications/application-context'
import { RegistrationClosedDialog } from '@/features/registration/registration-closed-dialog'
import { RegistrationForm } from '@/features/registration/registration-form'

export default function CandidateRegisterPage() {
  const navigate = useNavigate()
  const { openBootcamps, application, initialLoading } = useApplication()

  // `initialLoading`, never `loading`. Nothing is decided until the first
  // fetch settles, but a *refetch* must not unmount the form underneath —
  // submitting triggers one, and unmounting mid-success threw away the state
  // holding the candidate's code before the modal could render it.
  if (initialLoading) {
    return (
      <>
        <PageHeader title="Bootcamp registration" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </>
    )
  }

  // Somebody who already applied is not starting a fresh registration, so the
  // closed notice does not apply to them — their intake being shut is expected
  // and their application is unaffected.
  const alreadyApplied = application !== null
  const closed = !alreadyApplied && openBootcamps.length === 0

  if (closed) {
    return (
      <>
        <PageHeader
          title="Bootcamp registration"
          description="Applications are not open at the moment."
        />
        <RegistrationClosedDialog open onDismiss={() => navigate('/dashboard')} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Bootcamp registration"
        description="Five short sections. Your answers are validated as you go, and you can step back at any point."
      />
      <RegistrationForm />
    </>
  )
}
