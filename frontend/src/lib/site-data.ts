/**
 * Marketing site content.
 *
 * Kept in one module so copy, navigation, and programme details can be edited
 * without touching layout code. When the bootcamps API lands in Phase 2, the
 * `PROGRAMS` array is the piece that becomes a fetch.
 */

import {
  Award,
  BookOpen,
  Bot,
  Braces,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Cloud,
  Database,
  HeartHandshake,
  Info,
  LayoutGrid,
  LifeBuoy,
  LogIn,
  Newspaper,
  Palette,
  Phone,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Star,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavChild {
  label: string
  description: string
  href: string
  icon: LucideIcon
}

export interface NavItem {
  label: string
  href?: string
  children?: NavChild[]
  /** Renders the dropdown as a two-column feature panel rather than a list. */
  featured?: boolean
  /** Small leading glyph in the header row. */
  icon?: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Programs',
    icon: LayoutGrid,
    featured: true,
    children: [
      {
        label: 'Web & App Development',
        description: 'MERN stack, from fundamentals to deployment',
        href: '/programs/web-development',
        icon: Braces,
      },
      {
        label: 'Mobile Development',
        description: 'React Native and Flutter for Android and iOS',
        href: '/programs/mobile-development',
        icon: Smartphone,
      },
      {
        label: 'Data Science & AI',
        description: 'Python, machine learning, and applied analytics',
        href: '/programs/data-science',
        icon: Database,
      },
      {
        label: 'Cloud & DevOps',
        description: 'Docker, CI/CD, and cloud infrastructure',
        href: '/programs/cloud-devops',
        icon: Cloud,
      },
      {
        label: 'UI/UX Design',
        description: 'Product thinking, Figma, and design systems',
        href: '/programs/ui-ux-design',
        icon: Palette,
      },
      {
        label: 'All Programs',
        description: 'Browse the full catalogue and compare tracks',
        href: '/programs',
        icon: BookOpen,
      },
    ],
  },
  {
    label: 'Admissions',
    icon: ScrollText,
    children: [
      {
        label: 'How to Apply',
        description: 'Every stage, start to finish',
        href: '/admissions',
        icon: ScrollText,
      },
      {
        label: 'Eligibility',
        description: 'Who can apply and what you need',
        href: '/admissions#eligibility',
        icon: Target,
      },
      {
        label: 'Important Dates',
        description: 'Deadlines for the current intake',
        href: '/admissions#dates',
        icon: Newspaper,
      },
      {
        label: 'FAQs',
        description: 'Answers to the questions we get most',
        href: '/faq',
        icon: LifeBuoy,
      },
    ],
  },
  {
    label: 'About',
    icon: Info,
    children: [
      {
        label: 'Our Mission',
        description: 'Free, world-class IT education for everyone',
        href: '/about',
        icon: HeartHandshake,
      },
      {
        label: 'Success Stories',
        description: 'Where our graduates are working now',
        href: '/success-stories',
        icon: Award,
      },
      {
        label: 'Our Campuses',
        description: 'Locations across Pakistan',
        href: '/about#campuses',
        icon: Building2,
      },
      {
        label: 'Contact Us',
        description: 'Talk to the admissions team',
        href: '/contact',
        icon: Phone,
      },
    ],
  },
  { label: 'Success Stories', href: '/success-stories', icon: Star },
  {
    label: 'Resources',
    icon: LifeBuoy,
    children: [
      {
        label: 'FAQs',
        description: 'Answers to the questions we get most',
        href: '/faq',
        icon: LifeBuoy,
      },
      {
        label: 'Important Dates',
        description: 'Deadlines for the current intake',
        href: '/admissions#dates',
        icon: Newspaper,
      },
      {
        label: 'Contact Us',
        description: 'Talk to the admissions team',
        href: '/contact',
        icon: Phone,
      },
      {
        label: 'Student Portal',
        description: 'Sign in to track your application',
        href: '/login',
        icon: LogIn,
      },
    ],
  },
]

/* -------------------------------------------------------------- programs -- */

