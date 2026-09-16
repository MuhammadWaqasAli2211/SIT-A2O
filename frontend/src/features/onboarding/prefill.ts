/**
 * Mapping what we already know about a candidate onto the four onboarding
 * forms.
 *
 * Every value here is a *default*. The candidate can change any of it, because
 * a form may legitimately need something different for its own context — a
 * separate postal address, say. Only `email` stays locked, and it was already
 * read-only before this existed.
 *
 * Precedence, lowest to highest: these defaults, then an already-submitted
 * submission, then a locally saved draft (restored by `useDraftAutosave`
 * after mount). Nothing a candidate typed is ever overwritten by a default.
 */

import type { OnboardingPrefill } from '@/lib/types'

/** Drop empty values so a blank default never shadows a real one. */
function present(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null && value !== undefined && value !== ''),
  )
}

export function backgroundVerificationDefaults(p: OnboardingPrefill) {
  return present({
    photo: p.picture_url,
    fullName: p.full_name,
    cnic: p.cnic,
    fatherName: p.father_name,
    fatherCnic: p.father_cnic,
    dateOfBirth: p.date_of_birth,
    presentAddress: p.address,
    // Same address by default. Most candidates have one; the ones who do not
    // only have to change the second field.
    postalAddress: p.address,
    mobileNumber: p.phone,
    // The father's number is the emergency contact we hold. Editable, since
    // a candidate may prefer someone else.
    emergencyNumber: p.father_phone,
  })
}

export function employmentApplicationDefaults(p: OnboardingPrefill) {
  return present({
    photo: p.picture_url,
    // The track they were admitted to, which is what this form calls the
    // position applied for.
    positionAppliedFor: p.program_title,
    fullName: p.full_name,
    cnic: p.cnic,
    fatherName: p.father_name,
    dateOfBirth: p.date_of_birth,
    gender: p.gender,
    presentAddress: p.address,
    postalAddress: p.address,
    mobileNumber: p.phone,
    emergencyNumber: p.father_phone,
    // Read-only everywhere in this project: it comes from the account.
    email: p.email,
  })
}

export function halfNamaDefaults(p: OnboardingPrefill) {
  return present({
    page1Name: p.full_name,
    page1FatherName: p.father_name,
    page2Name: p.full_name,
    page2FatherName: p.father_name,
    page2CodeNumber: p.candidate_code,
    page2Department: p.program_title,
    page2Designation: p.program_title,
  })
}

export function bankPaymentDefaults(p: OnboardingPrefill) {
  return present({
    // An account is normally in the holder's own name.
    account_title: p.full_name,
    // Easypaisa and JazzCash accounts are the mobile number itself.
    wallet_number: p.phone,
  })
}
