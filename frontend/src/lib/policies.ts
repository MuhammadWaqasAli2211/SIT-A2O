/**
 * Privacy Policy and Terms of Service — the text itself, in one place.
 *
 * Lifted out of `features/registration/policy-dialog.tsx` on 2026-09-03, when
 * the footer gained real `/privacy` and `/terms` pages. It now has two
 * readers with genuinely different jobs:
 *
 *   - the registration dialog, read *while* filling the form, where
 *     navigating away would cost five steps of unsaved answers;
 *   - the standalone pages, which a footer link can point at, a visitor can
 *     bookmark or open in a new tab, and a search engine can index.
 *
 * Both render this array. A policy that says one thing in a modal and another
 * on its own page is the failure mode this module exists to make impossible.
 *
 * ## What this text is, and is not
 *
 * Real policy text, not a placeholder. It names every category of data this
 * platform actually collects (see the registration and onboarding schemas),
 * every third party that processes it (Supabase, Gmail, InterviewerAI), and
 * the mechanics that are actually built — per-intake admin scoping, an audit
 * trail, time-limited signed links for photos and documents, the deadline and
 * missed-deadline-explanation flow, and how a B-Form substitutes for a CNIC
 * under 18.
 *
 * It is not a substitute for legal review. This describes the platform's
 * actual practices in plain language and is written to be accurate rather
 * than generic, but a document real applicants accept while submitting a
 * national ID number is worth a lawyer's pass before this goes live to the
 * public — see the project's own security notes on CNIC handling.
 *
 * The contact details quoted in the last section of each policy are the ones
 * in `lib/contact.ts`, several of which are unverified — that file's header
 * says exactly which. Interpolated rather than retyped so correcting them
 * there corrects them here too.
 *
 * POLICY_EFFECTIVE_DATE is display-only today: shown to the reader but not
 * persisted per-applicant the way `TERMS_VERSION` (terms.ts) is for the three
 * declaration checkboxes. If this text changes after real applicants have
 * accepted it, that gap is worth closing with the same version-and-record
 * pattern `terms_version` already uses — a schema change, not a copy change,
 * which is why it is not done here.
 */

import { CONTACT } from '@/lib/contact'

export type PolicyKind = 'privacy' | 'terms'

/** Bump when the wording below changes materially. */
export const POLICY_EFFECTIVE_DATE = '1 September 2026'

export interface PolicySection {
  heading: string
  body: string
}

export interface Policy {
  title: string
  /** One line, shown under the title in both the dialog and the page. */
  summary: string
  sections: PolicySection[]
}