export interface Program {
  slug: string
  title: string
  tagline: string
  description: string
  icon: LucideIcon
  duration: string
  mode: string
  level: string
  seats: number
  skills: string[]
  outcomes: string[]
  curriculum: { module: string; topics: string[] }[]
  accent: string
  /**
   * The track's own accent, as a CSS variable reference.
   *
   * A `var(...)` string rather than a Tailwind class because the "Choose
   * your track" section feeds it to `color-mix()` in an inline style to
   * build each panel's tint — a class name cannot be mixed. Kept beside
   * `accent` (a Tailwind gradient pair, used by the hover wash on the
   * /programs grid) rather than replacing it: the two are consumed by
   * different components in different ways.
   *
   * Defined in index.css as --track-1..5, in track order.
   */
  accentVar: string
}

export const PROGRAMS: Program[] = [
  {
    slug: 'web-development',
    title: 'Web & App Development',
    tagline: 'Build production-grade web applications with the MERN stack',
    description:
      'A full-stack track covering modern JavaScript, React, Node.js, and databases. You finish with deployed projects, a portfolio, and the workflow habits teams actually expect.',
    icon: Braces,
    duration: '6 months',
    mode: 'On-campus + Online',
    level: 'Beginner friendly',
    seats: 300,
    skills: ['HTML & CSS', 'JavaScript', 'React', 'Node.js', 'MongoDB', 'Git'],
    outcomes: [
      'Ship full-stack applications end to end',
      'Work confidently with REST APIs and databases',
      'Collaborate using Git and code review',
      'Deploy and monitor a live production app',
    ],
    curriculum: [
      { module: 'Foundations', topics: ['HTML5 & semantics', 'CSS & Flexbox/Grid', 'Responsive design', 'Git & GitHub'] },
      { module: 'JavaScript Deep Dive', topics: ['ES6+ syntax', 'Async & promises', 'DOM & events', 'Modules & tooling'] },
      { module: 'Frontend with React', topics: ['Components & state', 'Hooks', 'Routing', 'State management'] },
      { module: 'Backend with Node', topics: ['Express fundamentals', 'REST API design', 'Authentication', 'Error handling'] },
      { module: 'Databases', topics: ['MongoDB & Mongoose', 'Schema design', 'Aggregation', 'Indexing basics'] },
      { module: 'Capstone', topics: ['Team project', 'Code review', 'CI/CD basics', 'Deployment'] },
    ],
    accent: 'from-blue-500/20 to-indigo-500/5',
    accentVar: 'var(--color-track-1)',
  },
  {
    slug: 'mobile-development',
    title: 'Mobile Development',
    tagline: 'Ship cross-platform apps for Android and iOS',
    description:
      'Learn to build, test, and publish mobile applications using React Native and Flutter, with a focus on performance and real device testing.',
    icon: Smartphone,
    duration: '5 months',
    mode: 'On-campus',
    level: 'Some coding helpful',
    seats: 150,
    skills: ['React Native', 'Flutter', 'Dart', 'REST APIs', 'App Store deployment'],
    outcomes: [
      'Build cross-platform apps from a single codebase',
      'Handle navigation, storage, and device APIs',
      'Debug on real hardware',
      'Publish to Play Store and App Store',
    ],
    curriculum: [
      { module: 'Mobile Foundations', topics: ['Mobile UX patterns', 'Environment setup', 'Emulators & devices'] },
      { module: 'React Native', topics: ['Core components', 'Navigation', 'Native modules', 'Performance'] },
      { module: 'Flutter & Dart', topics: ['Dart language', 'Widget tree', 'State management', 'Animations'] },
      { module: 'Backend Integration', topics: ['REST & JSON', 'Auth flows', 'Offline storage', 'Push notifications'] },
      { module: 'Release', topics: ['App signing', 'Store listings', 'Crash reporting', 'Versioning'] },
    ],
    accent: 'from-sky-500/20 to-blue-500/5',
    accentVar: 'var(--color-track-2)',
  },
  {
    slug: 'data-science',
    title: 'Data Science & AI',
    tagline: 'Turn raw data into decisions with Python and machine learning',
    description:
      'From Python fundamentals through statistics, visualisation, and applied machine learning — with projects drawn from real datasets rather than toy examples.',
    icon: Database,
    duration: '6 months',
    mode: 'On-campus + Online',
    level: 'Maths basics required',
    seats: 200,
    skills: ['Python', 'Pandas', 'NumPy', 'scikit-learn', 'SQL', 'Visualisation'],
    outcomes: [
      'Clean and analyse messy real-world data',
      'Build and evaluate predictive models',
      'Communicate findings visually',
      'Deploy a model behind an API',
    ],
    curriculum: [
      { module: 'Python for Data', topics: ['Python basics', 'NumPy', 'Pandas', 'Notebooks'] },
      { module: 'Statistics', topics: ['Descriptive stats', 'Probability', 'Hypothesis testing', 'Distributions'] },
      { module: 'Visualisation', topics: ['Matplotlib', 'Seaborn', 'Dashboards', 'Storytelling with data'] },
      { module: 'Machine Learning', topics: ['Regression', 'Classification', 'Model evaluation', 'Feature engineering'] },
      { module: 'Applied AI', topics: ['NLP basics', 'Intro to deep learning', 'Model deployment'] },
    ],
    accent: 'from-cyan-500/20 to-sky-500/5',
    accentVar: 'var(--color-track-3)',
  },
  {
    slug: 'cloud-devops',
    title: 'Cloud & DevOps',
    tagline: 'Automate delivery and run infrastructure that scales',
    description:
      'Containerisation, pipelines, and cloud fundamentals — the operational skills that make the difference between code that runs locally and software that serves users.',
    icon: Cloud,
    duration: '4 months',
    mode: 'Online',
    level: 'Intermediate',
    seats: 120,
    skills: ['Linux', 'Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Monitoring'],
    outcomes: [
      'Containerise and orchestrate applications',
      'Build automated deployment pipelines',
      'Provision cloud infrastructure as code',
      'Monitor and troubleshoot live systems',
    ],
    curriculum: [
      { module: 'Linux & Networking', topics: ['Shell', 'Permissions', 'Networking basics', 'SSH'] },
      { module: 'Containers', topics: ['Docker', 'Images & registries', 'Compose', 'Kubernetes intro'] },
      { module: 'CI/CD', topics: ['GitHub Actions', 'Pipelines', 'Testing gates', 'Release strategies'] },
      { module: 'Cloud', topics: ['AWS core services', 'IAM', 'Infrastructure as code', 'Cost basics'] },
    ],
    accent: 'from-teal-500/20 to-cyan-500/5',
    accentVar: 'var(--color-track-4)',
  },
  {
    slug: 'ui-ux-design',
    title: 'UI/UX Design',
    tagline: 'Design products people can actually use',
    description:
      'Research, wireframing, prototyping, and design systems. You leave with a portfolio of case studies that show your thinking, not just your screens.',
    icon: Palette,
    duration: '4 months',
    mode: 'On-campus',
    level: 'Beginner friendly',
    seats: 150,
    skills: ['Figma', 'User research', 'Wireframing', 'Prototyping', 'Design systems'],
    outcomes: [
      'Run user research and translate it into decisions',
      'Build interactive prototypes',
      'Create and maintain a design system',
      'Present a portfolio of case studies',
    ],
    curriculum: [
      { module: 'Design Foundations', topics: ['Colour & type', 'Layout & hierarchy', 'Accessibility'] },
      { module: 'Research', topics: ['Interviews', 'Personas', 'Journey mapping', 'Usability testing'] },
      { module: 'Figma & Prototyping', topics: ['Components', 'Auto layout', 'Interactions', 'Handoff'] },
      { module: 'Design Systems', topics: ['Tokens', 'Documentation', 'Consistency at scale'] },
    ],
    accent: 'from-emerald-500/20 to-green-500/5',
    accentVar: 'var(--color-track-5)',
  },
]

