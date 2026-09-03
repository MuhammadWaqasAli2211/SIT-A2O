import { cn } from '@/lib/utils'

/**
 * A small styled toggle.
 *
 * Started life as a local helper in the interview-invite dialog, promoted
 * here when the AI permissions screen needed the same control — two copies of
 * a toggle drift in exactly the way that makes one of them feel broken.
 *
 * A real `<button role="switch">` rather than a styled checkbox, so it is
 * announced and operated as a switch.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  ...props
}: {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  disabled?: boolean
  className?: string
} & Omit<React.ComponentPropsWithoutRef<'button'>, 'onClick' | 'type' | 'disabled'>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted-foreground/25',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          // `left-0` is load-bearing, not decoration. Without a horizontal
          // anchor an absolutely-positioned element falls back to its *static*
          // position — and a <button> centres its content — so the thumb
          // started mid-pill and the checked translate pushed it clean off the
          // right edge. It then sat on top of whatever followed the switch:
          // the phase toggle's "Open" label rendered as "pen", because a white
          // thumb on a white background covers a letter without looking like
          // anything. Anchoring left makes both translate values exact:
          // 2px in (off) and 22px in (on) inside a 44px track.
          'absolute top-0.5 left-0 size-5 rounded-full bg-white shadow-sm transition-transform',
          'motion-reduce:transition-none',
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
