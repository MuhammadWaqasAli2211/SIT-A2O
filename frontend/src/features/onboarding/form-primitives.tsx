import { CheckCircle2, Download, Plus, RotateCcw, Trash2 } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

/**
 * Shared building blocks for the onboarding forms — digital twins of
 * Saylani's bilingual paper forms. Kept separate from any one form's file
 * because this is the first of several; a section bar, a bilingual label,
 * and a Yes/No pair are not specific to the Background Verification Form.
 */

/** "Name/نام:" — English label, a slash, the Urdu label, in Nastaliq. */
export function BilingualLabel({
  en,
  ur,
  required,
  htmlFor,
}: {
  en: string
  ur: string
  required?: boolean
  htmlFor?: string
}) {
  return (
    <Label htmlFor={htmlFor} className="flex-wrap gap-1 text-[13px] font-normal text-neutral-800">
      <span>{en}</span>
      <span className="text-neutral-400">/</span>
      <span dir="rtl" lang="ur" className="font-urdu text-[15px]">
        {ur}
      </span>
      <span>:</span>
      {required && <span className="text-red-600">*</span>}
    </Label>
  )
}

/** The heavy black bar the source form uses to open each major section. */
export function SectionBar({ en, ur }: { en: string; ur: string }) {
  return (
    <div
      data-slot="section-bar"
      className="flex flex-col items-center gap-0.5 bg-black px-3 py-1.5 text-center sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-center sm:gap-x-2 sm:gap-y-0.5"
    >
      <span className="text-sm font-bold tracking-wide text-white uppercase">{en}</span>
      <span className="hidden text-neutral-400 sm:inline">/</span>
      <span dir="rtl" lang="ur" className="font-urdu text-base text-white">
        {ur}
      </span>
    </div>
  )
}