export function getProgram(slug: string) {
  return PROGRAMS.find((p) => p.slug === slug)
}

/* ----------------------------------------------------------------- stats -- */

/**
 * The headline figures shown on the home page, About and Success Stories.
 *
 * **These are illustrative.** Nothing in this codebase produces them and no
 * source was supplied for them — the 78% placement rate and the 4.5-month
 * time-to-hire on the Success Stories page in particular are not numbers
 * anything here can substantiate. Confirmed with the project owner on
 * 2026-09-03 and labelled rather than removed, on the same footing as the
 * hero's dashboard preview (see `features/marketing/preview-data.ts`, which
 * already reasons this through at length).
 *
 * Every surface that renders these must show `ILLUSTRATIVE_NOTE` as visible
 * text — not as an aria-label or a tooltip, so the caveat reaches sighted
 * visitors by the same route as everyone else. `<StatCaveat />` in
 * `<StatCaveat />` in `features/marketing/caveat.tsx` is the one component
 * that does it.
 *
 * Replace with real reporting figures when the programme team supplies them,
 * and drop the caveat at the same time — not before.
 */
export const STATS = [
  { label: 'Students trained', value: 250000, suffix: '+', icon: Users },
  { label: 'Courses offered', value: 25, suffix: '', icon: BookOpen },
  { label: 'Campuses nationwide', value: 12, suffix: '', icon: Building2 },
  { label: 'Placement rate', value: 78, suffix: '%', icon: Award },
]

