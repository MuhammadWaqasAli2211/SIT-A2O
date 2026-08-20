import { motion } from 'motion/react'
import {
  CheckCircle2,
  CloudUpload,
  Download,
  FileText,
  Lock,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/portal-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const UPLOADED = [
  { name: 'CNIC — front.jpg', size: '620 KB', uploaded: '12 Aug 2026', verified: true },
  { name: 'CNIC — back.jpg', size: '598 KB', uploaded: '12 Aug 2026', verified: true },
  { name: 'Intermediate certificate.pdf', size: '840 KB', uploaded: '12 Aug 2026', verified: true },
  { name: 'Passport photo.jpg', size: '320 KB', uploaded: '12 Aug 2026', verified: false },
]

const REQUIRED = [
  { name: 'Matriculation certificate', note: 'Scanned copy, PDF or JPG', done: false },
  { name: 'Domicile certificate', note: 'Optional but recommended', done: false },
]

export default function CandidateDocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents & onboarding form"
        description="Upload the remaining documents and complete your onboarding details."
        actions={
          <Button variant="outline">
            <Download className="size-4" />
            Download checklist
          </Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>The onboarding form opens after your assessment</AlertTitle>
          <AlertDescription>
            Bank and identity details are collected only once you have been selected. The
            form unlocks on 20 October and closes on 27 October.
          </AlertDescription>
        </Alert>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="flex flex-col gap-6">
          {/* Upload area */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upload documents</CardTitle>
                <CardDescription>PDF, JPG, or PNG · maximum 5 MB per file</CardDescription>
              </CardHeader>
              <CardContent>
                <label
                  htmlFor="file-upload"
                  className={cn(
                    'group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border p-10 text-center',
                    'transition-all duration-300 hover:border-primary/50 hover:bg-primary/5',
                  )}
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110">
                    <CloudUpload className="size-6" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                      Drop files here, or click to browse
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Make sure text is legible and the whole document is visible
                    </span>
                  </span>
                  <input id="file-upload" type="file" multiple className="sr-only" />
                </label>
              </CardContent>
            </Card>
          </motion.div>

          {/* Uploaded files */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Uploaded</CardTitle>
                <CardDescription>{UPLOADED.length} files on record</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {UPLOADED.map((doc, index) => (
                  <motion.div
                    key={doc.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.15 + index * 0.06 }}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/35"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{doc.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {doc.size} · {doc.uploaded}
                        </span>
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-2">
                      {doc.verified ? (
                        <Badge variant="secondary" className="gap-1 text-[0.68rem]">
                          <CheckCircle2 className="size-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[0.68rem]">
                          <TriangleAlert className="size-3" />
                          In review
                        </Badge>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete ${doc.name}`}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </span>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Locked onboarding form preview */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <Card className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[3px]">
                <span className="flex flex-col items-center gap-2 text-center">
                  <span className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
                    <Lock className="size-5" />
                  </span>
                  <span className="text-sm font-medium">Unlocks 20 October</span>
                  <span className="max-w-xs text-xs text-muted-foreground">
                    Available after you pass the physical assessment
                  </span>
                </span>
              </div>

              <CardHeader>
                <CardTitle className="text-base">Onboarding form</CardTitle>
                <CardDescription>Bank and identity details for enrolment</CardDescription>
              </CardHeader>
              <CardContent aria-hidden="true">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Account title</Label>
                    <Input disabled placeholder="As printed on your bank record" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank name</Label>
                    <Input disabled placeholder="e.g. Meezan Bank" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>IBAN</Label>
                    <Input disabled placeholder="PK00 XXXX 0000 0000 0000 0000" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Still needed</CardTitle>
                <CardDescription>{REQUIRED.length} documents outstanding</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {REQUIRED.map((doc) => (
                  <div key={doc.name} className="flex items-start gap-2.5">
                    <span className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">{doc.note}</span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16 }}
          >
            <Card className="border-primary/25 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
                    <ShieldCheck className="size-4" />
                  </span>
                  <CardTitle className="text-base">Your data is protected</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                  {[
                    'Bank details are encrypted at rest',
                    'Only authorised staff can view your documents',
                    'Every access is recorded in an audit log',
                    'Documents are never shared with third parties',
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  )
}
