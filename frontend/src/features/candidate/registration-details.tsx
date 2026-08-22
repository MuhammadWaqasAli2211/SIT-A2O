/**
 * The registration answers a candidate gave, shown back to them.
 *
 * These live on `candidate_profiles` and are written when the registration
 * form is submitted — the account page's editable form covers only the
 * handful that predate the form, so without this the other seven look as
 * though they were never saved.
 *
 * Read-only on purpose. The registration form is the single place these are
 * entered; a second editable copy here would let the profile and the submitted
 * application disagree about the same person, with nothing to say which is
 * right.
 */

import { Fingerprint, Hash } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { CandidateProfile } from '@/lib/types'

/** Fields registration owns, in the order the form asks for them. */
const FIELDS: { key: keyof CandidateProfile; label: string }[] = [
  { key: 'father_name', label: "Father's name" },
  { key: 'gender', label: 'Gender' },
  { key: 'phone', label: 'Phone' },
  { key: 'father_phone', label: "Father's phone" },
  { key: 'cnic', label: 'Your CNIC' },
  { key: 'father_cnic', label: "Father's CNIC" },
  { key: 'saylani_roll_number', label: 'Saylani roll number' },
  { key: 'address', label: 'Address' },
]

export function RegistrationDetails({
  candidate,
  candidateCode,
  bootcampName,
}: {
  candidate: CandidateProfile | null
  /** From the application, not the profile — the two live in different tables. */
  candidateCode?: string | null
  bootcampName?: string | null
}) {
  const anyValue = candidate && FIELDS.some(({ key }) => candidate[key])

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-base">Registration details</CardTitle>
        <CardDescription>
          {anyValue
            ? 'Captured when you registered for a bootcamp. Contact an administrator to correct anything here.'
            : 'These fill in automatically once you register for a bootcamp.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {candidateCode && (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Hash className="size-5" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-semibold tracking-widest text-primary uppercase">
                  Candidate code
                </span>
                <span className="font-mono text-2xl font-semibold tracking-tight">
                  {candidateCode}
                </span>
                {bootcampName && (
                  <span className="text-sm text-muted-foreground">{bootcampName}</span>
                )}
              </div>
              <Badge variant="outline" className="ml-auto gap-1.5 font-normal">
                <Fingerprint className="size-3.5" />
                Quote this in every email
              </Badge>
            </div>
            <Separator />
          </>
        )}

        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <dt className="text-sm font-medium">{label}</dt>
              <dd
                className={
                  candidate?.[key]
                    ? 'text-sm text-foreground'
                    : 'text-sm text-muted-foreground/60 italic'
                }
              >
                {candidate?.[key] || 'Not yet provided'}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