/** The exact wording, so six surfaces cannot caveat the same numbers six ways. */
export const ILLUSTRATIVE_NOTE =
  'Figures shown are illustrative and pending confirmation from programme reporting.'

/* ------------------------------------------------------------- admission -- */

/**
 * The 4-stage version of this list (registration -> screening -> on-campus
 * assessment -> enrolment) was retired 2026-09-03: it quietly disagreed with
 * `JOURNEY_STEPS` (lib/stages.ts), the real 5-stage pipeline every candidate
 * and admin screen already reads from. Every place that rendered
 * ADMISSION_STEPS — the homepage's process band and /admissions — now maps
 * `JOURNEY_STEPS` directly, so a stage can no longer be described two
 * different ways on two different pages.
 */

/* ---------------------------------------------------------------- social -- */

/**
 * Graduate quotes.
 *
 * **These are illustrative, and every surface that renders them says so.**
 *
 * They are not transcripts of interviews with named alumni — nothing in this
 * project holds consent, attribution, or a source for any of them. Shown as
 * genuine, they would be fabricated testimonials attributed to identifiable
 * people at real, named employers, which is a materially worse thing to
 * publish than an unsourced percentage.
 *
 * Two changes were made on 2026-09-03 rather than deleting the section
 * outright (decided with the project owner):
 *
 *   - Surnames were dropped. A full name plus a real employer and job title
 *     reads as one specific, findable person; a first name beside an explicit
 *     "representative example" label does not.
 *   - `TESTIMONIAL_NOTE` is rendered as visible text wherever these appear,
 *     via `<TestimonialCaveat />` in `features/marketing/caveat.tsx`.
 *
 * Replace with real, consented graduate stories when the programme team
 * supplies them — restoring full names at the same time, and dropping the
 * caveat only once every quote in the array is genuinely sourced.
 */
export const TESTIMONIALS = [
  {
    quote:
      'I applied with no coding background at all. Six months later I was writing production React. The instructors never once made me feel behind.',
    name: 'Ayesha S.',
    role: 'Frontend Engineer',
    company: 'Systems Ltd',
    initials: 'AS',
  },
  {
    quote:
      'The batch interview process was the most organised thing I have been through. I knew my slot, my code, and my status at every step.',
    name: 'Bilal A.',
    role: 'Full-Stack Developer',
    company: 'Careem',
    initials: 'BA',
  },
  {
    quote:
      'What surprised me was the project work. We built and deployed real applications, so my portfolio was ready before I graduated.',
    name: 'Fatima K.',
    role: 'Data Analyst',
    company: 'Telenor',
    initials: 'FK',
  },
  {
    quote:
      'Completely free, and yet more rigorous than paid courses I had tried. The physical assessment made sure everyone in the room was serious.',
    name: 'Usman T.',
    role: 'DevOps Engineer',
    company: 'Netsol',
    initials: 'UT',
  },
  {
    quote:
      'I was working days and studying evenings. The schedule made that possible, and the mentors were reachable when I got stuck.',
    name: 'Zainab A.',
    role: 'Mobile Developer',
    company: 'Bazaar',
    initials: 'ZA',
  },
]

