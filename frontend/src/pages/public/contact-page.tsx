import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Clock, Loader2, Mail, MapPin, Phone, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CAMPUSES } from '@/lib/site-data'
import { cn } from '@/lib/utils'

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your name').max(120),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  subject: z.string().min(3, 'Please add a subject').max(150),
  message: z.string().min(20, 'Please give us a little more detail').max(2000),
})

type ContactValues = z.infer<typeof contactSchema>

const CHANNELS = [
  {
    icon: Phone,
    label: 'Phone',
    value: '+92 21 111 123 444',
    href: 'tel:+922111123444',
    note: 'Mon–Sat, 9:00 – 18:00 PKT',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'admissions@saylaniwelfare.com',
    href: 'mailto:admissions@saylaniwelfare.com',
    note: 'Replies within one working day',
  },
  {
    icon: MapPin,
    label: 'Head office',
    value: 'Bahadurabad Campus, Karachi',
    href: undefined,
    note: 'Main University Road',
  },
]

export default function ContactPage() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) })

  const onSubmit = async (_values: ContactValues) => {
    // The contact endpoint is not built yet; this simulates the round trip so
    // the success state and validation can be reviewed. Wire to the API in Phase 2.
    await new Promise((resolve) => setTimeout(resolve, 900))
    setSent(true)
    reset()
  }

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to our admissions team"
        description="Questions about eligibility, deadlines, or which track suits you? We answer every message."
        crumbs={[{ label: 'Contact' }]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-start">
          {/* Channels */}
          <Stagger className="flex flex-col gap-4">
            {CHANNELS.map((channel) => {
              const body = (
                <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
                  <CardContent className="flex items-start gap-4 p-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <channel.icon className="size-5" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {channel.label}
                      </span>
                      <span className="text-sm font-medium">{channel.value}</span>
                      <span className="text-xs text-muted-foreground">{channel.note}</span>
                    </span>
                  </CardContent>
                </Card>
              )

              return (
                <StaggerItem key={channel.label}>
                  {channel.href ? (
                    <a href={channel.href} className="block">
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </StaggerItem>
              )
            })}

            <StaggerItem>
              <Card className="bg-muted/40">
                <CardContent className="flex flex-col gap-3 p-5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="size-4 text-primary" />
                    Office hours
                  </span>
                  <dl className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <dt>Monday – Friday</dt>
                      <dd>9:00 – 18:00</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Saturday</dt>
                      <dd>10:00 – 16:00</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Sunday</dt>
                      <dd>Closed</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </StaggerItem>
          </Stagger>

          {/* Form */}
          <Reveal direction="left">
            <Card>
              <CardContent className="p-7 sm:p-8">
                {sent ? (
                  <div className="flex flex-col items-center gap-5 py-12 text-center">
                    <span className="grid size-14 place-items-center rounded-2xl bg-success/12 text-success">
                      <CheckCircle2 className="size-7" />
                    </span>
                    <div className="flex flex-col gap-2">
                      <h2 className="text-xl font-semibold">Message sent</h2>
                      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                        Thank you for getting in touch. Our admissions team will reply
                        within one working day.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setSent(false)}>
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
                    <div className="flex flex-col gap-1">
                      <h2 className="text-xl font-semibold">Send us a message</h2>
                      <p className="text-sm text-muted-foreground">
                        All fields are required.
                      </p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full name</Label>
                        <Input id="name" autoComplete="name" {...register('name')} />
                        {errors.name && (
                          <p className="text-sm text-destructive">{errors.name.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          {...register('email')}
                        />
                        {errors.email && (
                          <p className="text-sm text-destructive">{errors.email.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        placeholder="Which program should I apply to?"
                        {...register('subject')}
                      />
                      {errors.subject && (
                        <p className="text-sm text-destructive">{errors.subject.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <textarea
                        id="message"
                        rows={6}
                        {...register('message')}
                        className={cn(
                          'w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm',
                          'transition-colors outline-none placeholder:text-muted-foreground',
                          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                        )}
                        placeholder="Tell us a little about your background and what you would like to know."
                      />
                      {errors.message && (
                        <p className="text-sm text-destructive">{errors.message.message}</p>
                      )}
                    </div>

                    <Button type="submit" size="lg" disabled={isSubmitting} className="h-11 self-start px-6">
                      {isSubmitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Send message
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section className="border-t border-border bg-muted/25">
        <Reveal className="mb-10">
          <h2 className="text-2xl font-semibold tracking-tight">Visit a campus</h2>
          <p className="mt-2 text-muted-foreground">
            Walk-in enquiries are welcome during office hours.
          </p>
        </Reveal>

        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPUSES.map((campus) => (
            <StaggerItem key={campus.city}>
              <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
                <CardContent className="flex flex-col gap-2 p-5">
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
