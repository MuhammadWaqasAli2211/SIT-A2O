import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Password field with a show/hide toggle.
 *
 * `forwardRef` so react-hook-form's `register()` can attach its ref — without
 * it the field would be uncontrolled from RHF's perspective and never validate.
 */
export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<typeof Input>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false)

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          // Excluded from the tab order: keyboard users tabbing through the
          // form should land on the next field, not a visibility toggle.
          tabIndex={-1}
          className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    )
  },
)
