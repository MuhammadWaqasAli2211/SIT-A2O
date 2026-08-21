import {
  KeyRound,
  MoreHorizontal,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { userApi } from '@/features/admin/api'
import {
  AsyncSection,
  ConfirmDialog,
  Pagination,
  useConfirm,
} from '@/features/admin/components'
import { StaffFormDialog, ResetPasswordDialog } from '@/pages/super-admin/staff-dialogs'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useAuth } from '@/hooks/use-auth'
import { useDebounced } from '@/hooks/use-debounced'
import { UserRole, type UserRow } from '@/lib/types'
import { ROLE_LABEL } from '@/lib/portal-nav'

const PAGE_SIZE = 25
const ALL = 'ALL'

/** Staff only — candidates live on the bootcamp Candidates screen. */
const STAFF_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function SuperAdminAdminsPage() {
  const { profile } = useAuth()

  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string>(ALL)
  const [offset, setOffset] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [resetting, setResetting] = useState<UserRow | null>(null)

  const debouncedSearch = useDebounced(search, 300)

  // Two calls rather than one: the directory endpoint filters by a single
  // role, and "all staff" means two of the three.
  const { data, error, initialLoading, refetch } = useAsync(async () => {
    const params = { search: debouncedSearch || undefined, limit: PAGE_SIZE, offset }
    if (role !== ALL) return userApi.list({ ...params, role: role as UserRole })

    const [supers, admins] = await Promise.all([
      userApi.list({ ...params, role: UserRole.SUPER_ADMIN }),
      userApi.list({ ...params, role: UserRole.ADMIN }),
    ])
    return {
      items: [...supers.items, ...admins.items],
      total: supers.total + admins.total,
      limit: PAGE_SIZE,
      offset,
    }
  }, [role, debouncedSearch, offset])

  const rows = data?.items ?? []

  const demote = useConfirm<UserRow>()
  const deactivate = useConfirm<UserRow>()
  const remove = useConfirm<UserRow>()

  const demoteMutation = useMutation((row: UserRow) =>
    userApi.changeRole(row.id, UserRole.CANDIDATE, 'Demoted from the Administrators screen'),
  )
  const activeMutation = useMutation((row: UserRow) => userApi.setActive(row.id, !row.is_active))
  const deleteMutation = useMutation((row: UserRow) => userApi.remove(row.id))

  async function run(
    mutation: { run: (row: UserRow) => Promise<unknown> },
    target: UserRow | null,
    message: string,
    close: () => void,
  ) {
    if (!target) return
    if ((await mutation.run(target)) !== undefined) {
      toast.success(message)
      close()
      refetch()
    }
  }

  return (
    <>
      <PageHeader
        title="Administrators"
        description="Provision staff accounts, control access, and assign them to intakes."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" />
            New administrator
          </Button>
        }
      />

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
              placeholder="Search by name, email, or phone"
              className="pl-9"
            />
          </div>

          <Select
            value={role}
            onValueChange={(value) => {
              if (!value) return
              setRole(value)
              setOffset(0)
            }}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All staff</SelectItem>
              {STAFF_ROLES.map((value) => (
                <SelectItem key={value} value={value}>
                  {ROLE_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AsyncSection initialLoading={initialLoading} error={error} onRetry={refetch}>
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={debouncedSearch ? 'No matches' : 'No administrators yet'}
              description={
                debouncedSearch
                  ? 'Try a different search.'
                  : 'Create a staff account, then assign it to an intake from the Bootcamps screen.'
              }
              action={
                !debouncedSearch ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <UserPlus className="size-4" />
                    New administrator
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Administrator</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="hidden md:table-cell">Intakes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Added</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const isSelf = row.id === profile?.id
                        return (
                          <TableRow key={row.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {row.full_name ?? '—'}
                                  {isSelf && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      (you)
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground">{row.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.role === UserRole.SUPER_ADMIN ? 'default' : 'outline'
                                }
                                className="font-normal"
                              >
                                {ROLE_LABEL[row.role]}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {row.bootcamp_count === 0 ? 'None' : row.bootcamp_count}
                            </TableCell>
                            <TableCell>
                              {row.is_active ? (
                                <span className="text-sm text-success">Active</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">Deactivated</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(row.created_at)}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Actions for ${row.email}`}
                                    />
                                  }
                                >
                                  <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuGroup>
                                    <DropdownMenuLabel>{row.email}</DropdownMenuLabel>
                                  </DropdownMenuGroup>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setResetting(row)}>
                                    <KeyRound className="size-4" />
                                    Reset password
                                  </DropdownMenuItem>
                                  {/* Self-actions are refused server-side with a
                                      409; hiding them avoids offering a dead end. */}
                                  {!isSelf && (
                                    <>
                                      <DropdownMenuItem onClick={() => deactivate.ask(row)}>
                                        <ShieldOff className="size-4" />
                                        {row.is_active ? 'Deactivate' : 'Reactivate'}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => demote.ask(row)}>
                                        <ShieldCheck className="size-4" />
                                        Demote to candidate
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => remove.ask(row)}
                                      >
                                        <Trash2 className="size-4" />
                                        Delete account
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
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

      <StaffFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={refetch} />

      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
      />

      <ConfirmDialog
        open={demote.open}
        onOpenChange={(open) => !open && demote.close()}
        title="Demote to candidate?"
        description={`${demote.target?.email} will lose all administrator access, and any intake assignments will be removed.`}
        confirmLabel="Demote"
        destructive
        pending={demoteMutation.pending}
        error={demoteMutation.error}
        onConfirm={() =>
          run(demoteMutation, demote.target, 'Account demoted', demote.close)
        }
      />

      <ConfirmDialog
        open={deactivate.open}
        onOpenChange={(open) => !open && deactivate.close()}
        title={deactivate.target?.is_active ? 'Deactivate account?' : 'Reactivate account?'}
        description={
          deactivate.target?.is_active
            ? `${deactivate.target?.email} will be signed out on their next request. Role is read per call, so this takes effect immediately.`
            : `${deactivate.target?.email} will be able to sign in again.`
        }
        confirmLabel={deactivate.target?.is_active ? 'Deactivate' : 'Reactivate'}
        pending={activeMutation.pending}
        error={activeMutation.error}
        onConfirm={() =>
          run(activeMutation, deactivate.target, 'Account updated', deactivate.close)
        }
      />

      <ConfirmDialog
        open={remove.open}
        onOpenChange={(open) => !open && remove.close()}
        title="Delete this account?"
        description={`${remove.target?.email} will be removed from authentication entirely. If they hold any applications the server will refuse — deactivate instead.`}
        confirmLabel="Delete permanently"
        destructive
        pending={deleteMutation.pending}
        error={deleteMutation.error}
        onConfirm={() => run(deleteMutation, remove.target, 'Account deleted', remove.close)}
      />
    </>
  )
}
