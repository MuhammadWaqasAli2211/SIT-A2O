/**
 * How to reach a human — one definition, used everywhere.
 *
 * The footer, the Contact page, the FAQ's "still need help" panel and the
 * Terms text all quote the same phone number and address. They used to quote
 * it four times in four files, which is how a number gets corrected in three
 * of them.
 *
 * ## Verification status — read before changing any of this
 *
 * Checked 2026-09-03 against Saylani's published details and a live HTTP
 * request per URL. The values below are the ones the site already shipped;
 * they are kept as-is deliberately, pending the real admissions details from
 * the project owner. Do not "fix" them from a search result — several of the
 * plausible-looking replacements belong to the charity's general donation
 * desk, not to a bootcamp admissions team, and would route applicants
 * somewhere nobody is reading for them.
 *
 *   phone     UNVERIFIED. Saylani's published UAN is 111-729-526; the number
 *             below (111-123-444) matches nothing public. Almost certainly a
 *             placeholder from the original build.
 *   email     UNVERIFIED. The published general address is
 *             info@saylaniwelfare.com. `admissions@` may well exist and be
 *             correct for this purpose, but nothing confirms it.
 *   address   Plausible — Saylani's head office is at Bahadurabad, Karachi.
 *   instagram VERIFIED — 200.
 *   youtube   VERIFIED — 200.
 *   linkedin  BROKEN — 404. This account does not exist. The real one is
 *             pk.linkedin.com/company/saylani-welfare-international-trust-official
 *             (verified 200), left unapplied because the correct handle for
 *             *this* programme is the owner's call, not a search result's.
 *   facebook  UNVERIFIABLE — Facebook answers 400 to every non-browser
 *             request, including pages that certainly exist, so neither this
 *             URL nor any alternative can be checked from here.
 */

import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  YoutubeIcon,
} from '@/components/shared/social-icons'

/** Digits only, for `tel:` — kept beside the display form so they cannot drift. */
export const CONTACT = {
  phone: '+92 21 111 123 444',
  phoneHref: 'tel:+922111123444',
  email: 'admissions@saylaniwelfare.com',
  emailHref: 'mailto:admissions@saylaniwelfare.com',
  addressLine: 'Bahadurabad Campus, Main University Road',
  city: 'Karachi',
  /** Shown next to the phone number wherever it appears. */
  hoursShort: 'Mon–Sat, 9:00 – 18:00 PKT',
  replyPromise: 'Replies within one working day',
} as const

export const OFFICE_HOURS = [
  { days: 'Monday – Friday', hours: '9:00 – 18:00' },
  { days: 'Saturday', hours: '10:00 – 16:00' },
  { days: 'Sunday', hours: 'Closed' },
] as const

export const SOCIAL_LINKS = [
  { label: 'Facebook', Icon: FacebookIcon, href: 'https://facebook.com/saylaniwelfare' },
  { label: 'Instagram', Icon: InstagramIcon, href: 'https://instagram.com/saylaniwelfare' },
  { label: 'LinkedIn', Icon: LinkedinIcon, href: 'https://linkedin.com/company/saylaniwelfare' },
  { label: 'YouTube', Icon: YoutubeIcon, href: 'https://youtube.com/@saylaniwelfare' },
] as const
