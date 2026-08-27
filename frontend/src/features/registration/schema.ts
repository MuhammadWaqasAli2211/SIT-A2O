/**
 * Validation for the four registration sections.
 *
 * Split per section rather than one flat schema for two reasons: the Next
 * button validates only the section in front of the user, and progressive
 * field unlocking asks "is *this one* field valid yet?" — which needs the
 * per-field schemas to stay reachable via `.shape`.
 *
 * The shape here is the shape the candidate profile will eventually be built
 * from, so field names are chosen to survive being persisted unchanged.
 */

import { z } from 'zod'

/**
 * Age on the day of applying, calendar-correct.
 *
 * Duplicated deliberately from `fields.tsx` rather than imported: schema.ts is
 * the validation layer and importing from a component module would make the
 * dependency point the wrong way. Both call sites are one expression and are
 * tested by the same submit.
 */
function isEighteenOrOlder(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false
  const dob = new Date(value)
  if (Number.isNaN(dob.getTime())) return false
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1
  return age >= 18
}

import {
  CAMPUSES,
  CITIES,
  COMPUTER_PROFICIENCY,
  COUNTRIES,
  COURSES,
  COURSE_STATUSES,
  GENDERS,
  LAPTOP_ANSWERS,
  PICTURE_MAX_BYTES,
  PICTURE_TYPES,
  QUALIFICATIONS,
  REFERRAL_SOURCES,
  SEMESTERS,
  UNIVERSITY_ANSWERS,
  UNIVERSITY_TIMINGS,
} from '@/features/registration/constants'
import { DECLARATIONS, POLICY_CONSENT } from '@/features/registration/terms'

/** Hard-capped at the input as well, so this bound is a backstop, not the UX. */
export const ROLL_NUMBER_MAX = 6

/** Unicode-aware, matching the signup form: O'Brien and Anne-Marie are names. */
const NAME_ALLOWED = /^[\p{L}\s'.-]+$/u

/** 03xx-xxxxxxx and the common variants people actually type. */
const PK_PHONE = /^(\+92|0)?3\d{2}[\s-]?\d{7}$/

/** 13 digits, hyphens optional. */
const CNIC = /^\d{5}-?\d{7}-?\d$/

/**
 * The applicant's own identity number. Always required — only *which*
 * document it is changes with age.
 *
 * An earlier version made this optional for minors, which left the record with
 * no way to identify them at all. Under 18 the answer is a B-Form rather than
 * nothing: every Pakistani child has one, and it carries the same 13-digit
 * format as a CNIC.
 */
export const cnicSchema = z
  .string()
  .trim()
  .min(1, 'Your CNIC is required')
  .regex(CNIC, 'Enter a valid CNIC, e.g. 42101-1234567-1')

export const bFormSchema = z
  .string()
  .trim()
  .min(1, 'Your B-Form number is required')
  .regex(CNIC, 'Enter a valid B-Form number, e.g. 42101-1234567-1')

function personName(label: string) {
  return z
    .string()
    .trim()
    .min(2, `${label} is required`)
    .max(100, `${label} is too long`)
    .refine((v) => !/\d/.test(v), `${label} cannot contain numbers`)
    .refine((v) => NAME_ALLOWED.test(v), `${label} cannot contain special characters`)
}

function phone(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(PK_PHONE, 'Enter a valid Pakistani mobile number, e.g. 0300-1234567')
}

/* ------------------------------------------- 1. location and course -- */

export const locationSchema = z.object({
  // Which track they are applying FOR — distinct from `course`, which is what
  // they already completed. The API cannot create an application without it.
  program_id: z.string().uuid({ message: 'Select the track you are applying for' }),
  country: z.enum(COUNTRIES, { message: 'Select your country' }),
  gender: z.enum(GENDERS, { message: 'Select your gender' }),
  city: z.enum(CITIES, { message: 'Select your city' }),
  course: z.enum(COURSES, { message: 'Select the course you took at Saylani' }),
  course_status: z.enum(COURSE_STATUSES, { message: 'Select the status of that course' }),
  campus: z.enum(CAMPUSES, { message: 'Select your campus' }),
})

/* -------------------------------------------------- 2. about you -- */

export const identitySchema = z.object({
  full_name: personName('Full name'),
  father_name: personName("Father's name"),
  date_of_birth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')
    .refine((v) => new Date(v) < new Date(), 'Date of birth must be in the past')
    .refine(
      (v) => new Date(v) > new Date('1925-01-01'),
      'Enter a valid date of birth',
    ),
  saylani_roll_number: z
    .string()
    .trim()
    .min(1, 'Saylani roll number is required')
    .max(ROLL_NUMBER_MAX, `Roll number cannot exceed ${ROLL_NUMBER_MAX} digits`)
    .regex(/^\d+$/, 'Roll number must contain digits only'),
})

/* --------------------------------------------- 3. contact and identity -- */

export const contactSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  phone: phone('Phone number'),
  father_phone: phone("Father's phone number"),

  // Required either way. The section schema carries the CNIC wording as the
  // default; the unlock gate swaps in the B-Form variant for a minor, and
  // `registrationSchema` re-checks below so the message matches the label the
  // applicant was actually shown.
  cnic: cnicSchema,

  // Required — a guardian's CNIC is always available even when the
  // applicant's is not.
  father_cnic: z
    .string()
    .trim()
    .min(1, "Father's CNIC is required")
    .regex(CNIC, 'Enter a valid CNIC, e.g. 42101-1234567-1'),

  address: z
    .string()
    .trim()
    .min(10, 'Enter your full address')
    .max(220, 'Address cannot exceed 220 characters'),
})