/** The exact wording, so every surface caveats these the same way. */
export const TESTIMONIAL_NOTE =
  'Quotes shown are representative examples of graduate feedback, not statements from named individuals. Real, consented alumni stories replace these when available.'

export interface HiringPartner {
  name: string
  slug: string
  /**
   * The company's real logo asset (SVG preferred), and the URL its mark
   * should open. Both undefined until supplied: these are real, named,
   * trademarked companies with no stored evidence of an actual placement or
   * logo license on this codebase's side, so a logo file and destination are
   * data this project has to be handed, not guessed or fetched from the web.
   * Until then `PartnerStrip` renders a plain wordmark and skips the link —
   * see its own header comment for exactly how it degrades.
   */
  logo?: string
  url?: string
}

/**
 * Real logos, fetched 2026-09-03 directly from each company's own site (or
 * Wikimedia Commons, for the five with a proper Wikipedia entry) and checked
 * byte-for-byte with `file` before being trusted — never generated, guessed,
 * or pulled from an unrelated stock/logo-pack source. Saved under
 * `public/logos/` so the page serves them itself rather than hot-linking a
 * third party on every visitor's page load.
 *
 * `url` is each company's real homepage, verified via search and (where the
 * company's own WAF allowed it) a live HTTP check, not assumed from the name.
 *
 * Tkxel has no `logo`: their site's WAF rate-limited this fetch mid-session
 * and returned a 403 for every subsequent attempt, including a retry after a
 * cooldown. Left as the styled wordmark fallback — see partner-strip.tsx —
 * rather than ship a broken image or a guessed substitute. Its `url` is real
 * and still links out.
 *
 * Daraz and 10Pearls use each company's small colour favicon rather than the
 * wordmark pulled from their own navbar: both navbar marks turned out to be
 * solid white with a transparent background (checked pixel-by-pixel, not
 * assumed) — meant for a dark header, and invisible against this strip's
 * light background. Their favicons carry the same brand mark in an actual
 * visible colour (Daraz's orange, 10Pearls' near-black), confirmed the same
 * way before use.
 *
 * Netsol links to netsolpk.com (their Pakistan operation) rather than the
 * NASDAQ-listed US parent's netsoltech.com: the audience here is a Pakistani
 * applicant, and the Pakistan site is the more relevant destination for
 * "where our graduates work."
 */
export const HIRING_PARTNERS: HiringPartner[] = [
  { name: 'Systems Ltd', slug: 'systems-ltd', logo: '/logos/systems-ltd.svg', url: 'https://www.systemsltd.com' },
  { name: 'Careem', slug: 'careem', logo: '/logos/careem.svg', url: 'https://www.careem.com' },
  { name: 'Telenor', slug: 'telenor', logo: '/logos/telenor.svg', url: 'https://www.telenor.com.pk' },
  { name: 'Netsol', slug: 'netsol', logo: '/logos/netsol.svg', url: 'https://www.netsolpk.com' },
  { name: 'Bazaar', slug: 'bazaar', logo: '/logos/bazaar.svg', url: 'https://www.bazaartech.com' },
  { name: 'Daraz', slug: 'daraz', logo: '/logos/daraz.png', url: 'https://www.daraz.pk' },
  { name: '10Pearls', slug: '10pearls', logo: '/logos/10pearls.png', url: 'https://10pearls.com' },
  { name: 'Arbisoft', slug: 'arbisoft', logo: '/logos/arbisoft.svg', url: 'https://arbisoft.com' },
  { name: 'Contour', slug: 'contour', logo: '/logos/contour.png', url: 'https://contour-software.com' },
  { name: 'Folio3', slug: 'folio3', logo: '/logos/folio3.png', url: 'https://folio3.com' },
  { name: 'TPS', slug: 'tps', logo: '/logos/tps.png', url: 'https://www.tpsworldwide.com' },
  { name: 'Tkxel', slug: 'tkxel', url: 'https://tkxel.com' },
]

/* -------------------------------------------------------------------- faq -- */

