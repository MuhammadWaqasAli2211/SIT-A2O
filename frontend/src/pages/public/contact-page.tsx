/**
 * Contact.
 *
 * A contact page's job is to route people to the fastest channel for their
 * actual question, not to funnel everything into one form. So this leads with
 * the three real channels and — the part most contact pages skip — a short
 * "before you write" block, because a large share of the messages an
 * admissions desk gets are already answered on the site. Deflecting those is
 * a service to the sender, who gets an answer now instead of tomorrow.
 *
 * The form asks for a candidate code. It is optional, because most senders
 * have not applied yet, but when it is filled in it turns a message the team
 * cannot act on ("my application is stuck") into one they can.
 *
 * ## The form does not send anything yet
 *
 * There is no contact endpoint on the backend. That was true before this
 * redesign and is still true; what changed is that the page now says so
 * rather than showing a "Message sent" screen a visitor has no reason to
 * doubt. Telling someone their message was delivered when nothing was
 * delivered is the one failure a contact page must not have — a person with
 * a deadline problem would stop chasing it. Until the endpoint exists the
 * submit button hands them a prefilled email instead, which genuinely works.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Clock,
  Mail,
  MapPin,
  MessageCircleQuestion,
  Phone,
  Send,
  type LucideIcon,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section, SectionHeading } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CONTACT, OFFICE_HOURS } from '@/lib/contact'
import { CAMPUSES } from '@/lib/site-data'
import { cn } from '@/lib/utils'

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your name').max(120),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  // Optional, and only pattern-checked when something was typed. A code is
  // minted as B07-004; anything else is almost certainly a typo, and catching
  // it here is cheaper than an admin failing to find the application.
  candidateCode: z
    .string()
    .trim()
    .regex(/^B\d{2}-\d{3,}$/i, 'Codes look like B07-004')
    .optional()
    .or(z.literal('')),
  subject: z.string().min(3, 'Please add a subject').max(150),
  message: z.string().min(20, 'Please give us a little more detail').max(2000),
})

type ContactValues = z.infer<typeof contactSchema>

interface Channel {
  icon: LucideIcon
  label: string
  value: string
  href?: string
  note: string
  best: string
}

const CHANNELS: Channel[] = [
  {
    icon: Phone,
    label: 'Phone',
    value: CONTACT.phone,
    href: CONTACT.phoneHref,
    note: CONTACT.hoursShort,
    best: 'Fastest for anything time-critical — a deadline you are about to miss, or an interview slot today.',
  },
  {
    icon: Mail,
    label: 'Email',
    value: CONTACT.email,
    href: CONTACT.emailHref,
    note: CONTACT.replyPromise,
    best: 'Best when you need to attach something, or want the answer in writing.',
  },
  {
    icon: MapPin,
    label: 'Visit us',
    value: `${CONTACT.addressLine}, ${CONTACT.city}`,
    note: 'Walk-ins welcome during office hours',
    best: 'Worth the trip for document checks and anything easier to show than describe.',
  },
]

/** The questions this desk is asked most, and where each is already answered. */
const DEFLECTIONS = [
  { label: 'What happens if I miss a deadline?', to: '/faq' },
  { label: 'Which documents will I need?', to: '/faq' },
  { label: 'How do the five stages work?', to: '/admissions' },
  { label: 'Which track should I pick?', to: '/programs' },
]

