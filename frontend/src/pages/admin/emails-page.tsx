import { motion } from 'motion/react'
import {
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  RefreshCw,
  Send,
  TriangleAlert,
  XCircle,
} from 'lucide-react'

import { PageHeader, StatCard } from '@/components/shared/portal-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EMAIL_LOGS, type EmailLogRow } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const STATUS_META: Record<
  EmailLogRow['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  sent: { label: 'Sent', icon: CheckCircle2, className: 'bg-success/12 text-success' },
  queued: { label: 'Queued', icon: Clock, className: 'bg-info/12 text-info' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-destructive/12 text-destructive' },
}

const TEMPLATES = [
  { name: 'Application received', description: 'Confirms submission and issues the candidate code', uses: 441 },
  { name: 'Interview invitation', description: 'Batch, date, slot, and venue details', uses: 125 },
  { name: 'Interview reminder', description: 'Sent 24 hours before the slot', uses: 125 },
  { name: 'Assessment invitation', description: 'Physical assessment date and what to bring', uses: 168 },
  { name: 'Selection result', description: 'Outcome and next steps', uses: 0 },
  { name: 'Onboarding form link', description: 'Bank and identity details request', uses: 0 },
]

export default function AdminEmailsPage() {
  const totalSent = EMAIL_LOGS.filter((e) => e.status === 'sent').reduce(
    (sum, e) => sum + e.recipients,
    0,
  )
  const failed = EMAIL_LOGS.filter((e) => e.status === 'failed').length
  const queued = EMAIL_LOGS.filter((e) => e.status === 'queued').length
  const rated = EMAIL_LOGS.filter((e) => e.openRate !== null)
  const avgOpen = rated.length
    ? Math.round(rated.reduce((sum, e) => sum + (e.openRate ?? 0), 0) / rated.length)
    : 0

  return (
    <>
      <PageHeader
        title="Email campaigns"
        description="Batch notifications sent at each stage gate."
        actions={
          <Button>
            <Send className="size-4" />
            New campaign
          </Button>
        }
      />

      {/* The SMTP constraint discovered in testing — surfaced where it matters. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Email provider not configured</AlertTitle>
          <AlertDescription>
            The project is still on Supabase's built-in mailer, which is rate limited to a
            few messages per hour. Batch sends to hundreds of candidates will fail until a
            dedicated SMTP provider is connected.
          </AlertDescription>
        </Alert>
      </motion.div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Emails delivered" value={totalSent} icon={Mail} trend={14} hint="this intake" delay={0} />
        <StatCard label="Average open rate" value={avgOpen} suffix="%" icon={Eye} trend={5} delay={0.06} />
        <StatCard label="Queued" value={queued} icon={Clock} hint="awaiting send" delay={0.12} />
        <StatCard label="Failed" value={failed} icon={XCircle} hint="needs attention" delay={0.18} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* Log */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send history</CardTitle>
              <CardDescription>Every batch email, with delivery status</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Open rate</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EMAIL_LOGS.map((log, index) => {
                      const meta = STATUS_META[log.status]
                      return (
                        <motion.tr
                          key={log.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
                          className="border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                        >
                          <TableCell className="text-sm font-medium">{log.template}</TableCell>
                          <TableCell className="text-sm tabular-nums text-muted-foreground">
                            {log.recipients}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                                meta.className,
                              )}
                            >
                              <meta.icon className="size-3" />
                              {meta.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {log.openRate === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              `${log.openRate}%`
                            )}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                            {log.sentAt}
                          </TableCell>
                          <TableCell>
                            {log.status === 'failed' && (
                              <Button size="sm" variant="ghost">
                                <RefreshCw className="size-3.5" />
                                Retry
                              </Button>
                            )}
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Templates */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Templates</CardTitle>
              <CardDescription>Reusable, variable-driven messages</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {TEMPLATES.map((template) => (
                <div
                  key={template.name}
                  className="group flex items-start justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/35 hover:bg-muted/40"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{template.name}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {template.description}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {template.uses}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  )
}
