/**
 * Whether someone is 18 or older on a given day, calendar-correct rather than
 * `days / 365.25` (which drifts a day either side of a birthday).
 *
 * The one age-threshold calculation the app makes — decides the CNIC/B-Form
 * requirement at registration and, later, the Bank/Easypaisa split in
 * onboarding. One definition rather than one per call site, so a future
 * change to the rule cannot update three places and miss a fourth. Mirrors
 * backend/app/core/age.py::is_adult; both must change together.
 *
 * Takes `unknown` because every caller reads this straight out of a form
 * value or an API response, neither of which TypeScript can promise is
 * actually a string.
 */
export function isAdult(dateOfBirth: unknown, today: Date = new Date()): boolean {
  if (typeof dateOfBirth !== "string" || !dateOfBirth) return false
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return false

  let age = today.getFullYear() - dob.getFullYear()
  const monthDelta = today.getMonth() - dob.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) age -= 1
  return age >= 18
}
