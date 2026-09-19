/**
 * Mapping what we already know about a candidate onto the onboarding forms.
 *
 * Every value here is a *default*. The candidate can change any of it, because
 * a form may legitimately need something different for its own context — a
 * separate postal address, say. Only `email` stays locked, and it was already
 * read-only before this existed.
 *
 * Precedence, lowest to highest: these defaults, then an already-submitted
 * submission, then a locally saved draft (restored by `useDraftAutosave`
 * after mount). Nothing a candidate typed is ever overwritten by a default.
 *
 * Half Nama is deliberately absent. It stays fully manual — the candidate's
 * own Urdu oath, entered by them alone — and has no default function here at
 * all, not an empty one, so a future field added to it can never be silently
 * pre-filled by accident.
 */

import type { OnboardingPrefill } from '@/lib/types'

/** Drop empty values so a blank default never shadows a real one. */
function present(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null && value !== undefined && value !== ''),
  )
}

/**
 * `SegmentedDigitInput` — used for every CNIC, phone and date field on these
 * forms — stores and expects raw digits only, no separators. What this
 * project actually stores is the human-readable form: CNICs and phone
 * numbers with dashes (`"00000-0000100-0"`, `"0334-2800972"`), because that
 * is how they read on every screen that only ever displays them. Handing
 * that straight to a segmented input does not merely fail to fill it — the
 * dashes and the wrong length corrupt the box-by-box layout. Stripping to
 * digits is what the candidate would have typed themselves.
 */
function digitsOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const digits = value.replace(/\D/g, '')
  return digits || undefined
}

/**
 * `date_of_birth` arrives as an ISO date (`"2004-08-23"`) — correct for a
 * date, but not what `SegmentedDigitInput` wants for this field, which is
 * raw `DDMMYYYY` (the same day-month-year order the paper form's boxes are
 * printed in, not ISO's year-first order).
 */
function isoToDdMmYyyy(value: string | null | undefined): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return undefined
  const [, year, month, day] = match
  return `${day}${month}${year}`
}

export function backgroundVerificationDefaults(p: OnboardingPrefill) {
  return present({
    photo: p.picture_url,
    fullName: p.full_name,
    cnic: digitsOnly(p.cnic),
    fatherName: p.father_name,
    fatherCnic: digitsOnly(p.father_cnic),
    dateOfBirth: isoToDdMmYyyy(p.date_of_birth),
    presentAddress: p.address,
    // Same address by default. Most candidates have one; the ones who do not
    // only have to change the second field.
    postalAddress: p.address,
    mobileNumber: digitsOnly(p.phone),
    // The father's number is the emergency contact we hold. Editable, since
    // a candidate may prefer someone else.
    emergencyNumber: digitsOnly(p.father_phone),
  })
}

export function employmentApplicationDefaults(p: OnboardingPrefill) {
  return present({
    photo: p.picture_url,
    // The track they were admitted to, which is what this form calls the
    // position applied for.
    positionAppliedFor: p.program_title,
    fullName: p.full_name,
    cnic: digitsOnly(p.cnic),
    fatherName: p.father_name,
    dateOfBirth: isoToDdMmYyyy(p.date_of_birth),
    gender: p.gender,
    presentAddress: p.address,
    postalAddress: p.address,
    mobileNumber: digitsOnly(p.phone),
    emergencyNumber: digitsOnly(p.father_phone),
    // Read-only everywhere in this project: it comes from the account.
    email: p.email,
  })
}

export function bankPaymentDefaults(p: OnboardingPrefill) {
  return present({
    // An account is normally in the holder's own name.
    account_title: p.full_name,
    // Easypaisa and JazzCash accounts are the mobile number itself, and this
    // field is a plain text input (not a SegmentedDigitInput), so it keeps
    // the dashed, human-readable form rather than being stripped.
    wallet_number: p.phone,
  })
}
