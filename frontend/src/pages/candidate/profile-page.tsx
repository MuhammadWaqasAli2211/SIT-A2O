import { motion } from 'motion/react'
import { Bell, KeyRound, LogOut, Mail, Save, ShieldCheck, Smartphone } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { ROLE_LABEL } from '@/lib/portal-nav'
import { cn } from '@/lib/utils'

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-250',
        checked ? 'bg-primary' : 'bg-muted-foreground/25',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', damping: 24, stiffness: 420 }}
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-white shadow-sm',
          checked ? 'left-[1.375rem]' : 'left-0.5',
        )}
      />
    </button>
  )
}

export default function CandidateProfilePage() {
  const { profile, logout } = useAuth()
  const candidate = profile?.candidate_profile ?? null
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    reminders: false,
  })

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '?'

  return (
    <>
      <PageHeader
        title="Profile & settings"
        description="Manage your personal details, security, and notification preferences."
        actions={
          <Button>
            <Save className="size-4" />
            Save changes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr] lg:items-start">
        {/* Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/20 to-chart-2/10"
            />
            <CardContent className="relative flex flex-col items-center gap-4 p-6 pt-12 text-center">
              <span className="grid size-20 place-items-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground shadow-lg ring-4 ring-card">
                {initials}
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{profile?.full_name ?? 'Your name'}</h2>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
              <Badge variant="secondary">
                {profile ? ROLE_LABEL[profile.role] : 'Candidate'}
              </Badge>

              <Separator />

              <dl className="grid w-full grid-cols-2 gap-4 text-left">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Candidate code
                  </dt>
                  <dd className="font-mono text-sm font-medium">B07-142</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Member since
                  </dt>
                  <dd className="text-sm font-medium">Aug 2026</dd>
                </div>
              </dl>

              <Button variant="outline" className="w-full" onClick={() => void logout()}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex flex-col gap-6">
          {/* Personal details */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personal details</CardTitle>
                <CardDescription>
                  {candidate
                    ? 'Captured when you registered for a bootcamp.'
                    : 'These fill in automatically once you register for a bootcamp.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {/* Read-only. The registration form is the single place this
                    data is entered; a second editable copy here would let the
                    profile and the submitted application disagree. */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" value={candidate?.full_name ?? profile?.full_name} />
                  <Field label="Email" value={profile?.email} hint="Your login. It cannot be changed here." />
                  <Field label="Phone" value={candidate?.phone ?? profile?.phone} />
                  <Field label="City" value={candidate?.city} />
                  <Field label="Father's name" value={candidate?.father_name} />
                  <Field label="Father's phone" value={candidate?.father_phone} />
                  <Field label="Date of birth" value={formatDate(candidate?.date_of_birth)} />
                  <Field label="Gender" value={candidate?.gender} />
                  <Field label="Your CNIC" value={candidate?.cnic} emptyNote="Not provided" />
                  <Field label="Father's CNIC" value={candidate?.father_cnic} />
                  <Field label="Saylani roll number" value={candidate?.saylani_roll_number} />
                  <Field label="Last qualification" value={candidate?.education} />
                </div>

                <Field label="Address" value={candidate?.address} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Security */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Security</CardTitle>
                <CardDescription>Keep your account protected</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <KeyRound className="size-4.5" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">Password</span>
                      <span className="text-xs text-muted-foreground">
                        Last changed 3 months ago
                      </span>
                    </span>
                  </span>
                  <Button variant="outline" size="sm">
                    Change
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <ShieldCheck className="size-4.5" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">Two-factor authentication</span>
                      <span className="text-xs text-muted-foreground">Not enabled</span>
                    </span>
                  </span>
                  <Button variant="outline" size="sm">
                    Enable
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notifications</CardTitle>
                <CardDescription>
                  Stage updates are always sent by email — these control everything else.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {[
                  {
                    key: 'email' as const,
                    icon: Mail,
                    title: 'Email updates',
                    body: 'Interview invitations, results, and deadline reminders',
                  },
                  {
                    key: 'sms' as const,
                    icon: Smartphone,
                    title: 'SMS alerts',
                    body: 'Time-sensitive notices such as slot changes',
                  },
                  {
                    key: 'reminders' as const,
                    icon: Bell,
                    title: 'Weekly digest',
                    body: 'A summary of your application status each Monday',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-0"
                  >
                    <span className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <item.icon className="size-4.5" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{item.body}</span>
                      </span>
                    </span>
                    <Toggle
                      checked={notifications[item.key]}
                      onChange={(value) =>
                        setNotifications((prev) => ({ ...prev, [item.key]: value }))
                      }
                      label={item.title}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  )
}


/* ------------------------------------------------------------- helpers -- */

/**
 * One read-only detail. Renders an explicit placeholder rather than a blank
 * line, so an unregistered candidate sees "not yet provided" rather than
 * wondering whether the page failed to load.
 */
function Field({
  label,
  value,
  hint,
  emptyNote = 'Not yet provided',
}: {
  label: string
  value?: string | null
  hint?: string
  emptyNote?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span
        className={
          value ? 'text-sm text-foreground' : 'text-sm text-muted-foreground/60 italic'
        }
      >
        {value || emptyNote}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}