export interface FaqGroup {
  category: string
  /** One line under the group heading, so a scanner knows what is in it. */
  blurb: string
  icon: LucideIcon
  items: { q: string; a: string }[]
}

/**
 * Answers to what applicants actually ask, written from what this platform
 * actually does — not from a generic FAQ template.
 *
 * Rewritten 2026-09-03. The previous version had answers that contradicted
 * the implementation, the worst being "each stage closes at its published
 * deadline and cannot be reopened for individual applicants": the deadline
 * flow does the opposite, holding the application and taking a written
 * explanation that a staff member reads (see
 * `POST /me/ai-interview/explanation` and `DeadlineExplanation`). An FAQ that
 * tells an applicant their application is dead when it is merely paused is
 * the most expensive kind of wrong copy there is.
 *
 * Every answer below traces to something in this codebase:
 *
 *   candidate code format          application_service.py (`B07-004`)
 *   one application per intake     application_service.create (duplicate guard)
 *   AI interview is recorded       ai_interview_service + the Terms text
 *   second attempt is decided      ai_interview_service.decide_reinterview
 *   missed deadline holds          ai_interviews.py explain_missed_deadline
 *   physical interview is not      STAGE_GUIDANCE.PHYSICAL_INTERVIEW
 *     a technical round
 *   the document set               enums.OnboardingDocumentType
 *   the four onboarding forms      enums.OnboardingFormType
 *   a form can be sent back        enums.OnboardingFormStatus.REOPENED
 *   Agilytic at the end            STAGE_GUIDANCE.ONBOARDED / JOURNEY_STEPS
 *
 * Deliberately absent, because nothing in this codebase or Saylani's public
 * material substantiates them and inventing them would be worse than the gap:
 * a completion certificate, placement statistics, stipend amounts, class
 * timetables, and the withdrawal procedure. Those need the programme team's
 * input before they go on a page applicants read as fact.
 */
