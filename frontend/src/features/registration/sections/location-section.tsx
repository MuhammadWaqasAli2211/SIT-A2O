import { useFormContext } from 'react-hook-form'

import {
  CAMPUSES,
  CITIES,
  COUNTRIES,
  COURSES,
  COURSE_STATUSES,
  GENDERS,
} from '@/features/registration/constants'
import { GatedField, SelectField, unlockedCount } from '@/features/registration/fields'
import type { Program } from '@/features/applications/api'
import { Controller } from 'react-hook-form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function LocationSection({ programs }: { programs: readonly Program[] }) {
  const { watch, control } = useFormContext()
  const values = watch()
  const open = unlockedCount('location', values)

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Which track they are applying for. Sourced from the open intake, so
          a candidate can never pick a program it does not offer. */}
      <GatedField
        name="program_id"
        label="Applying for — which bootcamp track?"
        locked={false}
        className="sm:col-span-2"
        hint="The track you want to join in this intake."
      >
        <Controller
          control={control}
          name="program_id"
          render={({ field }) => (
            <Select
              value={field.value ? field.value : null}
              onValueChange={(v) => field.onChange(v ?? '')}
            >
              <SelectTrigger id="program_id" className="w-full">
                <SelectValue placeholder="Select a bootcamp track" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </GatedField>

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
