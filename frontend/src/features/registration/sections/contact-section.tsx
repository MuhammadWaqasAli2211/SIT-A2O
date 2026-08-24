import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'

import {
  TextField,
  TextareaField,
  formatPhone,
  isAdult,
  unlockedCount,
} from '@/features/registration/fields'
import { optionalCnic, requiredCnic } from '@/features/registration/schema'
import { useAuth } from '@/hooks/use-auth'

export function ContactSection() {
  const { watch, setValue } = useFormContext()
  const values = watch()
  const { profile } = useAuth()

  // The account's own address. Filled in rather than asked for, because this
  // is the mailbox they signed up with, not a new value to enter.
  const accountEmail = profile?.email ?? ''
  useEffect(() => {
    if (accountEmail) setValue('email', accountEmail, { shouldValidate: true })
  }, [accountEmail, setValue])

  // Required from 18. The gate has to agree with the submit-time rule, or an
  // adult could walk past an empty CNIC and be rejected at the last step.
  const cnicRequired = isAdult(values.date_of_birth)
  const open = unlockedCount('contact', values, {
    cnic: cnicRequired ? requiredCnic : optionalCnic,
  })

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        name="email"
        label="Email"
        locked={false}
        readOnly
        type="email"
        inputMode="email"
        hint="Taken from your account. Change it in your profile, not here."
      />
      {/* Dashes appear as you type, and the twelfth digit is refused. */}
      <TextField
        name="phone"
        label="Phone number"
        locked={open < 1}
        inputMode="tel"
        placeholder="0300-1234567"
        transform={formatPhone}
      />
      <TextField
        name="father_phone"
        label="Father's phone number"
        locked={open < 2}
        inputMode="tel"
        placeholder="0300-1234567"
        transform={formatPhone}
      />

      {/* Optional under 18, required from 18 — driven by the date of birth
          entered in the previous step, so the asterisk appears on its own. */}
      <TextField
        name="cnic"
        label="Your CNIC"
        locked={open < 3}
        optional={!cnicRequired}
        placeholder="42101-1234567-1"
        hint={
          cnicRequired
            ? 'Required, because you are 18 or older.'
            : 'Optional — leave blank if you have not been issued one yet.'
        }
      />
      <TextField
        name="father_cnic"
        label="Father's CNIC"
        locked={open < 4}
        placeholder="42101-1234567-1"
      />

      <TextareaField
        name="address"
        label="Address"
        locked={open < 5}
        maxLength={220}
        placeholder="House, street, area, city"
        className="sm:col-span-2"
      />
    </div>
  )
}
