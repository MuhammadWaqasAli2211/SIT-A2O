import { Controller, useFormContext } from 'react-hook-form'
import { Check } from 'lucide-react'

import { unlockedCount } from '@/features/registration/fields'
import { PolicyLink } from '@/features/registration/policy-dialog'
import { DECLARATIONS, POLICY_CONSENT } from '@/features/registration/terms'
import { cn } from '@/lib/utils'

export function TermsSection() {
  const { watch } = useFormContext()
  const open = unlockedCount('terms', watch())

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Read each declaration and accept it to continue. Each is recorded
        separately with your application.
      </p>

      {DECLARATIONS.map((declaration, index) => (
        <Declaration
          key={declaration.id}
          name={declaration.id}
          body={declaration.body}
          locked={open < index}
        />
      ))}

      {/* Opens in a dialog rather than navigating: nothing is saved until
          submit, so leaving the page would cost five steps of answers. */}
      <Declaration
        name={POLICY_CONSENT.id}
        locked={open < DECLARATIONS.length}
        body={
          <>
            I have read and accept the{' '}
            <PolicyLink kind="privacy">Privacy Policy</PolicyLink> and the{' '}
            <PolicyLink kind="terms">Terms of Service</PolicyLink>.
          </>
        }
      />
    </div>
  )
}

/**
 * One declaration with its own checkbox.
 *
 * Built from a button rather than an `<input type="checkbox">` because the
 * project has no checkbox primitive and the whole row is the hit target.
 * `role="checkbox"` plus `aria-checked` keeps it announced correctly, and it
 * stays keyboard-operable because it is a real button.
 */
function Declaration({
  name,
  body,
  locked,
}: {
  name: string
  body: React.ReactNode
  locked: boolean
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext()
  const error = errors[name]?.message as string | undefined

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const checked = field.value === true

        return (
          <div
            className={cn(
              'transition-opacity duration-300',
              locked && 'pointer-events-none opacity-45 select-none',
            )}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-labelledby={`${name}-body`}
              disabled={locked}
              onClick={() => field.onChange(!checked)}
              className={cn(
                'flex w-full gap-3 rounded-xl border p-4 text-left transition-colors',
                checked
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border hover:bg-muted/50',
                error && !locked && !checked && 'border-destructive/50',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors',
                  checked
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/40',
                )}
              >
                {checked && <Check className="size-3.5" strokeWidth={3} />}
              </span>

              <span id={`${name}-body`} className="text-sm leading-relaxed">
                {body}
              </span>
            </button>

            {error && !locked && (
              <p role="alert" className="mt-1.5 pl-4 text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
        )
      }}
    />
  )
}
