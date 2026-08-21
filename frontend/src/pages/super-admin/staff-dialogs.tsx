/**
 * Provisioning a staff account, and resetting one's password.
 *
 * Both talk to endpoints that reach GoTrue's admin API, so both are
 * super-admin only. The password rules mirror the backend's `StaffCreate`
 * minimum of 12 characters — validated here for feedback, enforced there.
 */

import { AlertTriangle, Copy, Loader2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PasswordInput } from '@/components/shared/password-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { userApi } from '@/features/admin/api'
import { useMutation } from '@/hooks/use-async'
import { ROLE_LABEL } from '@/lib/portal-nav'
import { UserRole, type UserRow } from '@/lib/types'

const MIN_PASSWORD = 12

/**
 * A password that satisfies the backend's rules on the first try.
 *
 * Offered rather than required: an operator setting a memorable password for
 * a colleague is a legitimate flow, but most of the time they just want one
 * that works.
 */
function suggestPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const values = crypto.getRandomValues(new Uint32Array(16))
  return Array.from(values, (n) => alphabet[n % alphabet.length]).join('')
}

export function StaffFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  // Unmounted while closed, so reopening starts from a clean form without an
  // effect resetting six fields.
  if (!open) return null
  return <StaffForm onOpenChange={onOpenChange} onSaved={onSaved} />
}

function StaffForm({
  onOpenChange,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>(UserRole.ADMIN)

  const create = useMutation(() =>
    userApi.createStaff({
      email: email.trim(),
      password,
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      role,
    }),
  )

  async function submit() {
    if (await create.run()) {
      toast.success(`${email} created as ${ROLE_LABEL[role]}`)
      onOpenChange(false)
      onSaved()
    }
  }

  const valid =
    /\S+@\S+\.\S+/.test(email) && fullName.trim().length > 0 && password.length >= MIN_PASSWORD

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New administrator</DialogTitle>
          <DialogDescription>
            The account is created with its email already confirmed, so it can sign in
            immediately. Assign it to an intake from the Bootcamps screen afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="staff-name">Full name</Label>
            <Input
              id="staff-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={150}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-phone">Phone (optional)</Label>
              <Input
                id="staff-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={30}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="staff-role">Role</Label>
            <Select value={role} onValueChange={(value) => value && setRole(value as UserRole)}>
              <SelectTrigger id="staff-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.ADMIN}>{ROLE_LABEL.ADMIN}</SelectItem>
                <SelectItem value={UserRole.SUPER_ADMIN}>{ROLE_LABEL.SUPER_ADMIN}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === UserRole.ADMIN
                ? 'Sees only the intakes you assign to them.'
                : 'Sees every intake and can manage other administrators.'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="staff-password">Temporary password</Label>
            <div className="flex gap-2">
              <PasswordInput
                id="staff-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = suggestPassword()
                  setPassword(next)
                  void navigator.clipboard?.writeText(next).then(
                    () => toast.success('Password generated and copied'),
                    () => toast.success('Password generated'),
                  )
                }}
              >
                <Copy className="size-4" />
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              At least {MIN_PASSWORD} characters. Share it with them directly — it is not
              emailed, and cannot be read back afterwards.
            </p>
          </div>

          {create.error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{create.error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || create.pending}>
            {create.pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: UserRow | null
  onClose: () => void
}) {
  // Keyed per account so switching targets never carries a typed password
  // across to a different user.
  if (!user) return null
  return <ResetPasswordForm key={user.id} user={user} onClose={onClose} />
}

function ResetPasswordForm({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState('')

  const reset = useMutation(() => userApi.resetPassword(user.id, password))

  async function submit() {
    if ((await reset.run()) !== undefined) {
      toast.success(`Password reset for ${user.email}`)
      onClose()
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Sets a new password for {user.email} immediately. Existing sessions stay valid
            until their tokens expire.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password">New password</Label>
            <div className="flex gap-2">
              <PasswordInput
                id="reset-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = suggestPassword()
                  setPassword(next)
                  void navigator.clipboard?.writeText(next).then(
                    () => toast.success('Password generated and copied'),
                    () => toast.success('Password generated'),
                  )
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
          </div>

          {reset.error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{reset.error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reset.pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={password.length < MIN_PASSWORD || reset.pending}>
            {reset.pending && <Loader2 className="size-4 animate-spin" />}
            Reset password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
