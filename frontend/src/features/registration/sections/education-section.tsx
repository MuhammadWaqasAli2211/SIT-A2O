import { useEffect, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { CheckCircle2, ImageUp, Info, Laptop, Loader2, X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  COMPUTER_PROFICIENCY,
  LAPTOP_ANSWERS,
  PICTURE_ACCEPT,
  PICTURE_RULES,
  QUALIFICATIONS,
  REFERRAL_SOURCES,
} from '@/features/registration/constants'
import {
  GatedField,
  RadioField,
  SelectField,
  unlockedCount,
} from '@/features/registration/fields'
import { pictureApi } from '@/features/registration/picture-api'
import { toErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export function EducationSection() {
  const { watch } = useFormContext()
  const open = unlockedCount('education', watch())

  return (
    <div className="flex flex-col gap-5">
      {/* Three across on wide screens rather than stacked: these are short
          selects, and a single column pushed the upload below the fold. */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          name="computer_proficiency"
          label="Computer proficiency"
          locked={open < 0}
          options={COMPUTER_PROFICIENCY}
        />
        <SelectField
          name="last_qualification"
          label="Last qualification"
          locked={open < 1}
          options={QUALIFICATIONS}
        />
        <SelectField
          name="referral_source"
          label="Where did you hear about us?"
          locked={open < 2}
          options={REFERRAL_SOURCES}
        />
      </div>

      <div
        className={cn(
          'grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-center',
          open < 3 && 'pointer-events-none opacity-45',
        )}
      >
        <Alert>
          <Laptop className="size-4" />
          <AlertTitle>A personal laptop is mandatory</AlertTitle>
          <AlertDescription>
            Participants work on their own machine from the first class.
            Answering no does not disqualify you on its own.
          </AlertDescription>
        </Alert>
        <RadioField
          name="has_laptop"
          label="Do you have a laptop?"
          locked={open < 3}
          options={LAPTOP_ANSWERS}
        />
      </div>

      <PictureField locked={open < 4} />
    </div>
  )
}

/* --------------------------------------------------------------- picture -- */

function PictureField({ locked }: { locked: boolean }) {
  const { control } = useFormContext()
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Object URLs are not garbage collected on their own; without this every
  // re-pick would leak the previous image for the life of the page.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  return (
    <GatedField name="picture" label="Upload your picture" locked={locked}>
      <Controller
        control={control}
        name="picture"
        render={({ field }) => {
          /**
           * Uploads immediately on selection rather than at submit.
           *
           * The field is only set once the upload has succeeded, so the form's
           * unlock gate doubles as proof the picture is stored — there is no
           * way to reach the last step with a photo that never made it.
           */
          async function choose(file: File | undefined) {
            if (preview) URL.revokeObjectURL(preview)
            setUploadError(null)

            if (!file) {
              setPreview(null)
              field.onChange(undefined)
              return
            }

            setPreview(URL.createObjectURL(file))
            setUploading(true)
            try {
              await pictureApi.upload(file)
              field.onChange(file)
            } catch (error) {
              field.onChange(undefined)
              setUploadError(toErrorMessage(error, 'Could not upload your picture.'))
            } finally {
              setUploading(false)
            }
          }

          return (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <label
                className={cn(
                  'flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/60',
                  locked && 'cursor-not-allowed',
                )}
              >
                <ImageUp className="size-6 text-muted-foreground" />
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {uploading && <Loader2 className="size-3.5 animate-spin" />}
                  {field.value && !uploading && (
                    <CheckCircle2 className="size-3.5 text-success" />
                  )}
                  {uploading
                    ? 'Uploading…'
                    : field.value
                      ? 'Uploaded — choose a different picture'
                      : 'Choose a picture'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(field.value as File | undefined)?.name ?? 'JPG, JPEG or PNG · under 1 MB'}
                </span>
                <input
                  type="file"
                  accept={PICTURE_ACCEPT}
                  disabled={locked || uploading}
                  className="sr-only"
                  onChange={(e) => void choose(e.target.files?.[0])}
                />
              </label>

              {preview && (
                <div className="relative shrink-0 self-center sm:self-start">
                  <img
                    src={preview}
                    alt="Your uploaded picture"
                    className="size-28 rounded-xl border border-border object-cover"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Remove picture"
                    onClick={() => void choose(undefined)}
                    className="absolute -top-2 -right-2 size-7 rounded-full"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )
        }}
      />

      {/* Inline rather than a stacked list: three short rules cost three rows
          of height for no added clarity. */}
      {uploadError && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {uploadError}
        </p>
      )}

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
        {PICTURE_RULES.map((rule) => (
          <li key={rule} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3 shrink-0" />
            {rule}
          </li>
        ))}
      </ul>
    </GatedField>
  )
}
