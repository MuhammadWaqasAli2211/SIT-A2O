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
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Send } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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
import { DECLARATIONS, POLICY_CONSENT } from '@/features/registration/terms'

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
  const [submitted, setSubmitted] = useState<RegistrationValues | null>(null)

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
      setSubmitted(form.getValues())
      return
    }

    setDirection(1)
    const next = step + 1
    setStep(next)
    setFurthest((f) => Math.max(f, next))
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

  function restart() {
    form.reset(EMPTY as never)
    setSubmitted(null)
    setStep(0)
    setFurthest(0)
    setDirection(1)
  }

  if (submitted) return <ReviewPanel values={submitted} onRestart={restart} />

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
              {current.key === 'location' && <LocationSection />}
              {current.key === 'identity' && <IdentitySection />}
              {current.key === 'contact' && <ContactSection />}
              {current.key === 'education' && <EducationSection />}
              {current.key === 'terms' && <TermsSection />}
            </CardContent>
          </Card>
        </PageFold>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
            <ArrowLeft className="size-4" />
            Previous
          </Button>

          <Button type="button" onClick={goNext}>
            {isLast ? (
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

/* ---------------------------------------------------------------- review -- */

function ReviewPanel({
  values,
  onRestart,
}: {
  values: RegistrationValues
  onRestart: () => void
}) {
  // Widened to unknown: the value union spans strings, booleans and a File,
  // so comparing against each empty form narrows to a dead branch otherwise.
  const entries = (Object.entries(values) as [string, unknown][]).filter(
    ([, value]) => value !== undefined && value !== '' && value !== false,
  )

  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <CheckCircle2 className="size-4" />
        <AlertTitle>Form completed — not yet saved</AlertTitle>
        <AlertDescription>
          Every section passed validation. Nothing has been submitted or stored:
          this form is not connected to the database yet, so no application has
          been created and no candidate code issued.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What you entered</CardTitle>
          <CardDescription>
            The shape this data will take once persistence is added.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col">
            {entries.map(([key, value], index) => (
              <div key={key}>
                {index > 0 && <Separator />}
                <div className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                  <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                  <dd className="text-sm font-medium">{formatValue(value)}</dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={onRestart} className="w-fit">
        <RotateCcw className="size-4" />
        Start over
      </Button>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value instanceof File) return `${value.name} (${Math.round(value.size / 1024)} KB)`
  if (value === true) return 'Accepted'
  return String(value)
}