/** One labelled cell in the form grid — heavy borders, no rounding, no shadow. */
export function FieldCell({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      data-slot="field-cell"
      className={cn(
        "flex min-w-0 flex-col gap-1.5 border border-black/70 px-3.5 py-2.5",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * "Label/لیبل: [value]" on one line, wrapping to a second line only on a
 * narrow viewport — the source form reads as a label immediately followed by
 * its blank on the same line, not a stacked mobile-style field, and this is
 * the shape nearly every field on every one of these paper forms takes.
 */
export function FieldRow({
  en,
  ur,
  required,
  htmlFor,
  className,
  children,
}: {
  en: string
  ur: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <FieldCell
      className={cn("flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-3 gap-y-1.5", className)}
    >
      <BilingualLabel en={en} ur={ur} required={required} htmlFor={htmlFor} />
      <div className="min-w-0 flex-1">{children}</div>
    </FieldCell>
  )
}

/**
 * Onboarding forms are printed-form replicas, not the app's usual green
 * chrome — the checked state reads as black ink, not brand colour, and the
 * hit target is enlarged past the shared component's default so it is
 * obvious at a glance which option is selected. `RadioGroupItem` itself
 * stays generic (default size, primary-coloured) for whatever else in the
 * app adopts it next; this override is scoped to onboarding usage only.
 */
export const onboardingRadioClass =
  "size-5 border-2 border-neutral-500 data-checked:border-black [&_[data-slot=radio-group-item-indicator]]:size-2.5 [&_[data-slot=radio-group-item-indicator]]:bg-black"

/**
 * A Yes/No pair. `shape` follows the source form, which is not internally
 * consistent about this: some pairs are drawn as square checkboxes ("Alive",
 * "Sect"), others as round radio buttons ("Chronic disease", "Police Case",
 * "Any Addiction"). Matching that per field is part of the fidelity this is
 * built for, not an oversight.
 */
export function YesNoGroup({
  value,
  onChange,
  ariaLabel,
  shape = "circle",
}: {
  value: boolean | null
  onChange: (next: boolean) => void
  ariaLabel: string
  shape?: "circle" | "square"
}) {
  return (
    <RadioGroup
      aria-label={ariaLabel}
      value={value === null ? undefined : String(value)}
      onValueChange={(next) => onChange(next === "true")}
      className="flex-nowrap gap-4"
    >
      <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
        <RadioGroupItem value="true" shape={shape} className={onboardingRadioClass} />
        Yes
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
        <RadioGroupItem value="false" shape={shape} className={onboardingRadioClass} />
        No
      </label>
    </RadioGroup>
  )
}

/**
 * Every plain text field on every onboarding form shares this — a visible
 * light-gray box rather than an underline, so it reads as a fillable field
 * and not a printed line. Overrides Input's own default border/radius via
 * className.
 */
export const TEXT_INPUT_CLASS =
  "h-8 rounded-sm border border-neutral-400 bg-white px-2 text-sm text-black focus-visible:border-black focus-visible:ring-2 focus-visible:ring-black/20"
export const TEXT_INPUT_UPPERCASE_CLASS = `${TEXT_INPUT_CLASS} uppercase`

/** Same visible-border treatment, sized to sit inside a `<td>` without
 *  fighting the table's own grid lines. */
export const TABLE_CELL_INPUT_CLASS =
  "h-7 w-full rounded-sm border border-neutral-400 bg-white px-1.5 text-xs text-black outline-none focus-visible:border-black focus-visible:ring-2 focus-visible:ring-black/20"

/**
 * Toolbar shared by every onboarding form: the auto-save status, a reset,
 * and print-to-PDF. Identical between the Background Verification Form and
 * the Employment Application Form, which is what made it worth extracting
 * rather than a second copy-paste.
 */
export function OnboardingToolbar({
  savedAt,
  onClear,
}: {
  savedAt: number | null
  onClear: () => void
}) {
  return (
    <div className="flex items-center justify-between print:hidden">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        {savedAt !== null && (
          <span key={savedAt} className="flex items-center gap-1.5 animate-draft-saved">
            <CheckCircle2 className="size-3.5 text-success" />
            Draft saved
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          <RotateCcw className="size-3.5" />
          Clear form
        </Button>
        <Button type="button" size="sm" onClick={() => window.print()}>
          <Download className="size-3.5" />
          Download as PDF
        </Button>
      </div>
    </div>
  )
}

/**
 * Row-array helpers for the addable tables (Professional Courses, Employment
 * History, Family Details, ...). Plain functions, not a hook with its own
 * `useState`: the row array has to live inside whichever single object the
 * calling form hands to `useDraftAutosave`, or added rows would sit in state
 * the autosave never sees and vanish on reload — the auto-save requirement
 * this whole feature exists for. The tables also differ too much in column
 * shape (a nested Period/From/To header here, a flat one there) to force
 * through one generic `<Table>` component, so only this bookkeeping is
 * shared, not the rendering.
 */
export function addTableRow<T>(rows: T[], emptyRow: T): T[] {
  return [...rows, { ...emptyRow }]
}

export function removeTableRow<T>(rows: T[], index: number, minRows = 1): T[] {
  return rows.length <= minRows ? rows : rows.filter((_, i) => i !== index)
}

export function updateTableRow<T, K extends keyof T>(
  rows: T[],
  index: number,
  key: K,
  value: T[K]
): T[] {
  return rows.map((row, i) => (i === index ? { ...row, [key]: value } : row))
}

/** The "+ Add row" control under an addable table. */
export function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 border-t border-black/70 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 print:hidden"
    >
      <Plus className="size-3.5" />
      {label}
    </button>
  )
}

/** The remove-row control inside a table row, hidden below the minimum. */
export function RemoveRowButton({
  onClick,
  visible,
}: {
  onClick: () => void
  visible: boolean
}) {
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove row"
      className="flex size-6 shrink-0 items-center justify-center rounded-sm text-neutral-400 hover:bg-red-50 hover:text-red-600 print:hidden"
    >
      <Trash2 className="size-3.5" />
    </button>
  )
}

/**
 * A fillable blank embedded mid-sentence in flowing prose — the Half Nama's
 * oath text has names and codes written directly into the paragraph, not
 * pulled out into a labelled field. Deliberately just an underline, not the
 * boxed `TEXT_INPUT_CLASS` look: this is a hole in a sentence, not a form
 * field, and boxing it would misrepresent the source as a field grid it
 * never was.
 */
export function InlineBlank({
  value,
  onChange,
  ariaLabel,
  width = "8rem",
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  width?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      style={{ width }}
      className="inline-block border-0 border-b border-neutral-500 bg-transparent px-1 text-center align-baseline outline-none focus-visible:border-b-2 focus-visible:border-b-black"
    />
  )
}
