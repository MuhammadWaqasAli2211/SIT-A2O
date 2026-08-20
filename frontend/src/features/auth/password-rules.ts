/**
 * Password policy — the single source of truth.
 *
 * Both the zod schema (which gates form submission) and the live checklist
 * component (which shows the user what is still missing) are built from this
 * one array. Adding or changing a rule here updates validation and the UI
 * together, so the two can never drift apart and disagree.
 */

export interface PasswordRule {
  id: string
  label: string
  test: (value: string) => boolean
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lowercase', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'One number', test: (v) => /\d/.test(v) },
  { id: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
] as const

export interface EvaluatedRule extends PasswordRule {
  met: boolean
}

export interface PasswordStrength {
  rules: EvaluatedRule[]
  metCount: number
  total: number
  allMet: boolean
  /** 0–100, for the strength meter. */
  percent: number
  score: 'empty' | 'weak' | 'fair' | 'strong'
}

export function evaluatePassword(value: string): PasswordStrength {
  const rules = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(value) }))
  const metCount = rules.filter((rule) => rule.met).length
  const total = PASSWORD_RULES.length
  const percent = Math.round((metCount / total) * 100)

  let score: PasswordStrength['score'] = 'empty'
  if (value.length > 0) {
    if (metCount === total) score = 'strong'
    else if (metCount >= 3) score = 'fair'
    else score = 'weak'
  }

  return { rules, metCount, total, allMet: metCount === total, percent, score }
}

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}
