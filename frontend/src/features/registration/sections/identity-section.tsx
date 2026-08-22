import { useFormContext } from 'react-hook-form'

import { TextField, unlockedCount } from '@/features/registration/fields'

/**
 * Split out of a single ten-field "Personal information" step, which ran well
 * past the fold. Four fields in two columns fit without scrolling.
 */
export function IdentitySection() {
  const { watch } = useFormContext()
  const open = unlockedCount('identity', watch())

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        name="full_name"
        label="Full name"
        locked={open < 0}
        placeholder="As on your CNIC or B-Form"
      />
      <TextField name="father_name" label="Father's name" locked={open < 1} />
      <TextField name="date_of_birth" label="Date of birth" locked={open < 2} type="date" />
      <TextField
        name="saylani_roll_number"
        label="Saylani roll number"
        locked={open < 3}
        inputMode="numeric"
        placeholder="Digits only"
      />
    </div>
  )
}
