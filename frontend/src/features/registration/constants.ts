/**
 * Reference data for the bootcamp registration form.
 *
 * Kept as plain data rather than fetched: none of it changes per request, and
 * the form must render fully offline of any endpoint while the database layer
 * for this form does not exist yet.
 *
 * `as const` throughout so each list doubles as its own union type — a value
 * that is not in the list cannot typecheck, let alone reach validation.
 */

/** Single option by instruction. Kept as a list so adding a second is additive. */
export const COUNTRIES = ['Pakistan'] as const

/** Single campus by instruction. */
export const CAMPUSES = ['Zaitoon Ashraf IT Park'] as const

export const GENDERS = ['Male', 'Female'] as const

/**
 * The applicant's home city, not the campus city — candidates travel in from
 * across the country to the single campus, so this list is national.
 */
export const CITIES = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan',
  'Hyderabad', 'Peshawar', 'Quetta', 'Gujranwala', 'Sialkot', 'Bahawalpur',
  'Sargodha', 'Sukkur', 'Larkana', 'Sheikhupura', 'Mardan', 'Abbottabad',
  'Mirpur Khas', 'Nawabshah', 'Okara', 'Rahim Yar Khan', 'Jhang',
  'Dera Ghazi Khan', 'Gujrat', 'Kasur', 'Sahiwal', 'Wah Cantt', 'Chiniot',
  'Muzaffarabad', 'Gilgit', 'Other',
] as const

/**
 * Courses offered at Saylani, filtered to IT and technology tracks.
 *
 * Six non-IT vocational courses on the public course list (Plumber Technician,
 * Domestic Electrician, HSE, Fire Alarm System Installation, Office
 * Automation, Little Geniuses) are deliberately excluded: this field asks what
 * the applicant completed as preparation for an IT bootcamp, and those are not
 * that.
 */
export const COURSES = [
  'Modern Web Application Development',
  'Agentic AI',
  'Artificial Intelligence and Data Science',
  'Generative AI & Chatbot',
  'Mobile App Development React Native',
  'Devops Engineer',
  'UI UX Design With AI',
  'Graphic Designing With AI',
  '3D Animation',
  'Video Content Creation',
  'Video Animation',
  'AI & Game Creators',
  'Certified AI & Digital Assets Engineer',
  'Odoo Functional Consultant',
  'Cisco Certified Support Technician Cyber Security',
  'SOC Analyst CyberOps Associate',
  'Cybersecurity Essentials',
  'Networking Essentials',
  'Autocad',
] as const

/** Replaces the reference form's "Class Preference", which does not apply here. */
export const COURSE_STATUSES = ['Completed', 'In Progress'] as const

export const COMPUTER_PROFICIENCY = ['Beginner', 'Intermediate', 'Advanced'] as const

export const QUALIFICATIONS = [
  'Matric', 'Intermediate', 'Bachelors', 'Masters', 'Other',
] as const

export const REFERRAL_SOURCES = [
  'Facebook', 'Instagram', 'YouTube', 'Friend or Family', 'Newspaper',
  'Saylani Campus', 'Other',
] as const

export const LAPTOP_ANSWERS = ['Yes', 'No'] as const

export const UNIVERSITY_ANSWERS = ['Yes', 'No'] as const

/**
 * Eight covers a standard Pakistani bachelor's degree. "Other" catches
 * associate degrees, MPhil, and anyone on a programme that counts differently,
 * without inviting free text that nobody can group later.
 */
export const SEMESTERS = [
  '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', 'Other',
] as const

/**
 * A fixed set rather than free text.
 *
 * The reason this is asked at all is to avoid timetabling a bootcamp session
 * against a candidate's classes, which is a question about which half of the
 * day is taken. Free text ("9-2", "9 AM - 2 PM", "morning shift") answers the
 * same question in a dozen unqueryable spellings.
 */
export const UNIVERSITY_TIMINGS = ['Morning', 'Evening', 'Weekend'] as const

/* ------------------------------------------------------------- picture -- */

export const PICTURE_MAX_BYTES = 1024 * 1024
export const PICTURE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const
export const PICTURE_ACCEPT = '.jpg,.jpeg,.png'

export const PICTURE_RULES = [
  'White or blue background',
  'Face clearly visible, without glasses',
  'JPG, JPEG or PNG, under 1 MB',
] as const

export type Country = (typeof COUNTRIES)[number]
export type Campus = (typeof CAMPUSES)[number]
export type Gender = (typeof GENDERS)[number]
export type City = (typeof CITIES)[number]
export type Course = (typeof COURSES)[number]
export type CourseStatus = (typeof COURSE_STATUSES)[number]
