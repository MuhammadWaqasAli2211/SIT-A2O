/**
 * Assign and unassign the administrators who run one intake.
 *
 * Only ADMIN and SUPER_ADMIN accounts can be assigned — the server enforces
 * that too, but filtering the picker means an operator never picks a candidate
 * and gets a 409 for their trouble.
 */

import { AlertTriangle, Loader2, ShieldCheck, UserMinus, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { bootcampApi, userApi } from '@/features/admin/api'
import { useAsync, useMutation } from '@/hooks/use-async'
import { UserRole, type BootcampSummary } from '@/lib/types'

export function ManageAdminsDialog({
  bootcamp,
  onClose,
  onChanged,
}: {
  bootcamp: BootcampSummary | null
  onClose: () => void
  onChanged: () => void
}) {
  const [picked, setPicked] = useState('')

  const assigned = useAsync(
    () => (bootcamp ? bootcampApi.admins(bootcamp.id) : Promise.resolve(undefined)),
    [bootcamp?.id],
  )

  // Every staff account, so the picker can offer the ones not yet assigned.
  const staff = useAsync(
    () =>
      bootcamp
        ? Promise.all([
            userApi.list({ role: UserRole.ADMIN, is_active: true, limit: 100 }),
            userApi.list({ role: UserRole.SUPER_ADMIN, is_active: true, limit: 100 }),
          ])
        : Promise.resolve(undefined),
    [bootcamp?.id],
  )

  const assignable = useMemo(() => {
    if (!staff.data) return []
    const already = new Set((assigned.data ?? []).map((a) => a.id))
    return [...staff.data[0].items, ...staff.data[1].items].filter((u) => !already.has(u.id))
  }, [staff.data, assigned.data])

  const assign = useMutation((profileId: string) =>
    bootcampApi.assignAdmin(bootcamp!.id, profileId),
  )
  const unassign = useMutation((profileId: string) =>
    bootcampApi.unassignAdmin(bootcamp!.id, profileId),
  )

  function reload() {
    assigned.refetch()
    onChanged()
  }

  async function doAssign() {
    if (!picked) return
    if ((await assign.run(picked)) !== undefined) {
      toast.success('Administrator assigned')
      setPicked('')
      reload()
    }
  }

  async function doUnassign(profileId: string, label: string) {
    if ((await unassign.run(profileId)) !== undefined) {
      toast.success(`Removed ${label}`)
      reload()
    }
  }

  return (
    <Dialog open={bootcamp !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Administrators</DialogTitle>
          <DialogDescription>
            Who can manage {bootcamp?.name}. An admin only ever sees the intakes assigned to
            them here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Currently assigned</span>

            {assigned.initialLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (assigned.data ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                Nobody is assigned yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(assigned.data ?? []).map((admin) => (
                  <li
                    key={admin.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <ShieldCheck className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {admin.full_name ?? admin.email}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{admin.email}</span>
                    </div>
                    {admin.role === UserRole.SUPER_ADMIN && (
                      <Badge variant="outline" className="shrink-0 text-[0.7rem] font-normal">
                        Super
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${admin.email}`}
                      disabled={unassign.pending}
                      onClick={() => doUnassign(admin.id, admin.full_name ?? admin.email)}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Assign someone</span>

            {staff.initialLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : assignable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every active administrator is already assigned. Create one from the
                Administrators screen first.
              </p>
            ) : (
              <div className="flex gap-2">
                <Select value={picked} onValueChange={(value) => value && setPicked(value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choose an administrator" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name ?? user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={doAssign} disabled={!picked || assign.pending}>
                  {assign.pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Assign
                </Button>
              </div>
            )}
          </div>

          {(assign.error || unassign.error || assigned.error) && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                {assign.error ?? unassign.error ?? assigned.error}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
