/**
 * Compact 4-node step indicator for the Onboarding Form section — shows
 * all 4 forms, their status, and lets the candidate jump to any unlocked
 * one directly.
 *
 * A 7-column CSS grid (node, connector, node, connector, ...) rather than
 * a flex row keeps each label pinned directly under its own node without
 * measuring anything — the connector columns simply have no label cell.
 */
import { Briefcase, Check, Landmark, Lock, RotateCcw, ScrollText, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  ONBOARDING_FORM_LABEL,
  ONBOARDING_FORM_ORDER,
  ONBOARDING_FORM_SLUG,
  type OnboardingFormRow,
  type OnboardingFormType,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const FORM_ICON: Record<OnboardingFormType, LucideIcon> = {
  BACKGROUND_VERIFICATION: ShieldCheck,
  EMPLOYMENT_APPLICATION: Briefcase,
  HALF_NAMA: ScrollText,
  BANK_PAYMENT_DETAILS: Landmark,
}

const SHORT_LABEL: Record<OnboardingFormType, string> = {
  BACKGROUND_VERIFICATION: 'Background',
  EMPLOYMENT_APPLICATION: 'Employment',
  HALF_NAMA: 'Half Nama',
  BANK_PAYMENT_DETAILS: 'Account Details',
}

export function OnboardingStepIndicator({
  rows,
  active,
}: {
  rows: OnboardingFormRow[]
  active: OnboardingFormType
}) {
  const byType = new Map(rows.map((row) => [row.form_type, row]))
  const lastIndex = ONBOARDING_FORM_ORDER.length - 1

  return (
    <div className="grid items-center gap-y-2">
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-center">
        {ONBOARDING_FORM_ORDER.flatMap((formType, index) => {
          const row = byType.get(formType)
          const cells = [
            <Node key={`node-${formType}`} formType={formType} row={row} isActive={formType === active} />,
          ]
          if (index < lastIndex) {
            const filled = row?.submission?.status === 'SUBMITTED'
            cells.push(
              <span
                key={`conn-${formType}`}
                aria-hidden="true"
                className={cn('mx-1 h-0.5 rounded-full transition-colors sm:mx-2', filled ? 'bg-success' : 'bg-border')}
              />,
            )
          }
          return cells
        })}
      </div>

      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-start">
        {ONBOARDING_FORM_ORDER.flatMap((formType, index) => {
          const isActive = formType === active
          const cells = [
            <span
              key={`label-${formType}`}
              className={cn(
                'justify-self-center text-center text-[0.7rem] leading-tight',
                isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {SHORT_LABEL[formType]}
            </span>,
          ]
          if (index < lastIndex) cells.push(<span key={`label-gap-${formType}`} aria-hidden="true" />)
          return cells
        })}
      </div>
    </div>
  )
}

function Node({
  formType,
  row,
  isActive,
}: {
  formType: OnboardingFormType
  row: OnboardingFormRow | undefined
  isActive: boolean
}) {
  const Icon = FORM_ICON[formType]
  const submitted = row?.submission?.status === 'SUBMITTED'
  const reopened = row?.submission?.status === 'REOPENED'
  const unlocked = row?.unlocked ?? false

  const node = (
    <span
      title={ONBOARDING_FORM_LABEL[formType]}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors sm:size-10',
        submitted && 'border-success bg-success text-success-foreground',
        reopened && 'border-warning bg-warning/15 text-warning-foreground dark:text-warning',
        !submitted &&
          !reopened &&
          unlocked &&
          (isActive
            ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25'
            : 'border-border bg-card text-foreground'),
        !unlocked && 'border-dashed border-border bg-muted text-muted-foreground/50',
      )}
    >
      {submitted ? (
        <Check className="size-4" strokeWidth={3} />
      ) : reopened ? (
        <RotateCcw className="size-4" />
      ) : !unlocked ? (
        <Lock className="size-3.5" />
      ) : (
        <Icon className="size-4" />
      )}
    </span>
  )

  if (!unlocked) return <span className="justify-self-center">{node}</span>

  return (
    <Link
      to={`/dashboard/documents/forms/${ONBOARDING_FORM_SLUG[formType]}`}
      aria-current={isActive ? 'step' : undefined}
      className="justify-self-center"
    >
      {node}
    </Link>
  )
}
