/**
 * Privacy Policy and Terms of Service, shown in a dialog.
 *
 * A dialog rather than a link because these are read *while* filling the form.
 * Navigating away — even to a new tab — risks losing five steps of unsaved
 * answers, since nothing is persisted until submit.
 *
 * The text below is PLACEHOLDER. It describes, in plain language, what the
 * platform actually does with the data the form collects, so a reviewer can
 * see the shape of the document. It is deliberately not written as binding
 * legal language: that has to come from the project owner before launch.
 */

import { useState, type ReactNode } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

export type PolicyKind = 'privacy' | 'terms'

interface Policy {
  title: string
  summary: string
  sections: { heading: string; body: string }[]
}

const POLICIES: Record<PolicyKind, Policy> = {
  privacy: {
    title: 'Privacy Policy',
    summary: 'What we collect when you apply, and what we do with it.',
    sections: [
      {
        heading: 'What we collect',
        body:
          'The details you enter on this form: your name and your father’s name, date of birth, gender, city and address, phone numbers, CNIC numbers where provided, your Saylani roll number, the course you previously completed, your education and computer proficiency, whether you own a laptop, and the photograph you upload.',
      },
      {
        heading: 'Why we collect it',
        body:
          'To assess your application, to identify you at each stage of the process, to contact you about interviews and deadlines, and to create your account if you are selected.',
      },
      {
        heading: 'Who can see it',
        body:
          'Staff administering the bootcamp you applied to. Administrators are scoped to their own intake and cannot see applicants from other intakes.',
      },
      {
        heading: 'How long we keep it',
        body:
          'For the duration of the intake and for as long as the records are needed afterwards for reporting and alumni contact.',
      },
      {
        heading: 'Your photograph',
        body:
          'Stored privately. It is not published, and it is not readable without a time-limited link issued by the platform.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    summary: 'The rules that apply to using this platform and applying here.',
    sections: [
      {
        heading: 'Your account',
        body:
          'Your account is personal to you. You are responsible for what is submitted from it, and for keeping your sign-in details private.',
      },
      {
        heading: 'Applying',
        body:
          'One application per person per intake. Submitting an application does not guarantee a place: selection is competitive and capacity is limited.',
      },
      {
        heading: 'Accuracy',
        body:
          'The information you submit must be true. Information found to be false may end your application at any stage, including after selection.',
      },
      {
        heading: 'Deadlines',
        body:
          'Every stage runs to a deadline. Missing a scheduled stage without notice may end your application, and your place may be offered to another candidate.',
      },
      {
        heading: 'Changes',
        body:
          'These terms may be updated. The version you accepted is recorded with your application.',
      },
    ],
  },
}

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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2">
                <Icon className="size-5 text-primary" />
                <DialogTitle className="text-lg">{policy.title}</DialogTitle>
              </span>
              <DialogDescription>{policy.summary}</DialogDescription>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Placeholder text.</strong> This describes what the
                platform does with your data, but it is not the final legal
                wording and has not been reviewed.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-4">
              {policy.sections.map((section) => (
                <div key={section.heading} className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">{section.heading}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {section.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
