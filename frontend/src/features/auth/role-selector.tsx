import { GraduationCap, Lock, ShieldCheck, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Account-type selector shown on signup.
 *
 * Presentational only — no role is ever sent to the API. Self-service signup
 * always produces a CANDIDATE server-side; accepting a role from the client
 * would be a privilege-escalation hole (see docs/security.md). When admin
 * self-signup is eventually supported it will be an invite flow, so this
 * component's shape does not need to change — only `enabled` flips.
 */

export interface AccountTypeOption {
  id: 'student' | 'admin'
  label: string
  description: string
  icon: LucideIcon
  enabled: boolean
}

export const ACCOUNT_TYPES: readonly AccountTypeOption[] = [
  {
    id: 'student',
    label: 'Student',
    description: 'Apply to a bootcamp and track your application',
    icon: GraduationCap,
    enabled: true,
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Manage bootcamps, candidates, and interviews',
    icon: ShieldCheck,
    enabled: false,
  },
] as const

export function RoleSelector({
  value,
  onChange,
  className,
}: {
  value: AccountTypeOption['id']
  onChange: (id: AccountTypeOption['id']) => void
  className?: string
}) {
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="mb-2 text-sm font-medium">I am signing up as</legend>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {ACCOUNT_TYPES.map((option) => {
          const selected = value === option.id

          return (
            <button
              key={option.id}
              type="button"
              disabled={!option.enabled}
              aria-pressed={selected}
              onClick={() => option.enabled && onChange(option.id)}
              className={cn(
                'group relative flex flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-all duration-200',
                option.enabled && 'cursor-pointer hover:border-primary/50 hover:bg-primary/5',
                selected && option.enabled && 'border-primary bg-primary/8 ring-2 ring-primary/20',
                !selected && option.enabled && 'border-border',
                // Disabled option stays legible: it must read as "not yet",
                // not as broken or invisible.
                !option.enabled && 'cursor-not-allowed border-dashed border-border bg-muted/40',
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-lg transition-colors',
                    selected && option.enabled
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <option.icon className="size-4" />
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    !option.enabled && 'text-muted-foreground',
                  )}
                >
                  {option.label}
                </span>

                {!option.enabled && (
                  <span className="ml-auto flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                    <Lock className="size-2.5" />
                    Coming soon
                  </span>
                )}
              </span>

              <span
                className={cn(
                  'text-xs leading-relaxed',
                  option.enabled ? 'text-muted-foreground' : 'text-muted-foreground/70',
                )}
              >
                {option.description}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
