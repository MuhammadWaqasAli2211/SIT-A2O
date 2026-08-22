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
import { cn } from '@/lib/utils'

/** Index of the first field in the section that does not yet validate. */
export function unlockedCount(section: SectionKey, values: Record<string, unknown>): number {
  const shape = SECTION_SCHEMAS[section].shape as Record<string, z.ZodTypeAny>
  const order = SECTION_FIELDS[section] as readonly string[]

  for (let i = 0; i < order.length; i += 1) {
    const key = order[i]
    const fieldSchema = key ? shape[key] : undefined
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
}) {
  const { register } = useFormContext()

  return (
    <GatedField name={name} label={label} locked={locked} optional={optional} hint={hint} className={className}>
      <Input
        id={name}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={locked}
        aria-invalid={undefined}
        {...register(name)}
      />
    </GatedField>
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
  options: readonly string[]
  placeholder?: string
  hint?: string
  className?: string
}) {
  const { control } = useFormContext()

  return (
    <GatedField name={name} label={label} locked={locked} hint={hint} className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
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
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
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
