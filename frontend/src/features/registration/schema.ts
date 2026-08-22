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

/** Present-and-valid, or absent. */
export const optionalCnic = z
  .string()
  .trim()
  .regex(CNIC, 'Enter a valid CNIC, e.g. 42101-1234567-1')
  .optional()
  .or(z.literal(''))

/** Required and valid — swapped in once the applicant is 18 or older. */
export const requiredCnic = z
  .string()
  .trim()
  .min(1, 'Your CNIC is required from age 18')
  .regex(CNIC, 'Enter a valid CNIC, e.g. 42101-1234567-1')

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

  // Optional *here*, because whether it is required depends on a date entered
  // in the previous section. The age rule is applied by `registrationSchema`
  // below and by the unlock gate; this shape only says "if present, be valid".
  cnic: optionalCnic,

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
    if (!isEighteenOrOlder(values.date_of_birth) || values.cnic) return
    ctx.addIssue({
      code: 'custom',
      path: ['cnic'],
      message: 'Your CNIC is required from age 18',
    })
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
    'has_laptop', 'picture',
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
