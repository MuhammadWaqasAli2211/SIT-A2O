/**
 * Progressive field unlocking, and the field wrappers that express it.
 *
 * A field is fillable only once every field above it in its section validates.
 * That is derived, never stored: `unlockedCount()` walks the section's field
 * order and returns the index of the first one that does not parse. Field `i`
 * is enabled when `i <= unlockedCount`. Clearing a field re-locks everything
 * after it automatically, with no state to keep in step.
 */

import type { ReactNode } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { Lock } from 'lucide-react'
import type { z } from 'zod'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SECTION_FIELDS, SECTION_SCHEMAS, type SectionKey } from '@/features/registration/schema'
import { isAdult } from '@/lib/age'
import { cn } from '@/lib/utils'

export { isAdult }

/** Pakistani mobile numbers are 11 digits: 0300-1234567. */
const PHONE_DIGITS = 11
const PHONE_DASH_AFTER = 4

/**
 * Formats as the user types, and refuses the twelfth digit.
 *
 * Non-digits are discarded first, then a `+92` / `92` country code is
 * rewritten to the local `0` form — otherwise pasting "+92 300 123 4567"
 * yields "9230-0123456", which is what a first attempt at this actually did.
 */
export function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')

  // 92 3xx xxxxxxx -> 0 3xx xxxxxxx. Guarded on the 3 so a local number that
  // merely happens to start "92" is left alone; PK mobiles are all 03xx.
  if (digits.startsWith('92') && digits[2] === '3') digits = `0${digits.slice(2)}`

  digits = digits.slice(0, PHONE_DIGITS)
  if (digits.length <= PHONE_DASH_AFTER) return digits
  return `${digits.slice(0, PHONE_DASH_AFTER)}-${digits.slice(PHONE_DASH_AFTER)}`
}

/** Digits only, hard-capped. Used by the Saylani roll number. */
export function digitsOnly(raw: string, max: number): string {
  return raw.replace(/\D/g, '').slice(0, max)
}

/** Index of the first field in the section that does not yet validate. */
export function unlockedCount(
  section: SectionKey,
  values: Record<string, unknown>,
  /**
   * Swap in a different schema for named fields.
   *
   * The CNIC rule depends on a date entered in an earlier section, so the
   * static section schema cannot express it. Without this the gate would let
   * an adult walk past an empty CNIC that the submit-time check then rejects.
   */
  overrides?: Record<string, z.ZodTypeAny>,
): number {
  const shape = SECTION_SCHEMAS[section].shape as Record<string, z.ZodTypeAny>
  const order = SECTION_FIELDS[section] as readonly string[]

  for (let i = 0; i < order.length; i += 1) {
    const key = order[i]
    const fieldSchema = key ? (overrides?.[key] ?? shape[key]) : undefined
    if (!fieldSchema) continue
    if (!fieldSchema.safeParse(values[key as string]).success) return i
  }
  return order.length
}

/* ------------------------------------------------------------ wrapper -- */

