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
  Braces,
  Building2,
  Cloud,
  Database,
  GraduationCap,
  HeartHandshake,
  LifeBuoy,
  Newspaper,
  Palette,
  Phone,
  ScrollText,
  Smartphone,
  Sparkles,
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
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Programs',
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
    children: [
      {
        label: 'How to Apply',
        description: 'The four stages, start to finish',
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
  { label: 'Success Stories', href: '/success-stories' },
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
    accent: 'from-emerald-500/20 to-teal-500/5',
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
    accent: 'from-violet-500/20 to-purple-500/5',
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
    accent: 'from-amber-500/20 to-orange-500/5',
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
    accent: 'from-pink-500/20 to-rose-500/5',
  },
]

export function getProgram(slug: string) {
  return PROGRAMS.find((p) => p.slug === slug)
}

/* ----------------------------------------------------------------- stats -- */

export const STATS = [
  { label: 'Students trained', value: 250000, suffix: '+', icon: Users },
  { label: 'Courses offered', value: 25, suffix: '', icon: BookOpen },
  { label: 'Campuses nationwide', value: 12, suffix: '', icon: Building2 },
  { label: 'Placement rate', value: 78, suffix: '%', icon: Award },
]

/* ------------------------------------------------------------- admission -- */

export const ADMISSION_STEPS = [
  {
    step: '01',
    title: 'Submit your application',
    description:
      'Create an account and complete the online form before the registration deadline. You receive a unique candidate code that follows you through every stage.',
    icon: ScrollText,
  },
  {
    step: '02',
    title: 'Screening interview',
    description:
      'Shortlisted applicants are grouped into timed batches and invited by email. The screening assesses aptitude and commitment, not prior experience.',
    icon: Sparkles,
  },
  {
    step: '03',
    title: 'On-campus assessment',
    description:
      'A one-to-one session with our team to confirm your fit for the track, discuss your goals, and answer your questions in person.',
    icon: Users,
  },
  {
    step: '04',
    title: 'Enrolment & onboarding',
    description:
      'Selected candidates complete the onboarding form, receive their class schedule, and join the cohort. Everything is free of charge.',
    icon: GraduationCap,
  },
]

/* ---------------------------------------------------------------- social -- */

export const TESTIMONIALS = [
  {
    quote:
      'I applied with no coding background at all. Six months later I was writing production React. The instructors never once made me feel behind.',
    name: 'Ayesha Siddiqui',
    role: 'Frontend Engineer',
    company: 'Systems Ltd',
    initials: 'AS',
  },
  {
    quote:
      'The batch interview process was the most organised thing I have been through. I knew my slot, my code, and my status at every step.',
    name: 'Bilal Ahmed',
    role: 'Full-Stack Developer',
    company: 'Careem',
    initials: 'BA',
  },
  {
    quote:
      'What surprised me was the project work. We built and deployed real applications, so my portfolio was ready before I graduated.',
    name: 'Fatima Khan',
    role: 'Data Analyst',
    company: 'Telenor',
    initials: 'FK',
  },
  {
    quote:
      'Completely free, and yet more rigorous than paid courses I had tried. The physical assessment made sure everyone in the room was serious.',
    name: 'Usman Tariq',
    role: 'DevOps Engineer',
    company: 'Netsol',
    initials: 'UT',
  },
  {
    quote:
      'I was working days and studying evenings. The schedule made that possible, and the mentors were reachable when I got stuck.',
    name: 'Zainab Ali',
    role: 'Mobile Developer',
    company: 'Bazaar',
    initials: 'ZA',
  },
]

export const HIRING_PARTNERS = [
  'Systems Ltd', 'Careem', 'Telenor', 'Netsol', 'Bazaar', 'Daraz',
  '10Pearls', 'Arbisoft', 'Contour', 'Folio3', 'TPS', 'Tkxel',
]

export const FAQS = [
  {
    category: 'Admissions',
    items: [
      {
        q: 'Is the bootcamp really free?',
        a: 'Yes. Every Saylani Mass IT Training programme is completely free of charge. There are no tuition fees, registration fees, or hidden costs at any stage.',
      },
      {
        q: 'What qualifications do I need to apply?',
        a: 'Most tracks are beginner friendly and require only matriculation or equivalent, plus a genuine commitment to complete the course. Some advanced tracks list prerequisites on their programme page.',
      },
      {
        q: 'How many people are accepted per intake?',
        a: 'It varies by programme, typically between 120 and 300 seats. Because demand exceeds capacity, we run a structured screening and assessment process for every intake.',
      },
      {
        q: 'Can I apply to more than one programme?',
        a: 'You may apply to one programme per intake so that seats are allocated fairly. If you are not selected, you are welcome to apply again in the next cycle.',
      },
    ],
  },
  {
    category: 'The process',
    items: [
      {
        q: 'What is a candidate code?',
        a: 'When your application is submitted you receive a unique code in the format B07-001. It identifies you at every stage — interview, assessment, and enrolment — so nothing gets lost between steps.',
      },
      {
        q: 'How will I know my interview slot?',
        a: 'Shortlisted candidates are grouped into batches and emailed their date and time slot. Your status is also visible in your portal at all times.',
      },
      {
        q: 'What happens at the physical assessment?',
        a: 'It is a one-to-one conversation with our team, held on campus. We discuss your goals, confirm the track suits you, and answer your questions. It is not a written exam.',
      },
      {
        q: 'What if I miss a deadline?',
        a: 'Each stage closes at its published deadline and cannot be reopened for individual applicants. We recommend completing each step as soon as you are notified.',
      },
    ],
  },
  {
    category: 'Study & support',
    items: [
      {
        q: 'Are classes online or on campus?',
        a: 'It depends on the programme. Each listing states whether it runs on campus, online, or as a hybrid. Campus locations are listed on our About page.',
      },
      {
        q: 'Do I get a certificate?',
        a: 'Yes. Students who complete the coursework and capstone project receive a Saylani Mass IT Training certificate.',
      },
      {
        q: 'Is there job placement support?',
        a: 'Our team runs CV workshops, mock interviews, and referrals to hiring partners. Around 78% of graduates find relevant work within six months.',
      },
      {
        q: 'What if I need to withdraw?',
        a: 'Let your programme coordinator know as early as possible so the seat can be offered to someone on the waiting list. You may reapply in a future intake.',
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

export const FOOTER_LINKS = [
  {
    heading: 'Programs',
    links: PROGRAMS.map((p) => ({ label: p.title, href: `/programs/${p.slug}` })),
  },
  {
    heading: 'Admissions',
    links: [
      { label: 'How to Apply', href: '/admissions' },
      { label: 'Eligibility', href: '/admissions#eligibility' },
      { label: 'Important Dates', href: '/admissions#dates' },
      { label: 'Apply Now', href: '/signup' },
    ],
  },
  {
    heading: 'About',
    links: [
      { label: 'Our Mission', href: '/about' },
      { label: 'Success Stories', href: '/success-stories' },
      { label: 'Campuses', href: '/about#campuses' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'FAQs', href: '/faq' },
      { label: 'Student Portal', href: '/login' },
      { label: 'Contact Us', href: '/contact' },
    ],
  },
]
