import {
  Building2,
  CalendarClock,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { bootcampApi, platformApi } from '@/features/admin/api'
import {
  AsyncSection,
  BootcampStatusBadge,
  ConfirmDialog,
  useConfirm,
} from '@/features/admin/components'
import { BootcampFormDialog } from '@/pages/super-admin/bootcamp-form-dialog'
import { ManageAdminsDialog } from '@/pages/super-admin/manage-admins-dialog'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useBootcamp } from '@/hooks/use-bootcamp'
import type { BootcampSummary } from '@/lib/types'

function formatDate(iso: string | null) {
  if (!iso) return 'Start date not set'
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function SuperAdminBootcampsPage() {
  const { refresh, select } = useBootcamp()
  const { data, error, initialLoading, refetch } = useAsync(() => platformApi.stats(), [])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BootcampSummary | null>(null)
  const [managingAdmins, setManagingAdmins] = useState<BootcampSummary | null>(null)
  const remove = useConfirm<BootcampSummary>()

  const deleteMutation = useMutation((row: BootcampSummary) => bootcampApi.remove(row.id))

  /** The switcher's list is cached in context, so it has to be told too. */
  function reloadAll() {
    refetch()
    refresh()
  }

  async function confirmDelete() {
    if (!remove.target) return
    if ((await deleteMutation.run(remove.target)) !== undefined) {
      toast.success(`Deleted ${remove.target.name}`)
      remove.close()
      reloadAll()
    }
  }

  const bootcamps = data?.bootcamps ?? []

  return (
    <>
      <PageHeader
        title="Bootcamps"
        description="Create intakes, assign administrators, and track how each is progressing."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" />
            New bootcamp
          </Button>
        }
      />

      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refetch}
      >
        {bootcamps.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No bootcamps yet"
            description="Create the first intake, set its registration deadline, then assign an administrator to run it."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" />
                New bootcamp
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {bootcamps.map((bootcamp) => (
              <BootcampCard
                key={bootcamp.id}
                bootcamp={bootcamp}
                onEdit={() => {
                  setEditing(bootcamp)
                  setFormOpen(true)
                }}
                onManageAdmins={() => setManagingAdmins(bootcamp)}
                onDelete={() => remove.ask(bootcamp)}
                onOpenTools={() => select(bootcamp.id)}
              />
            ))}
          </div>
        )}
      </AsyncSection>

      <BootcampFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        bootcamp={editing}
        onSaved={reloadAll}
      />

      <ManageAdminsDialog
        bootcamp={managingAdmins}
        onClose={() => setManagingAdmins(null)}
        onChanged={reloadAll}
      />

      <ConfirmDialog
        open={remove.open}
        onOpenChange={(open) => !open && remove.close()}
        title="Delete this bootcamp?"
        description={
          remove.target?.application_count
            ? `${remove.target.name} has ${remove.target.application_count} application(s). The server will refuse this — set the status to Archived instead.`
            : `${remove.target?.name} will be removed along with its phases and programme assignments. This cannot be undone.`
        }
        confirmLabel="Delete bootcamp"
        destructive
        pending={deleteMutation.pending}
        error={deleteMutation.error}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function BootcampCard({
  bootcamp,
  onEdit,
  onManageAdmins,
  onDelete,
  onOpenTools,
}: {
  bootcamp: BootcampSummary
  onEdit: () => void
  onManageAdmins: () => void
  onDelete: () => void
  onOpenTools: () => void
}) {
  const unassigned = bootcamp.admin_count === 0

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {bootcamp.name}
            <Badge variant="outline" className="font-normal">
              B{String(bootcamp.bootcamp_number).padStart(2, '0')}
            </Badge>
          </CardTitle>
          <CardDescription>{formatDate(bootcamp.starts_at)}</CardDescription>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label={`Actions for ${bootcamp.name}`} />}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{bootcamp.name}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>
              <SlidersHorizontal className="size-4" />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onManageAdmins}>
              <UserCog className="size-4" />
              Manage administrators
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/admin/phases" onClick={onOpenTools} />}>
              <CalendarClock className="size-4" />
              Phases and deadlines
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <BootcampStatusBadge status={bootcamp.status} />

        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Users} label="Applications" value={String(bootcamp.application_count)} />
          <Stat
            icon={ShieldCheck}
            label="Administrators"
            value={bootcamp.admin_count === 0 ? 'None' : String(bootcamp.admin_count)}
            tone={unassigned ? 'warning' : undefined}
          />
        </div>

        {bootcamp.admin_names.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Run by {bootcamp.admin_names.join(', ')}
          </p>
        )}

        {unassigned && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground dark:text-warning">
            No administrator assigned — nobody can manage this intake's candidates yet.
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Link
            to="/admin"
            onClick={onOpenTools}
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            Open dashboard
          </Link>
          <Link
            to="/admin/phases"
            onClick={onOpenTools}
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            <CalendarClock className="size-3.5" />
            Deadlines
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users
  label: string
  value: string
  tone?: 'warning'
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border p-3">
      <span
        className={
          tone === 'warning'
            ? 'grid size-8 shrink-0 place-items-center rounded-md bg-warning/15 text-warning-foreground dark:text-warning'
            : 'grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary'
        }
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
    </div>
  )
}