export function GatedField({
  name,
  label,
  locked,
  optional = false,
  hint,
  children,
  className,
}: {
  name: string
  label: string
  locked: boolean
  optional?: boolean
  hint?: string
  children: ReactNode
  className?: string
}) {
  const {
    formState: { errors },
  } = useFormContext()
  const error = errors[name]?.message as string | undefined

  return (
    <div
      className={cn(
        'flex flex-col gap-2 transition-opacity duration-300',
        locked && 'pointer-events-none opacity-45 select-none',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={name} className="text-sm">
          {label}
          {!optional && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {optional && (
          <span className="text-[0.68rem] text-muted-foreground uppercase">Optional</span>
        )}
        {locked && <Lock className="size-3 text-muted-foreground" aria-hidden="true" />}
      </div>

      {children}

      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && !locked && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- inputs -- */

export function TextField({
  name,
  label,
  locked,
  optional,
  hint,
  placeholder,
  type = 'text',
  maxLength,
  inputMode,
  className,
  transform,
  readOnly = false,
}: {
  name: string
  label: string
  locked: boolean
  optional?: boolean
  hint?: string
  placeholder?: string
  type?: string
  maxLength?: number
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  className?: string
  /**
   * Rewrites the value on every keystroke. Returning a shorter string is what
   * makes a limit a *hard stop* — the character is dropped before it reaches
   * form state, so there is nothing to show an error about.
   */
  transform?: (raw: string) => string
  /** Render disabled and non-editable without dimming it as "locked". */
  readOnly?: boolean
}) {
  const { register, setValue } = useFormContext()
  const field = register(name)

  return (
    <GatedField
      name={name}
      label={label}
      locked={locked}
      optional={optional}
      hint={hint}
      className={className}
    >
      <Input
        id={name}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={locked}
        readOnly={readOnly}
        {...field}
        onChange={
          transform
            ? (event) => {
                const next = transform(event.target.value)
                setValue(name, next, { shouldValidate: true, shouldDirty: true })
              }
            : field.onChange
        }
        className={readOnly ? 'cursor-not-allowed bg-muted/50' : undefined}
      />
    </GatedField>
  )
}

/** A choice whose stored value differs from what the user reads. */
export interface SelectOption {
  value: string
  label: string
}

export type SelectOptions = readonly string[] | readonly SelectOption[]

function normalise(options: SelectOptions): readonly SelectOption[] {
  return options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  )
}

export function SelectField({
  name,
  label,
  locked,
  options,
  placeholder = 'Select an option',
  hint,
  className,
}: {
  name: string
  label: string
  locked: boolean
  /** Plain strings when the value *is* the label, or explicit value/label pairs. */
  options: SelectOptions
  placeholder?: string
  hint?: string
  className?: string
}) {
  const { control } = useFormContext()
  const items = normalise(options)

  return (
    <GatedField name={name} label={label} locked={locked} hint={hint} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            // `items` is what makes the trigger show the *label* after
            // selection. Without it Base UI renders the raw value, which is
            // invisible for string options (value === label) and showed a bare
            // UUID for the bootcamp track.
            items={items}
            // null, not '': Base UI reads an empty string as a *selected*
            // empty value and suppresses the placeholder. The form state keeps
            // '' so the zod enums report "required" rather than "expected
            // string, received null".
            value={field.value ? field.value : null}
            onValueChange={(value) => field.onChange(value ?? '')}
            disabled={locked}
          >
            <SelectTrigger id={name} className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {items.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </GatedField>
  )
}

export function TextareaField({
  name,
  label,
  locked,
  maxLength,
  placeholder,
  className,
}: {
  name: string
  label: string
  locked: boolean
  maxLength: number
  placeholder?: string
  className?: string
}) {
  const { register, watch } = useFormContext()
  const used = (watch(name) as string | undefined)?.length ?? 0

  return (
    <GatedField name={name} label={label} locked={locked} className={className}>
      <textarea
        id={name}
        rows={3}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={locked}
        {...register(name)}
        className="flex w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed"
      />
      <div className="flex justify-end">
        <span
          className={cn(
            'text-[0.7rem] tabular-nums',
            used > maxLength - 20 ? 'text-warning-foreground dark:text-warning' : 'text-muted-foreground',
          )}
        >
          {used} / {maxLength}
        </span>
      </div>
    </GatedField>
  )
}

export function RadioField({
  name,
  label,
  locked,
  options,
}: {
  name: string
  label: string
  locked: boolean
  options: readonly string[]
}) {
  const { control } = useFormContext()

  return (
    <GatedField name={name} label={label} locked={locked}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
            {options.map((option) => {
              const selected = field.value === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={locked}
                  onClick={() => field.onChange(option)}
                  className={cn(
                    'min-w-20 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {option}
                </button>
              )
            })}
          </div>
        )}
      />
    </GatedField>
  )
}
