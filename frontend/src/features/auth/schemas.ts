import { z } from 'zod'

import { isPasswordValid } from '@/features/auth/password-rules'

/**
 * Name characters we accept: any unicode letter, plus the punctuation that
 * legitimately appears in names (O'Brien, Anne-Marie, Md. Rahman). Deliberately
 * unicode-aware so non-Latin names are not rejected.
 */
const NAME_ALLOWED = /^[\p{L}\s'.-]+$/u

/**
 * Each rule is a separate refinement so the user gets a specific message
 * ("Name cannot contain numbers") rather than one vague catch-all.
 */
export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Please enter your full name')
  .max(150, 'Name is too long')
  .refine((v) => !/\d/.test(v), 'Name cannot contain numbers')
  .refine((v) => NAME_ALLOWED.test(v), 'Name cannot contain special characters')
  .refine(
    (v) => v.split(/\s+/).filter(Boolean).length >= 2,
    'Please enter both your first and last name',
  )

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')

/**
 * 72 bytes is bcrypt's ceiling, which Supabase enforces server-side. The
 * per-rule detail is surfaced by the live checklist, so the field-level message
 * stays short rather than repeating all five rules inline.
 */
export const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(72, 'Password cannot exceed 72 characters')
  .refine(isPasswordValid, 'Password does not meet all requirements below')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z
  .object({
    full_name: fullNameSchema,
    email: emailSchema,
    phone: z
      .string()
      .max(30)
      .regex(/^[\d\s()+-]*$/, 'Enter a valid phone number')
      .optional()
      .or(z.literal('')),
    password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  // Attached to confirm_password so the error renders under that field rather
  // than at form level.
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