export const POLICIES: Record<PolicyKind, Policy> = {
  privacy: {
    title: 'Privacy Policy',
    summary: 'What Saylani collects when you apply to a bootcamp here, and what happens to it.',
    sections: [
      {
        heading: 'Who this covers',
        body:
          'This policy applies to anyone who creates an account or submits an application on this platform, operated by Saylani Welfare International Trust ("Saylani", "we") for admissions to its IT training bootcamps. Registering for an account and submitting an application are two separate steps; this policy covers what happens to your data at both.',
      },
      {
        heading: 'What we collect at registration',
        body:
          'Your full name and your father’s name, gender, date of birth, city and address, your own phone number and your father’s phone number, your CNIC (or, if you are under 18, your B-Form number instead — see "Applicants under 18" below), your father’s CNIC, your Saylani roll number if you have one, your prior IT course and whether you completed it, your highest qualification, your computer proficiency, whether you own a laptop, whether you are currently a university student (and if so, your semester, institution and class timing), how you heard about the programme, and the photograph you upload.',
      },
      {
        heading: 'What we collect if you are invited to interview or are selected',
        body:
          'If you are invited to sit the AI screening interview, our screening partner InterviewerAI records the session — video, your answers, and periodic proctoring snapshots — and returns a score and report to us; see "Third parties who process your data" below for what that means. If you are selected and reach the onboarding stage, we collect the documents that stage asks for: a copy of your CNIC or B-Form, your father’s and (where applicable) mother’s CNIC, your CV, educational certificates, an experience letter if you have one, and proof of a bank account or Easypaisa account for stipend or payment purposes. The onboarding forms also capture your signature, drawn on-screen.',
      },
      {
        heading: 'Applicants under 18',
        body:
          'If you are under 18 when you apply, we ask for your B-Form number in place of a CNIC, and for your father’s or guardian’s CNIC and phone number as part of your own application record — there is no separate guardian account. Everything else in this policy applies to your data the same way it does to an adult applicant’s.',
      },
      {
        heading: 'Why we collect it',
        body:
          'To assess your eligibility and move your application through each stage; to verify your identity at interviews, onboarding and on campus; to contact you about deadlines, results and next steps; to run the AI screening interview; and, if you are selected, to enrol you and issue any paperwork the bootcamp or Agilytic (our training-records partner) requires.',
      },
      {
        heading: 'Who can see it inside Saylani',
        body:
          'Only staff administering the specific bootcamp you applied to. An administrator for one intake cannot see applicants to a different intake — that separation is enforced by the platform itself, not just by policy. A small number of super-administrators have platform-wide access to operate the system. Every time a staff member views, changes or acts on your record, that action is written to an internal audit trail.',
      },
      {
        heading: 'Third parties who process your data',
        body:
          'Three outside providers handle parts of your data on our behalf, and none of them may use it for their own purposes: Supabase hosts our database, sign-in system and file storage; Google’s Gmail service delivers the emails the platform sends you; and InterviewerAI, our AI screening partner, conducts and records the AI interview if you are invited to one, and reports your score and evidence back to us. Because these providers operate their own infrastructure, some of your data may be stored or processed on servers outside Pakistan as a result.',
      },
      {
        heading: 'Your photograph and uploaded documents',
        body:
          'Stored in a private location, never published, and never directly reachable by a fixed link. Every time your photo or a document is viewed — by you or by authorised staff — the platform issues a fresh link that expires shortly afterward.',
      },
      {
        heading: 'How long we keep it',
        body:
          'For the duration of the intake you applied to, and afterward for as long as reasonably needed for programme reporting, audit records, and alumni contact. If your application does not proceed, your core application record is still kept for these same reasons rather than deleted immediately — you can ask us to delete it sooner; see "Your rights" below.',
      },
      {
        heading: 'Your rights',
        body:
          `You can ask to see the personal data we hold about you, ask us to correct it, or ask us to delete it, by writing to ${CONTACT.email}. We will act on a deletion request unless we have a genuine reason to keep specific records — for example, an audit trail entry, or the enrolment record of someone who completed a bootcamp — in which case we will tell you why.`,
      },
      {
        heading: 'Cookies and staying signed in',
        body:
          'The platform keeps you signed in by storing your session in your browser’s own storage, not in a tracking cookie. We do not use third-party advertising or analytics cookies on this platform.',
      },
      {
        heading: 'Changes to this policy',
        body:
          'We may update this policy as the platform or our processes change. The version in effect when you accepted it is what governs your application; a later update applies going forward, not retroactively.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    summary: 'The rules that apply to creating an account and applying for a bootcamp here.',
    sections: [
      {
        heading: 'Acceptance',
        body:
          'By creating an account or submitting an application on this platform you agree to these terms. If you do not agree, please do not use the platform.',
      },
      {
        heading: 'Eligibility',
        body:
          'You must provide your own real identity documents — your CNIC if you are 18 or older, or your B-Form if you are younger — and, if you are under 18, the application is still yours: it is submitted under your own name with your guardian’s details recorded alongside it, not on your guardian’s account.',
      },
      {
        heading: 'Your account',
        body:
          'Your account is personal to you. You are responsible for everything submitted from it and for keeping your sign-in details private. Do not create more than one account for yourself.',
      },
      {
        heading: 'Applying',
        body:
          'One application per person per open intake. Submitting an application does not guarantee a place — selection is competitive, capacity is limited, and each stage of the process narrows the pool.',
      },
      {
        heading: 'The AI screening interview',
        body:
          'If you are invited to the AI screening stage, you will sit a recorded, proctored interview conducted by our screening partner, InterviewerAI. By taking that interview you consent to being recorded on video and to periodic proctoring snapshots being captured during the session, both of which are used solely to assess and verify your interview.',
      },
      {
        heading: 'Accuracy',
        body:
          'Everything you submit — on the registration form, in the AI interview, and in every onboarding document — must be true. Information later found to be false may end your application at any stage, including after you have been selected or have started the bootcamp.',
      },
      {
        heading: 'Deadlines',
        body:
          'Every stage of the process runs to a deadline shown to you in the platform and, where relevant, in the emails you receive. Missing a stage’s deadline does not automatically fail your application: you will be offered a chance to explain what happened, and a staff member reviews every explanation individually. What it does mean is that your application stays exactly where it is until that happens — it does not silently advance on its own.',
      },
      {
        heading: 'Document submission',
        body:
          'Onboarding documents you upload are reviewed by staff and may be accepted or sent back to you for correction. A document that is unreadable, incomplete, or does not match the identity details on your application may be rejected and will need to be resubmitted.',
      },
      {
        heading: 'Fees',
        body:
          'There is no fee to register or apply through this platform unless a specific programme states otherwise at the point you apply to it.',
      },
      {
        heading: 'Conduct',
        body:
          'You agree not to impersonate another person, submit someone else’s documents as your own, or attempt to access another applicant’s account or data. If selected, you agree to follow the bootcamp’s own rules, including attendance and dress-code requirements shown to you as part of the declarations you accept when you apply.',
      },
      {
        heading: 'Suspension and disqualification',
        body:
          'We may suspend or end your application, or your place in a bootcamp, if these terms are broken, if information you provided is found to be false, or if your conduct puts the programme or another person at risk.',
      },
      {
        heading: 'What the platform is not responsible for',
        body:
          'We are not responsible for delays or failures caused by things outside our reasonable control — for example, an outage at a third-party provider such as Supabase, Google or InterviewerAI, or an issue with your own internet connection or device during the AI interview.',
      },
      {
        heading: 'Changes to these terms',
        body:
          'We may update these terms as the platform or our processes change. The version you accepted is recorded with your application; a later change applies to what you do afterward, not to what you already submitted.',
      },
      {
        heading: 'Governing law',
        body: 'These terms are governed by the laws of Pakistan.',
      },
      {
        heading: 'Contact',
        body:
          `Questions about these terms or the Privacy Policy can be sent to ${CONTACT.email} or, by phone, to ${CONTACT.phone} (${CONTACT.hoursShort}).`,
      },
    ],
  },
}
