/**
 * One candidate's onboarding submission, in a modal.
 *
 * The content is `OnboardingSubmissionView` — the same component
 * /admin/onboarding renders, with the same four tabs and the same form
 * components the candidate filled in. Nothing about the submission is
 * re-implemented for this screen.
 *
 * Read-only by design. Reopening a form is a write with an audit entry and a
 * consequence the candidate sees; it stays on /admin/onboarding, which is
 * built around reviewing and acting. A second place to do it would be a
 * second thing to keep consistent, so this dialog links there instead.
 *
 * Mounted only while open (`open && ...`), which is what makes the fetch
 * lazy: the view fetches on mount, so a closed dialog costs nothing and a
 * table of fifty candidates pulls no paperwork until someone asks for a row.
 */

import { ExternalLink, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OnboardingSubmissionView } from '@/features/onboarding/submission-view'
import type { HrAssessmentRow } from '@/lib/types'

export function OnboardingFormDialog({
  row,
  onClose,
}: {
  row: HrAssessmentRow | null
  onClose: () => void
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(next) => !next && onClose()}>
      {/* `sm:max-w-*`, not a bare `max-w-*`: the base dialog caps width at
          `sm:max-w-sm`, and Tailwind emits every `sm:` utility in one media
          block after the unprefixed ones — so an unprefixed override loses
          the cascade and the dialog silently stays 384px wide. Same trap the
          evidence modal documents. */}
      <DialogContent className="flex h-[85vh] max-h-[46rem] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {row && (
          <>
            <DialogHeader className="shrink-0 border-b border-border p-5">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                {row.full_name ?? 'Unnamed candidate'}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono">{row.candidate_code}</span>
                <span aria-hidden>·</span>
                <span>
                  {row.forms_submitted}/{row.forms_total} forms submitted
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <OnboardingSubmissionView
                applicationId={row.application_id}
                // The roll-up row carries no date of birth, and fetching the
                // whole application just to pick which bank-details variant
                // to label would be a second request per open. Null means
                // "treat as adult", the same default the admin detail page
                // falls back to when it is missing.
                dateOfBirth={null}
              />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border p-4">
              <p className="text-xs text-muted-foreground">
                Read-only. Reopen a form from the onboarding folder.
              </p>
              <Button
                render={<Link to={`/admin/onboarding/${row.application_id}`} />}
                variant="outline"
                size="sm"
              >
                <ExternalLink className="size-3.5" />
                Open onboarding folder
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
