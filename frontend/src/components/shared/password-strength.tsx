import { AnimatePresence, motion } from 'motion/react'
import { Check, X } from 'lucide-react'

import { evaluatePassword, type PasswordStrength } from '@/features/auth/password-rules'
import { cn } from '@/lib/utils'

const METER_STYLE: Record<PasswordStrength['score'], { bar: string; label: string; text: string }> = {
  empty: { bar: 'bg-muted-foreground/25', label: '', text: 'text-muted-foreground' },
  weak: { bar: 'bg-destructive', label: 'Weak', text: 'text-destructive' },
  fair: { bar: 'bg-warning', label: 'Fair', text: 'text-warning-foreground dark:text-warning' },
  strong: { bar: 'bg-success', label: 'Strong', text: 'text-success' },
}

/**
 * Live password requirement checklist.
 *
 * Rules come from `features/auth/password-rules`, the same source the zod
 * schema uses — so what the user sees ticked off is exactly what gates submit.
 */
export function PasswordStrength({
  value,
  className,
  showMeter = true,
}: {
  value: string
  className?: string
  showMeter?: boolean
}) {
  const strength = evaluatePassword(value)
  const meter = METER_STYLE[strength.score]

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {showMeter && (
        <div className="flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={strength.metCount}
            aria-valuemin={0}
            aria-valuemax={strength.total}
            aria-label="Password strength"
          >
            <motion.div
              className={cn('h-full rounded-full', meter.bar)}
              initial={false}
              animate={{ width: `${strength.percent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {meter.label && (
              <motion.span
                key={strength.score}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className={cn('w-10 shrink-0 text-xs font-medium', meter.text)}
              >
                {meter.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {strength.rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors duration-200',
              rule.met ? 'text-success' : 'text-muted-foreground',
            )}
          >
            <motion.span
              initial={false}
              animate={rule.met ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'grid size-3.5 shrink-0 place-items-center rounded-full transition-colors duration-200',
                rule.met ? 'bg-success text-success-foreground' : 'bg-muted-foreground/20',
              )}
            >
              {rule.met ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" />}
            </motion.span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
