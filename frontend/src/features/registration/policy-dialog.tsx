/**
 * Privacy Policy and Terms of Service, shown in a dialog.
 *
 * A dialog rather than a link because these are read *while* filling the
 * registration form. Navigating away — even to a new tab — risks losing five
 * steps of unsaved answers, since nothing is persisted until submit. That is
 * the whole reason this component still exists now that `/privacy` and
 * `/terms` are real pages: the footer's reader can afford to navigate, and an
 * applicant mid-form cannot.
 *
 * The text itself lives in `lib/policies.ts` and is shared with those pages,
 * so the modal and the page can never say different things.
 */

import { useState, type ReactNode } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { POLICIES, POLICY_EFFECTIVE_DATE, type PolicyKind } from '@/lib/policies'

/**
 * A policy link that opens its own dialog.
 *
 * Self-contained so the declarations list stays declarative — the terms
 * section does not have to hold open/close state for two dialogs.
 */
export function PolicyLink({ kind, children }: { kind: PolicyKind; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const policy = POLICIES[kind]
  const Icon = kind === 'privacy' ? ShieldCheck : FileText

  return (
    <>
      <button
        type="button"
        // stopPropagation: this link sits inside the declaration's checkbox
        // button, and a click here must not also toggle acceptance.
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
        className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {children}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* The close (x) button DialogContent renders is a sibling of this
            component's own children, inside whatever element carries the
            scrolling — putting overflow-y-auto on DialogContent itself (as
            this used to) scrolled the close button away with the text. It
            now scrolls only the inner body, so the button stays fixed to
            the popup regardless of read position. */}
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
          <div className="flex flex-col gap-1.5 border-b border-border px-6 py-4">
            <span className="flex items-center gap-2">
              <Icon className="size-5 text-primary" />
              <DialogTitle className="text-lg">{policy.title}</DialogTitle>
            </span>
            <DialogDescription>{policy.summary}</DialogDescription>
            <span className="text-xs text-muted-foreground">
              Effective {POLICY_EFFECTIVE_DATE}
            </span>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
            {policy.sections.map((section) => (
              <div key={section.heading} className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{section.heading}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