export const FAQS: FaqGroup[] = [
  {
    category: 'Cost and eligibility',
    blurb: 'What it costs, who can apply, and what you need before you start.',
    icon: HeartHandshake,
    items: [
      {
        q: 'Is it really free?',
        a: 'Yes. There is no fee to register, no fee to apply, and no fee to attend. If a specific programme ever carried a cost, that would be stated on its own page before you applied to it — none currently does.',
      },
      {
        q: 'What do I need in order to apply?',
        a: 'A working email address, your CNIC number — or your B-Form number if you are under 18 — your father’s CNIC and phone number, your educational background, and a photograph you can upload. Most tracks are beginner friendly and assume no prior coding; the ones that expect some experience say so on their programme page.',
      },
      {
        q: 'Can I apply if I am under 18?',
        a: 'Yes. You give your B-Form number in place of a CNIC, and your father’s or guardian’s CNIC and phone number are recorded alongside your application. The application is still yours, submitted in your own name — there is no separate guardian account.',
      },
      {
        q: 'Can I apply to more than one programme?',
        a: 'One application per person per open intake, so seats are allocated fairly. The platform will not let a second application through on the same account for the same intake. If you are not selected, you are welcome to apply again next cycle — intakes run several times a year.',
      },
    ],
  },
  {
    category: 'Applying',
    blurb: 'Creating an account, submitting an application, and your candidate code.',
    icon: ScrollText,
    items: [
      {
        q: 'Is creating an account the same as applying?',
        a: 'No, and this catches people out. Signing up creates your account; you then complete a separate registration form to actually submit an application to an open intake. Until you finish that form you are not in the pool for anything.',
      },
      {
        q: 'What is a candidate code?',
        a: 'A unique reference issued the moment your application is submitted, in the form B07-004 — the intake number, then your position in it. It identifies you at every stage that follows, so quote it in any email you send us. Codes are never reused: if an application is removed, its number stays vacant rather than being handed to somebody else.',
      },
      {
        q: 'Can I change my answers after submitting?',
        a: 'Not directly. Contact the admissions team with your candidate code and explain what needs correcting — a staff member can amend the record, and the change is logged. Anything found to be deliberately false can end an application at any stage, including after selection.',
      },
      {
        q: 'How do I know my application went through?',
        a: 'Your candidate code appears immediately, and your portal shows your current stage from that point on. If you can sign in and see a stage, you are in the pool.',
      },
    ],
  },
  {
    category: 'Interviews',
    blurb: 'The AI screening round, results, and the in-person interview that follows.',
    icon: Bot,
    items: [
      {
        q: 'What is the AI interview, exactly?',
        a: 'A recorded, proctored screening interview run by InterviewerAI, our screening partner. It captures video, your answers, and periodic snapshots during the session, and returns a score and report to us. You consent to that recording when you accept the Terms of Service before applying.',
      },
      {
        q: 'How will I know my interview slot?',
        a: 'Shortlisted candidates are grouped into batches and emailed a slot and a deadline. The same details appear on your interview page in the portal, so a lost email is not a lost slot. Check spam — it is the single most common reason people miss theirs.',
      },
      {
        q: 'What happens after I sit it?',
        a: 'Your interview is reviewed alongside the rest of your batch, and everyone in a batch is told at the same time. Clearing it moves you to the physical interview stage; not clearing it ends the application at that stage.',
      },
      {
        q: 'Can I sit the interview a second time?',
        a: 'A second attempt can be requested, but it is not automatic and it is not granted by the system. A staff member reviews each request individually and either approves or refuses it, and that decision is recorded.',
      },
      {
        q: 'What happens at the physical interview?',
        a: 'A one-to-one conversation with HR on campus. It is not a technical round and it is not a written exam — no coding questions. It is a chance for both sides to meet and confirm the track suits you. Your date and venue are emailed to you and shown in your portal.',
      },
    ],
  },
  {
    category: 'Deadlines',
    blurb: 'What each deadline means, and what actually happens if you miss one.',
    icon: CalendarClock,
    items: [
      {
        q: 'What happens if I miss a deadline?',
        a: 'Your application is not rejected. It stays exactly where it is and does not advance on its own, and you are offered the chance to write an explanation of what happened. A staff member reads every explanation individually and decides — no automated system judges it. Act as soon as you notice, because nothing moves until somebody looks at it.',
      },
      {
        q: 'Where do I see my deadlines?',
        a: 'Each stage shows its own deadline in your portal, counting down, and the emails for time-limited stages repeat it. Deadlines belong to the stage you are standing on, so you will never be counting down to more than one at a time.',
      },
      {
        q: 'Do deadlines differ between applicants?',
        a: 'They can. Interview deadlines are set per batch and captured when the batch is sent, so two candidates in the same intake may hold genuinely different dates. Always go by what your own portal says rather than by what someone else was told.',
      },
    ],
  },
  {
    category: 'If you are selected',
    blurb: 'Documents, the enrolment forms, and what onboarding involves.',
    icon: ClipboardCheck,
    items: [
      {
        q: 'What documents will I need?',
        a: 'Your CNIC or B-Form, your father’s CNIC, your mother’s CNIC where applicable, your CV, your educational certificates, an experience letter if you have one, and proof of a bank account or Easypaisa account for any payment the programme makes. Originals of everything you upload must be brought on your first day.',
      },
      {
        q: 'What are the enrolment forms?',
        a: 'Four forms completed in a fixed order: Background Verification, Employment Application, Half Nama, and your bank or payment details. They reproduce Saylani’s own paperwork, so parts of them are bilingual, and they capture a signature you draw on screen.',
      },
      {
        q: 'What if a form or document is rejected?',
        a: 'A staff member can send any single form back to you for correction. Everything after it in the sequence re-locks until you resubmit, so a correction never lets a later form go through on an uncorrected earlier one. The same applies to an uploaded document that is unreadable, incomplete, or does not match your application.',
      },
      {
        q: 'What is Agilytic?',
        a: 'Our training-records partner. The final step of onboarding is your Agilytic account going live — that is what confirms your seat, and classes begin from there.',
      },
      {
        q: 'When does the documents section unlock?',
        a: 'Only after you clear the physical interview. Before that it stays locked, because nothing in it is asked of you until you have actually been selected.',
      },
    ],
  },
  {
    category: 'Your data',
    blurb: 'Who can see what you submit, and what you can ask us to do with it.',
    icon: ShieldCheck,
    items: [
      {
        q: 'Who inside Saylani can see my application?',
        a: 'Only staff administering the specific intake you applied to. An administrator for one intake cannot see applicants to another — that separation is enforced by the platform, not just by policy. Every time a staff member views or changes your record, it is written to an audit trail.',
      },
      {
        q: 'What happens to my photograph and documents?',
        a: 'They are stored privately and are never reachable by a fixed link. Each time one is viewed, by you or by staff, the platform issues a fresh link that expires shortly afterward.',
      },
      {
        q: 'Can I ask for my data to be deleted?',
        a: 'Yes — write to the admissions team. We will act on it unless there is a genuine reason to keep a specific record, such as an audit entry or the enrolment record of someone who completed a bootcamp, and we will tell you if so. The Privacy Policy sets this out in full.',
      },
    ],
  },
]

