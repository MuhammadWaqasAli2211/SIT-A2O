import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'

import {
  TextField,
  TextareaField,
  formatPhone,
  isAdult,
  unlockedCount,
} from '@/features/registration/fields'
import { bFormSchema, cnicSchema } from '@/features/registration/schema'
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

  // One field, two documents. An adult gives a CNIC; a minor gives the B-Form
  // they hold instead. Neither is skippable — an earlier version let a minor
  // past with nothing, which left the record with no way to identify them.
  const adult = isAdult(values.date_of_birth)
  const open = unlockedCount('contact', values, {
    cnic: adult ? cnicSchema : bFormSchema,
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

      {/* Label and validation swap on the date of birth entered in the
          previous step. Both are mandatory. */}
      <TextField
        name="cnic"
        label={adult ? 'Your CNIC' : 'Your B-Form number'}
        locked={open < 3}
        placeholder="42101-1234567-1"
        hint={
          adult
            ? 'The CNIC issued in your own name.'
            : 'Under 18, so give your B-Form number instead of a CNIC.'
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
