import { motion } from 'motion/react'
import { CheckCircle2, Download, FileText, Pencil, Printer } from 'lucide-react'

import { PageHeader, StageBadge } from '@/components/shared/portal-ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { MY_APPLICATION } from '@/lib/mock-data'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

export default function CandidateApplicationPage() {
  const { profile } = useAuth()

  return (
    <>
      <PageHeader
        title="My application"
        description={`Submitted ${MY_APPLICATION.appliedAt} · ${MY_APPLICATION.bootcamp}`}
        actions={
          <>
            <Button variant="outline">
              <Printer className="size-4" />
              Print
            </Button>
            <Button variant="outline">
              <Download className="size-4" />
              Download PDF
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">Personal details</CardTitle>
                  <CardDescription>As submitted with your application</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" value={profile?.full_name ?? '—'} />
                  <Field label="Email" value={profile?.email ?? '—'} />
                  <Field label="Phone" value={profile?.phone ?? '0300 1234567'} />
                  <Field label="CNIC" value="42101-1234567-8" />
                  <Field label="Date of birth" value="14 March 2003" />
                  <Field label="City" value="Karachi" />
                </dl>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Education & background</CardTitle>
                <CardDescription>Used to place you in the right cohort</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-5 sm:grid-cols-2">
                  <Field label="Highest qualification" value="Intermediate (FSc Pre-Engineering)" />
                  <Field label="Institution" value="Government College, Karachi" />
                  <Field label="Year of completion" value="2022" />
                  <Field label="Current status" value="Student" />
                  <Field label="Prior coding experience" value="Basic HTML and CSS" />
                  <Field label="Preferred class timing" value="Evening (18:00 – 21:00)" />
                </dl>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Why you applied</CardTitle>
                <CardDescription>Your statement of purpose</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  I have been teaching myself web development from free tutorials for about a
                  year, but I keep hitting a ceiling on the things that are hard to learn
                  alone — architecture, code review, and working in a team. I am applying
                  because I want structured feedback from people who build software
                  professionally, and because a formal certificate would make a real
                  difference to my chances of being taken seriously by employers.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Application summary</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Candidate code</span>
                  <span className="font-mono text-sm font-semibold">{MY_APPLICATION.code}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stage</span>
                  <StageBadge stage={MY_APPLICATION.stage} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Program</span>
                  <span className="text-sm font-medium">{MY_APPLICATION.program}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Submitted</span>
                  <span className="text-sm font-medium">{MY_APPLICATION.appliedAt}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submitted documents</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {[
                  { name: 'CNIC (front & back)', size: '1.2 MB' },
                  { name: 'Intermediate certificate', size: '840 KB' },
                  { name: 'Passport photograph', size: '320 KB' },
                ].map((doc) => (
                  <div
                    key={doc.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/35"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <FileText className="size-4 shrink-0 text-primary" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{doc.name}</span>
                        <span className="text-xs text-muted-foreground">{doc.size}</span>
                      </span>
                    </span>
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
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
