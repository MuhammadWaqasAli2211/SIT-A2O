import { useFormContext } from 'react-hook-form'

import {
  CAMPUSES,
  CITIES,
  COUNTRIES,
  COURSES,
  COURSE_STATUSES,
  GENDERS,
} from '@/features/registration/constants'
import { SelectField, unlockedCount } from '@/features/registration/fields'

export function LocationSection() {
  const { watch } = useFormContext()
  const values = watch()
  const open = unlockedCount('location', values)

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SelectField
        name="country"
        label="Country"
        locked={open < 0}
        options={COUNTRIES}
        placeholder="Select country"
        hint="Bootcamps currently run in Pakistan only."
      />
      <SelectField name="gender" label="Gender" locked={open < 1} options={GENDERS} />
      <SelectField
        name="city"
        label="City"
        locked={open < 2}
        options={CITIES}
        placeholder="Select your city"
        hint="Where you live, not where the campus is."
      />
      <SelectField
        name="course"
        label="Which course have you completed at Saylani?"
        locked={open < 3}
        options={COURSES}
        placeholder="Select a course"
        className="sm:col-span-2"
      />

      {/* Only meaningful once a course is named, so it is not rendered before
          then — a disabled "status of what?" dropdown explains nothing. */}
      {values.course && (
        <SelectField
          name="course_status"
          label="Status of that course"
          locked={open < 4}
          options={COURSE_STATUSES}
          placeholder="Select status"
        />
      )}

      <SelectField
        name="campus"
        label="Campus"
        locked={open < 5}
        options={CAMPUSES}
        placeholder="Select campus"
        hint="Bootcamps are held at this campus only."
      />
    </div>
  )
}