export const CAMPUSES = [
  { city: 'Karachi', address: 'Bahadurabad Campus, Main University Road', programs: 25, students: '12,000+' },
  { city: 'Lahore', address: 'Johar Town, Block G1', programs: 18, students: '8,500+' },
  { city: 'Islamabad', address: 'Blue Area, Jinnah Avenue', programs: 15, students: '6,200+' },
  { city: 'Faisalabad', address: 'Peoples Colony No. 1', programs: 12, students: '4,100+' },
  { city: 'Multan', address: 'Bosan Road, near Chungi No. 9', programs: 10, students: '3,400+' },
  { city: 'Hyderabad', address: 'Latifabad Unit No. 7', programs: 9, students: '2,800+' },
]

export const VALUES = [
  {
    title: 'Education without cost',
    description:
      'Talent is distributed evenly; opportunity is not. Every programme we run is free, so ability decides who succeeds rather than income.',
    icon: HeartHandshake,
  },
  {
    title: 'Industry-aligned curriculum',
    description:
      'Course content is reviewed with hiring partners each intake, so what you learn is what teams are actually using.',
    icon: Target,
  },
  {
    title: 'Merit-based selection',
    description:
      'A structured, deadline-driven process with a unique code per candidate means every application is assessed on the same terms.',
    icon: Award,
  },
  {
    title: 'Support beyond graduation',
    description:
      'CV clinics, mock interviews, and an alumni network that keeps opening doors long after the final class.',
    icon: LifeBuoy,
  },
]

/* ---------------------------------------------------------------- footer -- */

/**
 * The footer's link columns, grouped by what a visitor came down here to do.
 *
 * A footer is not a second navigation bar. People scroll to one having failed
 * to find something above it, or to check something before they commit — so
 * these are grouped by intent ("I want to apply", "I need help") rather than
 * by the site's own section names, and each group is short enough to scan
 * without reading.
 *
 * Legal links are deliberately *not* a column here: they belong in the bottom
 * bar, which is the one place every visitor already knows to look for them.
 * See `LEGAL_LINKS` below.
 *
 * The programme list is generated from `PROGRAMS`, not retyped, so adding a
 * sixth track cannot leave the footer advertising five.
 */
export const FOOTER_LINKS = [
  {
    heading: 'Programs',
    links: [
      ...PROGRAMS.map((p) => ({ label: p.title, href: `/programs/${p.slug}` })),
      { label: 'Compare all tracks', href: '/programs' },
    ],
  },
  {
    heading: 'Apply',
    links: [
      { label: 'Start an application', href: '/signup' },
      { label: 'How admissions work', href: '/admissions' },
      { label: 'Who can apply', href: '/admissions#eligibility' },
      { label: 'Key dates', href: '/admissions#dates' },
    ],
  },
  {
    heading: 'About',
    links: [
      { label: 'Our mission', href: '/about' },
      { label: 'Success stories', href: '/success-stories' },
      { label: 'Campuses', href: '/about#campuses' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { label: 'FAQs', href: '/faq' },
      { label: 'Contact admissions', href: '/contact' },
      { label: 'Student portal', href: '/login' },
    ],
  },
]

/** Bottom-bar links. Kept beside the copyright, where people expect them. */
export const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
]
