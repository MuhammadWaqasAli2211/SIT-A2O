/**
 * Declarations an applicant must accept to submit a bootcamp application.
 *
 * Three, each one sentence. An earlier draft ran to five paragraphs; nobody
 * reads five paragraphs of legalese on a form, and consent that was not read
 * is not meaningfully consent. These condense the same obligations into the
 * three that actually bite: the truth of what was submitted, the commitment
 * being entered into, and the campus dress code.
 *
 * Each stays its own checkbox. Bundling them into one "I agree to everything"
 * would make consent unfalsifiable and leave no record of which term an
 * applicant was actually shown.
 */

/**
 * Identifies the wording below. Sent with the submission and stored beside the
 * acceptance timestamp, so a record says which text was agreed to rather than
 * merely when. Bump this whenever a declaration changes.
 */
export const TERMS_VERSION = '2026-08-22b'

export interface Declaration {
  /** Field name in the form schema, and the column suffix when persisted. */
  id: string
  title: string
  body: string
}

export const DECLARATIONS: readonly Declaration[] = [
  {
    id: 'accuracy',
    title: 'Accuracy',
    body:
      'I declare that everything in this application is true and accurate, and I understand that false information will cancel my admission at any stage.',
  },
  {
    id: 'commitment',
    title: 'Conduct and commitment',
    body:
      'I agree to follow all SMIT rules, attend every scheduled stage on time, and complete the projects assigned to me during the bootcamp.',
  },
  {
    id: 'dress_code',
    title: 'Dress code',
    body:
      'I agree to maintain formal attire while attending classes and any on-campus session.',
  },
]

/**
 * Consent to the published policies. Deliberately not one of the three
 * declarations — it points at documents that can change independently of what
 * the applicant agreed to here.
 */
export const POLICY_CONSENT = {
  id: 'policies',
  title: 'Privacy Policy and Terms of Service',
  body: 'I have read and accept the Privacy Policy and the Terms of Service.',
} as const