export default function ContactPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) })

  /**
   * No endpoint exists, so this does not pretend to submit. It composes the
   * message the visitor just wrote into a mailto: and hands it to their mail
   * client — which actually delivers, unlike a simulated success screen.
   */
  const onSubmit = (values: ContactValues) => {
    const code = values.candidateCode?.trim()
    const body = [
      values.message,
      '',
      '—',
      `From: ${values.name} <${values.email}>`,
      code ? `Candidate code: ${code.toUpperCase()}` : null,
    ]
      .filter((line) => line !== null)
      .join('\n')

    const subject = code ? `[${code.toUpperCase()}] ${values.subject}` : values.subject
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`
  }

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to our admissions team"
        description="Questions about eligibility, deadlines, or which track suits you? Pick whichever channel fits — all three reach the same team."
        crumbs={[{ label: 'Contact' }]}
      />

      {/* ------------------------------------------------------- channels -- */}
      <Section className="py-14 sm:py-16">
        <Stagger className="grid gap-5 lg:grid-cols-3">
          {CHANNELS.map((channel) => (
            <StaggerItem key={channel.label} className="h-full">
              <ChannelCard channel={channel} />
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* ------------------------------------------------- form + context -- */}
      <Section className="border-y border-border bg-muted/25 pt-4">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-start lg:gap-14">
          <Reveal direction="right">
            <Card>
              <CardContent className="p-7 sm:p-8">
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="flex flex-col gap-5"
                  noValidate
                >
                  <div className="flex flex-col gap-1.5">
                    <h2 className="text-xl font-semibold tracking-tight">
                      Write to us
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Fill this in and we will open it in your email app, addressed and
                      formatted, ready to send.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      id="name"
                      label="Full name"
                      error={errors.name?.message}
                      {...register('name')}
                      autoComplete="name"
                    />
                    <Field
                      id="email"
                      label="Email"
                      type="email"
                      placeholder="you@example.com"
                      error={errors.email?.message}
                      {...register('email')}
                      autoComplete="email"
                    />
                  </div>

                  <Field
                    id="candidateCode"
                    label="Candidate code"
                    optional
                    placeholder="B07-004"
                    hint="If you have already applied, this lets us find your application straight away."
                    error={errors.candidateCode?.message}
                    {...register('candidateCode')}
                  />

                  <Field
                    id="subject"
                    label="Subject"
                    placeholder="Which programme should I apply to?"
                    error={errors.subject?.message}
                    {...register('subject')}
                  />

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="message">Message</Label>
                    <textarea
                      id="message"
                      rows={6}
                      {...register('message')}
                      aria-invalid={Boolean(errors.message)}
                      className={cn(
                        'w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm',
                        'transition-colors outline-none placeholder:text-muted-foreground',
                        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                        errors.message && 'border-destructive',
                      )}
                      placeholder="Tell us a little about your background and what you would like to know."
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive">{errors.message.message}</p>
                    )}
                  </div>

                  <Button type="submit" size="lg" className="h-11 self-start px-6">
                    <Send className="size-4" />
                    Open in my email app
                  </Button>
                </form>
              </CardContent>
            </Card>
          </Reveal>

          <div className="flex flex-col gap-5">
            <Reveal direction="left">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="flex flex-col gap-4 p-6">
                  <span className="flex items-center gap-2.5">
                    <MessageCircleQuestion className="size-5 shrink-0 text-primary" />
                    <h2 className="text-base font-semibold">Before you write</h2>
                  </span>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    These come up most often, and each already has a full answer on the
                    site — quicker than waiting for a reply.
                  </p>
                  <ul className="flex flex-col gap-2">
                    {DEFLECTIONS.map((item) => (
                      <li key={item.label}>
                        <Link
                          to={item.to}
                          className="group flex items-start gap-2 text-sm text-foreground/80 transition-colors hover:text-primary"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/50 transition-colors group-hover:bg-primary" />
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>

            <Reveal direction="left" delay={0.08}>
              <Card>
                <CardContent className="flex flex-col gap-3.5 p-6">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="size-4 text-primary" />
                    Office hours
                  </span>
                  <dl className="flex flex-col gap-2 text-sm">
                    {OFFICE_HOURS.map((row) => (
                      <div
                        key={row.days}
                        className="flex justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0"
                      >
                        <dt className="text-muted-foreground">{row.days}</dt>
                        <dd className="font-medium tabular-nums">{row.hours}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Times are Pakistan Standard Time. Messages sent outside these hours
                    are answered the next working day.
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------- campuses -- */}
      <Section>
        <SectionHeading
          eyebrow="Campuses"
          title="Or come and see us"
          description="Walk-in enquiries are welcome at any campus during office hours. Bring your CNIC or B-Form if you want your documents checked."
        />

        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPUSES.map((campus) => (
            <StaggerItem key={campus.city}>
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-2 p-5">
                  <h3 className="text-base font-semibold">{campus.city}</h3>
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {campus.address}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>
    </>
  )
}

/* ------------------------------------------------------------- channels -- */

function ChannelCard({ channel }: { channel: Channel }) {
  const body = (
    <Card
      className={cn(
        'h-full transition-all duration-300',
        channel.href && 'group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg',
      )}
    >
      <CardContent className="flex h-full flex-col gap-3.5 p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <channel.icon className="size-5" />
        </span>

        <div className="flex flex-col gap-1">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            {channel.label}
          </span>
          <span className="text-base font-semibold break-words">{channel.value}</span>
          <span className="text-xs text-muted-foreground">{channel.note}</span>
        </div>

        <p className="mt-auto border-t border-border pt-3.5 text-sm leading-relaxed text-muted-foreground">
          {channel.best}
        </p>
      </CardContent>
    </Card>
  )

  if (!channel.href) return <div className="h-full">{body}</div>

  return (
    <a href={channel.href} className="group block h-full">
      {body}
    </a>
  )
}

/* ---------------------------------------------------------------- field -- */

/**
 * A labelled input with its error and hint.
 *
 * Extracted because the form has four of them and the wiring that matters —
 * `htmlFor`/`id` pairing, `aria-invalid`, `aria-describedby` pointing at both
 * the hint and the error — is exactly the wiring that gets dropped when it is
 * retyped per field.
 */
function Field({
  id,
  label,
  error,
  hint,
  optional,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string
  label: string
  error?: string
  hint?: string
  optional?: boolean
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {optional && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </Label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(error && 'border-destructive')}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
