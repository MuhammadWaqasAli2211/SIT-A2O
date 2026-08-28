import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"

import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("flex items-center gap-4", className)}
      {...props}
    />
  )
}

/**
 * `shape` picks which glyph this option renders as. The source paper forms
 * are not internally consistent — some Yes/No pairs are drawn as square
 * checkboxes, others as round radio buttons — and matching that distinction
 * field-by-field is part of the fidelity these forms are built for.
 */
function RadioGroupItem({
  className,
  shape = "circle",
  ...props
}: RadioPrimitive.Root.Props & { shape?: "circle" | "square" }) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center border border-input bg-transparent shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
        shape === "circle" ? "rounded-full" : "rounded-[3px]",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-item-indicator"
        className={cn(
          "flex items-center justify-center bg-primary",
          shape === "circle" ? "size-2 rounded-full" : "size-2.5 rounded-[1px]"
        )}
      />
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
