import {
  GraduationCap,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PendingLabel } from '@/components/shared/pending-label'
import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { programApi } from '@/features/admin/api'
import { AsyncSection, ConfirmDialog, useConfirm } from '@/features/admin/components'
import { useAsync, useMutation } from '@/hooks/use-async'
import type { ProgramAdmin } from '@/lib/types'

export default function SuperAdminProgramsPage() {
  const { data, error, initialLoading, refetch } = useAsync(() => programApi.listAll(), [])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProgramAdmin | null>(null)
  const remove = useConfirm<ProgramAdmin>()

  const deleteMutation = useMutation((row: ProgramAdmin) => programApi.remove(row.id))
  const toggleMutation = useMutation((row: ProgramAdmin) =>
    programApi.update(row.id, { is_active: !row.is_active }),
  )

  const programs = data ?? []

  async function confirmDelete() {
    if (!remove.target) return
    if ((await deleteMutation.run(remove.target)) !== undefined) {
      toast.success(`Deleted ${remove.target.title}`)
      remove.close()
      refetch()
    }
  }

  async function toggle(row: ProgramAdmin) {
    if (await toggleMutation.run(row)) {
      toast.success(`${row.title} ${row.is_active ? 'deactivated' : 'activated'}`)
      refetch()
    }
  }

  return (
    <>
      <PageHeader
        title="Programs"
        description="The tracks every intake can offer. Shared across all bootcamps."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" />
            New program
          </Button>
        }
      />

      <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
        {programs.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No programs yet"
            description="Programs are the tracks candidates apply to — Web Development, Data Science, and so on."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead className="hidden lg:table-cell">Details</TableHead>
                      <TableHead>Used by</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {programs.map((program) => (
                      <TableRow key={program.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{program.title}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {program.slug}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          <span className="block max-w-64 truncate">{program.tagline}</span>
                          <span className="text-xs">
                            {[program.duration, program.mode, program.level]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {program.bootcamp_count} intake
                          {program.bootcamp_count === 1 ? '' : 's'}
                          <span className="block text-xs">
                            {program.application_count} application
                            {program.application_count === 1 ? '' : 's'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {program.is_active ? (
                            <Badge className="bg-success/12 text-success hover:bg-success/12">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">Hidden</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Actions for ${program.title}`}
                                />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuGroup>
                                <DropdownMenuLabel>{program.title}</DropdownMenuLabel>
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(program)
                                  setFormOpen(true)
                                }}
                              >
                                Edit details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggle(program)}>
                                {program.is_active ? 'Hide from site' : 'Show on site'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => remove.ask(program)}
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </AsyncSection>

      <ProgramFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        program={editing}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={remove.open}
        onOpenChange={(open) => !open && remove.close()}
        title="Delete this program?"
        description={
          remove.target && remove.target.bootcamp_count > 0
            ? `${remove.target.bootcamp_count} intake(s) still offer this track, so the server will refuse. Hide it from the site instead.`
            : `${remove.target?.title} will be removed permanently.`
        }
        confirmLabel="Delete program"
        destructive
        pending={deleteMutation.pending}
        error={deleteMutation.error}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function ProgramFormDialog({
  open,
  onOpenChange,
  program,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  program: ProgramAdmin | null
  onSaved: () => void
}) {
  // Keyed on the target so switching between programs remounts with fresh
  // fields rather than syncing seven of them through an effect.
  if (!open) return null
  return (
    <ProgramForm
      key={program?.id ?? 'new'}
      onOpenChange={onOpenChange}
      program={program}
      onSaved={onSaved}
    />
  )
}

function ProgramForm({
  onOpenChange,
  program,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void
  program: ProgramAdmin | null
  onSaved: () => void
}) {
  const isEdit = program !== null

  const [slug, setSlug] = useState(program?.slug ?? '')
  const [title, setTitle] = useState(program?.title ?? '')
  const [tagline, setTagline] = useState(program?.tagline ?? '')
  const [duration, setDuration] = useState(program?.duration ?? '')
  const [mode, setMode] = useState(program?.mode ?? '')
  const [level, setLevel] = useState(program?.level ?? '')
  const [sortOrder, setSortOrder] = useState(String(program?.sort_order ?? 0))

  const save = useMutation(async () => {
    const fields = {
      title,
      tagline,
      duration: duration || null,
      mode: mode || null,
      level: level || null,
      sort_order: Number(sortOrder) || 0,
    }
    return isEdit
      ? programApi.update(program.id, fields)
      : programApi.create({ slug, ...fields })
  })

  async function submit() {
    if (await save.run()) {
      toast.success(isEdit ? `Updated ${title}` : `Created ${title}`)
      onOpenChange(false)
      onSaved()
    }
  }

  // Matches the backend's pattern exactly, so a rejection is caught before the
  // request rather than after.
  const slugValid = isEdit || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  const canSave = title.length >= 2 && tagline.length >= 2 && slugValid && !save.pending

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit program' : 'New program'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'The slug cannot change — the marketing site maps it to icons and curriculum copy.'
              : 'The slug links this track to its icon and curriculum copy on the marketing site.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pg-slug">Slug</Label>
            <Input
              id="pg-slug"
              value={slug}
              disabled={isEdit}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="web-development"
            />
            {!isEdit && !slugValid && slug.length > 0 && (
              <p className="text-xs text-destructive">
                Lowercase letters, numbers, and single hyphens only.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pg-title">Title</Label>
            <Input
              id="pg-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={150}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pg-tagline">Tagline</Label>
            <Input
              id="pg-tagline"
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              maxLength={300}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-duration">Duration</Label>
              <Input
                id="pg-duration"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="6 months"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-mode">Mode</Label>
              <Input
                id="pg-mode"
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                placeholder="On-campus + Online"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-level">Level</Label>
              <Input
                id="pg-level"
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                placeholder="Beginner friendly"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-order">Sort order</Label>
              <Input
                id="pg-order"
                type="number"
                min={0}
                max={999}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </div>
          </div>

          {save.error && (
            <Alert variant="destructive">
              <AlertDescription>{save.error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            <PendingLabel
              isPending={save.pending}
              idle={isEdit ? 'Save changes' : 'Create program'}
              pending={isEdit ? 'Saving…' : 'Creating…'}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
