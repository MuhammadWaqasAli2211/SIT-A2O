import { useFormContext } from 'react-hook-form'

import { TextField, TextareaField, unlockedCount } from '@/features/registration/fields'

export function ContactSection() {
  const { watch } = useFormContext()
  const open = unlockedCount('contact', watch())

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        name="email"
        label="Email"
        locked={open < 0}
        type="email"
        inputMode="email"
        placeholder="you@example.com"
      />
      <TextField
        name="phone"
        label="Phone number"
        locked={open < 1}
        inputMode="tel"
        placeholder="0300-1234567"
      />
      <TextField
        name="father_phone"
        label="Father's phone number"
        locked={open < 2}
        inputMode="tel"
        placeholder="0300-1234567"
      />

      {/* Optional: an applicant under 18 may not hold a CNIC yet. */}
      <TextField
        name="cnic"
        label="Your CNIC"
        locked={open < 3}
        optional
        placeholder="42101-1234567-1"
        hint="Leave blank if you do not have one yet."
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
