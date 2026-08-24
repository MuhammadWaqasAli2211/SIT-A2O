/**
 * The four-section bootcamp registration form.
 *
 * Nothing is persisted. The database layer for this form does not exist yet by
 * instruction, so submission ends in a local review panel that says so plainly
 * rather than pretending an application was created.
 *
 * State shape is chosen for that future, though: field names match what the
 * candidate profile will store, so wiring a mutation later is a change of
 * destination, not of structure.
 */

import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Loader2, Send } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormStepper, type FormStep } from '@/features/registration/form-stepper'
import { PageFold, type FoldDirection } from '@/features/registration/page-fold'
import {
  SECTION_FIELDS,
  registrationSchema,
  type RegistrationValues,
  type SectionKey,
} from '@/features/registration/schema'
import { ContactSection } from '@/features/registration/sections/contact-section'
import { EducationSection } from '@/features/registration/sections/education-section'
import { IdentitySection } from '@/features/registration/sections/identity-section'
import { LocationSection } from '@/features/registration/sections/location-section'
import { TermsSection } from '@/features/registration/sections/terms-section'
import { DECLARATIONS, POLICY_CONSENT, TERMS_VERSION } from '@/features/registration/terms'
import { applicationsApi, type RegistrationResult } from '@/features/applications/api'
import { useApplication } from '@/features/applications/application-context'
import { RegistrationSuccess } from '@/features/registration/registration-success'
import { toErrorMessage } from '@/lib/api-client'

/**
 * Five steps, not four. "Personal information" was one ten-field step that ran
 * well past the fold; splitting it into identity and contact keeps every step
 * to at most three rows of a two-column grid, which is what "no scrolling"
 * actually requires.
 */
const STEPS: readonly (FormStep & { key: SectionKey })[] = [
  { key: 'location', label: 'Course', hint: 'Where you are and what you studied' },
  { key: 'identity', label: 'About you', hint: 'Name, date of birth, roll number' },
  { key: 'contact', label: 'Contact', hint: 'Email, phone, CNIC and address' },
  { key: 'education', label: 'Education', hint: 'Skills, equipment and photo' },
  { key: 'terms', label: 'Declarations', hint: 'What you agree to' },
]

/** Every field starts empty so the unlock gate opens from the first one. */
const EMPTY: Record<string, unknown> = {
  program_id: '',
  country: '',
  gender: '',
  city: '',
  course: '',
  course_status: '',
  campus: '',
  full_name: '',
  father_name: '',
  date_of_birth: '',
  email: '',
  phone: '',
  father_phone: '',
  cnic: '',
  father_cnic: '',
  address: '',
  saylani_roll_number: '',
  computer_proficiency: '',
  last_qualification: '',
  referral_source: '',
  has_laptop: '',
  picture: undefined,
  ...Object.fromEntries(
    [...DECLARATIONS.map((d) => d.id), POLICY_CONSENT.id].map((id) => [id, false]),
  ),
}

export function RegistrationForm() {
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [direction, setDirection] = useState<FoldDirection>(1)
  const [result, setResult] = useState<RegistrationResult | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { openBootcamps, reload } = useApplication()

  // One open intake at a time in practice; the first is the one being applied to.
  const bootcamp = openBootcamps[0]

  const form = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    // Needed for progressive unlocking: the gate re-evaluates as the user
    // types, so validity has to be current rather than computed on blur.
    mode: 'onChange',
    defaultValues: EMPTY as never,
  })

  const current = STEPS[step]!
  const isLast = step === STEPS.length - 1

  async function goNext() {
    const fields = SECTION_FIELDS[current.key] as readonly string[]
    const valid = await form.trigger(fields as never, { shouldFocus: true })
    if (!valid) return

    if (isLast) {
      await sendRegistration()
      return
    }

    setDirection(1)
    const next = step + 1
    setStep(next)
    setFurthest((f) => Math.max(f, next))
  }

  async function sendRegistration() {
    if (!bootcamp) {
      setError('Registration is not open for any bootcamp right now.')
      return
    }
    const v = form.getValues() as Record<string, string | boolean>

    setSending(true)
    setError(null)
    try {
      const created = await applicationsApi.register({
        bootcamp_id: bootcamp.id,
        program_id: v.program_id as string,
        full_name: v.full_name as string,
        father_name: v.father_name as string,
        gender: v.gender as string,
        date_of_birth: v.date_of_birth as string,
        city: v.city as string,
        email: v.email as string,
        phone: v.phone as string,
        father_phone: v.father_phone as string,
        // '' means "I do not have one"; the column is unique, so it must be
        // null rather than an empty string that a second applicant collides on.
        cnic: (v.cnic as string) || null,
        father_cnic: v.father_cnic as string,
        address: v.address as string,
        saylani_roll_number: v.saylani_roll_number as string,
        prior_course: v.course as string,
        prior_course_status: v.course_status as string,
        campus: v.campus as string,
        computer_proficiency: v.computer_proficiency as string,
        last_qualification: v.last_qualification as string,
        referral_source: v.referral_source as string,
        has_laptop: v.has_laptop === 'Yes',
        terms_version: TERMS_VERSION,
      })
      setResult(created)
    } catch (e) {
      setError(toErrorMessage(e, 'Could not submit your registration.'))
    } finally {
      setSending(false)
    }
  }

  function goBack() {
    setDirection(-1)
    setStep((s) => Math.max(0, s - 1))
  }

  // Backwards only; jumping ahead would skip the validation each Next enforces.
  function jumpTo(index: number) {
    setDirection(index > step ? 1 : -1)
    setStep(index)
  }

  // `reload()` is handed to the modal rather than fired on submit.
  //
  // The portal locks Application/Interview/Documents behind having an
  // application, so the refetch has to happen — but it also raises a loading
  // flag that this page's guard watches. Firing it in the same batch as
  // `setResult` unmounted this component before the modal could paint, taking
  // the candidate's code with it. Deferring it to dismissal removes the race
  // rather than merely surviving it, and nothing behind the modal needs
  // unlocking while the modal is covering it.
  if (result) return <RegistrationSuccess result={result} onDone={reload} />

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-7">
        <FormStepper
          steps={STEPS}
          current={step}
          furthestReached={furthest}
          onStepSelect={jumpTo}
        />

        <PageFold sectionKey={current.key} direction={direction}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Step {step + 1} of {STEPS.length} — {current.label}
              </CardTitle>
              <CardDescription>{current.hint}</CardDescription>
            </CardHeader>
            <CardContent className="pb-7">
              {current.key === 'location' && (
                <LocationSection programs={bootcamp?.programs ?? []} />
              )}
              {current.key === 'identity' && <IdentitySection />}
              {current.key === 'contact' && <ContactSection />}
              {current.key === 'education' && <EducationSection />}
              {current.key === 'terms' && <TermsSection />}
            </CardContent>
          </Card>
        </PageFold>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not submit</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={step === 0 || sending}
          >
            <ArrowLeft className="size-4" />
            Previous
          </Button>

          <Button type="button" onClick={goNext} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting
              </>
            ) : isLast ? (
              <>
                <Send className="size-4" />
                Submit registration
              </>
            ) : (
              <>
                Next
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </FormProvider>
  )
}
