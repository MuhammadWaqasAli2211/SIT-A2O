/**
 * Alumni quotes for the auth pages' brand pane.
 *
 * The quote text is the same copy already published on the Success Stories
 * page (`TESTIMONIALS` in `lib/site-data.ts`), but attribution here is by
 * **programme and cohort**, never by employer. The public page attributes
 * these quotes to named companies; repeating that on the auth screens would
 * spread an implied endorsement from real employers who have not given one.
 * A cohort line says the same useful thing — this person finished the course
 * — without borrowing a third party's name to say it.
 *
 * Replace wholesale when real, cleared alumni quotes are available. The shape
 * is deliberately minimal so that swap is a data change and nothing more.
 */

export interface Alum {
  /** Kept short: the pane holds roughly four lines before it starts to crowd. */
  quote: string
  name: string
  /** The programme they completed. */
  programme: string
  /** Which intake, as it would appear on their candidate code. */
  cohort: string
  /** Precomputed rather than derived, so a mononym cannot produce "". */
  initials: string
}

export const ALUMNI: readonly Alum[] = [
  {
    quote:
      'I applied with no coding background at all. Six months later I was writing production React. The instructors never once made me feel behind.',
    name: 'Ayesha Siddiqui',
    programme: 'Web & App Development',
    cohort: 'Bootcamp 05',
    initials: 'AS',
  },
  {
    quote:
      'The batch interview process was the most organised thing I have been through. I knew my slot, my code, and my status at every step.',
    name: 'Bilal Ahmed',
    programme: 'Web & App Development',
    cohort: 'Bootcamp 04',
    initials: 'BA',
  },
  {
    quote:
      'What surprised me was the project work. We built and deployed real applications, so my portfolio was ready before I graduated.',
    name: 'Fatima Khan',
    programme: 'Data Science & AI',
    cohort: 'Bootcamp 05',
    initials: 'FK',
  },
  {
    quote:
      'Completely free, and yet more rigorous than paid courses I had tried. The physical assessment made sure everyone in the room was serious.',
    name: 'Usman Tariq',
    programme: 'Cloud & DevOps',
    cohort: 'Bootcamp 03',
    initials: 'UT',
  },
  {
    quote:
      'I was working days and studying evenings. The schedule made that possible, and the mentors were reachable when I got stuck.',
    name: 'Zainab Ali',
    programme: 'Mobile Development',
    cohort: 'Bootcamp 06',
    initials: 'ZA',
  },
]

/** How long each quote holds before the dial advances. */
export const ROTATION_MS = 4500
