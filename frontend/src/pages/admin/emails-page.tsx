import { AlertTriangle, CheckCircle2, Mail, Search, Send, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PendingLabel } from '@/components/shared/pending-label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { emailApi } from '@/features/admin/api'
import { MERGE_FIELDS } from '@/features/admin/email-merge-fields'
import {
  AsyncSection,
  BootcampSwitcher,
  BootcampGate,
  Pagination,
} from '@/features/admin/components'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import { useDebounced } from '@/hooks/use-debounced'
import { STAGE_LABEL, STAGE_ORDER, type ApplicationStage, type EmailStatus } from '@/lib/types'

const PAGE_SIZE = 25
const ALL = 'ALL'

/**
 * Starting points, not a locked template system.
 *
 * Stored here rather than in the database because they are copy, and copy
 * changes with the marketing site — the backend only needs the rendered body.
 */
const TEMPLATES = [
  {
    key: 'interview_invite',
    name: 'AI Interview invitation',
    subject: 'Your AI interview for $bootcamp',
    body:
      '<p>Dear $candidate_name,</p>' +
      '<p>Your application ($candidate_code) for <strong>$program</strong> has moved forward. ' +
      'Please attend your AI screening interview at the time shared with you.</p>' +
      '<p>Bring your CNIC and this candidate code.</p>' +
      '<p>Warm Wishes from Saylani Admissions</p>',
  },
  {
    key: 'result_pass',
    name: 'Result — moving forward',
    subject: 'Good news about your $bootcamp application',
    body:
      '<p>Dear $candidate_name,</p>' +
      '<p>Congratulations! You have cleared the screening stage for <strong>$program</strong>. ' +
      'We will contact you shortly with the next step.</p>' +
      '<p>Your candidate code remains $candidate_code.</p>' +
      '<p>Warm Wishes from Saylani Admissions</p>',
  },
  {
    key: 'result_reject',
    name: 'Result — not proceeding',
    subject: 'Update on your $bootcamp application',
    body:
      '<p>Dear $candidate_name,</p>' +
      '<p>Thank you for applying for <strong>$program</strong>. ' +
      'On this occasion we are unable to offer you a place. ' +
      'We genuinely encourage you to apply again for the next intake.</p>' +
      '<p>Warm Wishes from Saylani Admissions</p>',
  },
  {
    key: 'reminder',
    name: 'Deadline reminder',
    subject: 'Reminder: complete your $bootcamp steps',
    body:
      '<p>Dear $candidate_name,</p>' +
      '<p>This is a reminder to complete your outstanding step for <strong>$program</strong> ' +
      'before the deadline.</p>' +
      '<p>Warm Wishes from Saylani Admissions</p>',
  },
] as const