/* ------------------------------------- 4. education and technical -- */

export const educationSchema = z.object({
  computer_proficiency: z.enum(COMPUTER_PROFICIENCY, {
    message: 'Select your computer proficiency',
  }),
  last_qualification: z.enum(QUALIFICATIONS, { message: 'Select your last qualification' }),
  referral_source: z.enum(REFERRAL_SOURCES, { message: 'Tell us how you heard about us' }),
  has_laptop: z.enum(LAPTOP_ANSWERS, { message: 'Let us know if you have a laptop' }),

  is_university_student: z.enum(UNIVERSITY_ANSWERS, {
    message: 'Let us know if you are currently at university',
  }),

  // Only asked of university students, so they cannot be required outright.
  // `registrationSchema` requires them when the answer is Yes, and the unlock
  // gate is given the same rule so the two agree.
  university_semester: z.enum(SEMESTERS).optional().or(z.literal('')),
  university_name: z.string().trim().max(150, 'University name is too long').optional().or(z.literal('')),
  university_timing: z.enum(UNIVERSITY_TIMINGS).optional().or(z.literal('')),

  // A File rather than a data URL: nothing is uploaded yet, and holding a
  // megabyte of base64 in form state would be paid for on every keystroke.
  picture: z
    .instanceof(File, { message: 'Upload a picture of yourself' })
    .refine((f) => f.size <= PICTURE_MAX_BYTES, 'Picture must be under 1 MB')
    .refine(
      (f) => (PICTURE_TYPES as readonly string[]).includes(f.type),
      'Picture must be a JPG, JPEG or PNG',
    ),
})

/* ------------------------------------------------------- 5. terms -- */

/**
 * Built from the declaration list so the two cannot drift: adding a
 * declaration to `terms.ts` adds its checkbox *and* its requirement here.
 */
const acceptance = z.literal(true, { message: 'This must be accepted to continue' })

export const termsSchema = z.object(
  Object.fromEntries(
    [...DECLARATIONS.map((d) => d.id), POLICY_CONSENT.id].map((id) => [id, acceptance]),
  ) as Record<string, typeof acceptance>,
)

/* ------------------------------------------------------- combined -- */

/**
 * The whole form.
 *
 * The CNIC rule lives here rather than on `contactSchema` because it reads a
 * field from a different section: an applicant who is 18 or older must supply
 * their own CNIC, while a younger one may not have been issued one yet.
 * `path: ['cnic']` puts the message under the field it concerns.
 */
export const registrationSchema = locationSchema
  .extend(identitySchema.shape)
  .extend(contactSchema.shape)
  .extend(educationSchema.shape)
  .extend(termsSchema.shape)
  .superRefine((values, ctx) => {
    // `termsSchema` is built from `Object.fromEntries` and so carries an index
    // signature, which widens every sibling key to its value type once
    // extended in. Reading through an explicit record restores the real
    // shapes rather than fighting the inference.
    const v = values as Record<string, unknown>

    // The identity field is required either way; only the wording differs, so
    // an empty one is reported in the terms the applicant was shown.
    if (!v.cnic) {
      ctx.addIssue({
        code: 'custom',
        path: ['cnic'],
        message: isEighteenOrOlder(v.date_of_birth)
          ? 'Your CNIC is required'
          : 'Your B-Form number is required',
      })
    }

    // University details are asked only of university students, and are then
    // all required — a half-answered block is worse than none.
    if (v.is_university_student === 'Yes') {
      for (const [field, message] of [
        ['university_semester', 'Select your current semester'],
        ['university_name', 'Enter your university name'],
        ['university_timing', 'Select when your classes run'],
      ] as const) {
        if (!v[field]) {
          ctx.addIssue({ code: 'custom', path: [field], message })
        }
      }
    }
  })

export type LocationValues = z.infer<typeof locationSchema>
export type IdentityValues = z.infer<typeof identitySchema>
export type ContactValues = z.infer<typeof contactSchema>
export type EducationValues = z.infer<typeof educationSchema>
export type RegistrationValues = z.infer<typeof registrationSchema>

/** Field order per section — drives progressive unlocking and Next validation. */
export const SECTION_FIELDS = {
  location: ['program_id', 'country', 'gender', 'city', 'course', 'course_status', 'campus'],
  identity: ['full_name', 'father_name', 'date_of_birth', 'saylani_roll_number'],
  contact: ['email', 'phone', 'father_phone', 'cnic', 'father_cnic', 'address'],
  education: [
    'computer_proficiency', 'last_qualification', 'referral_source',
    'has_laptop', 'is_university_student', 'university_semester',
    'university_name', 'university_timing', 'picture',
  ],
  terms: [...DECLARATIONS.map((d) => d.id), POLICY_CONSENT.id],
} as const satisfies Record<string, readonly string[]>

export const SECTION_SCHEMAS = {
  location: locationSchema,
  identity: identitySchema,
  contact: contactSchema,
  education: educationSchema,
  terms: termsSchema,
} as const

export type SectionKey = keyof typeof SECTION_FIELDS
