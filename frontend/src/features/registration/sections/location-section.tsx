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
import type { Program } from '@/features/applications/api'

export function LocationSection({ programs }: { programs: readonly Program[] }) {
  const { watch } = useFormContext()
  const values = watch()
  const open = unlockedCount('location', values)

  // The only field whose stored value differs from its label — the API needs
  // the program's id, the candidate needs its title.
  const trackOptions = programs.map((program) => ({
    value: program.id,
    label: program.title,
  }))

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Sourced from the open intake, so a candidate can never pick a
          program it does not offer. */}
      <SelectField
        name="program_id"
        label="Applying for — which bootcamp track?"
        locked={false}
        options={trackOptions}
        placeholder="Select a bootcamp track"
        hint="The track you want to join in this intake."
        className="sm:col-span-2"
      />

      <SelectField
        name="country"
        label="Country"
        locked={open < 1}
        options={COUNTRIES}
        placeholder="Select country"
        hint="Bootcamps currently run in Pakistan only."
      />
      <SelectField name="gender" label="Gender" locked={open < 2} options={GENDERS} />
      <SelectField
        name="city"
        label="City"
        locked={open < 3}
        options={CITIES}
        placeholder="Select your city"
        hint="Where you live, not where the campus is."
      />
      <SelectField
        name="course"
        label="Already completed — which Saylani course?"
        locked={open < 4}
        hint="A course you have already finished. Not the same as the track above."
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
          locked={open < 5}
          options={COURSE_STATUSES}
          placeholder="Select status"
        />
      )}

      <SelectField
        name="campus"
        label="Campus"
        locked={open < 6}
        options={CAMPUSES}
        placeholder="Select campus"
        hint="Bootcamps are held at this campus only."
      />
    </div>
  )
}