// Shared with the interview-invite composer rather than kept private here —
// see features/admin/email-merge-fields.ts.

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminEmailsPage() {
  const { selected, selectedId, loading: bootcampLoading } = useBootcamp()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [offset, setOffset] = useState(0)
  const [composeOpen, setComposeOpen] = useState(false)

  const debouncedSearch = useDebounced(search, 300)

  const { data, error, initialLoading, refetch } = useAsync(
    () =>
      selectedId
        ? emailApi.log(selectedId, {
            status: status === ALL ? undefined : (status as EmailStatus),
            search: debouncedSearch || undefined,
            limit: PAGE_SIZE,
            offset,
          })
        : Promise.resolve(undefined),
    [selectedId, status, debouncedSearch, offset],
  )

  const rows = useMemo(() => data?.items ?? [], [data])

  return (
    <>
      <PageHeader
        title="Emails"
        description={
          bootcampLoading
            ? undefined
            : selected
              ? `Everything sent to candidates in ${selected.name}.`
              : 'Pick an intake to see its email history.'
        }
        actions={
          <>
            <BootcampSwitcher />
            <Button onClick={() => setComposeOpen(true)} disabled={!selectedId}>
              <Send className="size-4" />
              Compose
            </Button>
          </>
        }
      />

      <BootcampGate icon={Mail}>
        {(_selectedId) => (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setOffset(0)
                  }}
                  placeholder="Search by recipient or subject"
                  className="pl-9"
                />
              </div>

              <Select
                value={status}
                onValueChange={(value) => {
                  if (!value) return
                  setStatus(value)
                  setOffset(0)
                }}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
              {rows.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title={debouncedSearch || status !== ALL ? 'No matches' : 'Nothing sent yet'}
                  description={
                    debouncedSearch || status !== ALL
                      ? 'Try a different search or filter.'
                      : 'Every email the platform sends to a candidate is recorded here, including failures.'
                  }
                  action={
                    !debouncedSearch && status === ALL ? (
                      <Button size="sm" onClick={() => setComposeOpen(true)}>
                        <Send className="size-4" />
                        Compose
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden lg:table-cell">Sent by</TableHead>
                            <TableHead className="hidden md:table-cell">When</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm">{row.recipient_email}</span>
                                  {row.candidate_code && (
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {row.candidate_code}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="block max-w-64 truncate text-sm">
                                  {row.subject}
                                </span>
                                {row.template && (
                                  <Badge
                                    variant="outline"
                                    className="mt-1 text-[0.7rem] font-normal"
                                  >
                                    {row.template}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {row.status === 'SENT' ? (
                                  <span className="inline-flex items-center gap-1.5 text-sm text-success">
                                    <CheckCircle2 className="size-3.5" />
                                    Sent
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1.5 text-sm text-destructive"
                                    title={row.error ?? undefined}
                                  >
                                    <XCircle className="size-3.5" />
                                    Failed
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                {row.sent_by_name ?? '—'}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground whitespace-nowrap">
                                {formatDateTime(row.created_at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  </CardContent>
                </Card>
              )}

              {data && (
                <Pagination
                  total={data.total}
                  limit={data.limit}
                  offset={data.offset}
                  onChange={setOffset}
                />
              )}
            </AsyncSection>
          </div>
        )}
      </BootcampGate>

      {selectedId && (
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          bootcampId={selectedId}
          onSent={refetch}
        />
      )}
    </>
  )
}

function ComposeDialog({
  open,
  onOpenChange,
  bootcampId,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bootcampId: string
  onSent: () => void
}) {
  const [templateKey, setTemplateKey] = useState<string>(TEMPLATES[0].key)
  const [stage, setStage] = useState<string>(ALL)
  const [subject, setSubject] = useState<string>(TEMPLATES[0].subject)
  const [body, setBody] = useState<string>(TEMPLATES[0].body)

  function applyTemplate(key: string) {
    const template = TEMPLATES.find((t) => t.key === key)
    if (!template) return
    setTemplateKey(key)
    setSubject(template.subject)
    setBody(template.body)
  }

  const send = useMutation(() =>
    emailApi.broadcast(bootcampId, {
      stage: stage === ALL ? null : (stage as ApplicationStage),
      subject,
      body_html: body,
      template: templateKey,
    }),
  )

  async function submit() {
    const result = await send.run()
    if (!result) return

    if (result.failed === 0) {
      toast.success(`Sent to ${result.sent} candidate${result.sent === 1 ? '' : 's'}`)
    } else {
      toast.warning(`Sent ${result.sent} of ${result.total} — ${result.failed} failed`)
    }
    onOpenChange(false)
    onSent()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compose an email</DialogTitle>
          <DialogDescription>
            Sends to every candidate in this intake matching the stage filter. Each message is
            personalised and logged individually.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template">Template</Label>
              <Select value={templateKey} onValueChange={(v) => v && applyTemplate(v)}>
                <SelectTrigger id="template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((template) => (
                    <SelectItem key={template.key} value={template.key}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stage-filter">Send to</Label>
              <Select value={stage} onValueChange={(v) => v && setStage(v)}>
                <SelectTrigger id="stage-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Everyone in this intake</SelectItem>
                  {STAGE_ORDER.map((value) => (
                    <SelectItem key={value} value={value}>
                      {STAGE_LABEL[value]} only
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body">Message (HTML)</Label>
            <textarea
              id="body"
              rows={10}
              maxLength={20000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Insert:</span>
              {MERGE_FIELDS.map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => setBody((current) => `${current}${field}`)}
                  className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground transition-colors hover:bg-muted"
                >
                  {field}
                </button>
              ))}
            </div>
          </div>

          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              This sends real email immediately. A mistyped placeholder is left as-is in the message
              rather than failing the send, so check the preview text before confirming.
            </AlertDescription>
          </Alert>

          {send.error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{send.error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={send.pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={send.pending || !subject || !body}>
            <Send className="size-4" />
            <PendingLabel idle="Send now" pending="Sending…" isPending={send.pending} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
