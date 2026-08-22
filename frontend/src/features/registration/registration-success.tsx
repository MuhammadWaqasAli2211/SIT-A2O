/**
 * Confirmation shown once a registration has actually been created.
 *
 * Rendered as a modal because the candidate code is the one thing on this
 * screen they must not miss — a panel further down the page competes with the
 * form they just left, a dialog does not. It is deliberately not dismissable
 * by clicking outside: the code should be read, or copied, before moving on.
 */

import { useState } from 'react'
import { CheckCircle2, Copy, Mail, Radar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import type { RegistrationResult } from '@/features/applications/api'
import { cn } from '@/lib/utils'

export function RegistrationSuccess({ result }: { result: RegistrationResult }) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(result.candidate_code)
      setCopied(true)
      toast.success('Candidate code copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is unavailable on insecure origins. The code is on screen
      // regardless, so this does not deserve an error.
      toast.info(`Your candidate code is ${result.candidate_code}`)
    }
  }

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-success/12 text-success">
            <CheckCircle2 className="size-7" />
          </span>

          <div className="flex flex-col gap-1.5">
            <DialogTitle className="text-xl">Registration successful</DialogTitle>
            <DialogDescription>
              You have applied to {result.bootcamp_name} for {result.program_title}.
            </DialogDescription>
          </div>

          <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 py-4">
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              Your candidate code
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-3xl font-semibold tracking-tight">
                {result.candidate_code}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyCode}
                aria-label="Copy candidate code"
                className="size-8"
              >
                <Copy className={cn('size-4', copied && 'text-success')} />
              </Button>
            </div>
            <p className="max-w-xs px-4 text-xs text-muted-foreground">
              Keep this. It identifies you at every stage — interview, physical
              interview, form, and onboarding.
            </p>
          </div>

          <p className="flex items-start gap-2 text-left text-sm text-muted-foreground">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <span>
              A confirmation has been sent to{' '}
              <span className="font-medium text-foreground">{result.email}</span>.
              You will be emailed again when interview scheduling opens —
              nothing is needed from you until then.
            </span>
          </p>

          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button render={<Link to="/dashboard/track" />} className="flex-1">
              <Radar className="size-4" />
              Track application
            </Button>
            <Button
              render={<Link to="/dashboard" />}
              variant="outline"
              className="flex-1"
            >
              Go to dashboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
