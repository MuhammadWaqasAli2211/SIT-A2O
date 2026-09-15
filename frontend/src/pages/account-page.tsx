/**
 * The signed-in user's own account — every role, one screen.
 *
 * Reached at `/account` by candidates and staff alike. The candidate-only
 * fields (CNIC, city, education) are shown only where they mean something, so
 * an admin does not see an onboarding form addressed to them.
 *
 * Writes go to `PATCH /auth/me`, which cannot reach `role` or `is_active` —
 * those are on separate super-admin endpoints by design.
 */

import {
  AlertTriangle,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PendingLabel } from '@/components/shared/pending-label'
import { PageHeader } from '@/components/shared/portal-ui'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { authApi } from '@/features/auth/api'
import { candidateApi } from '@/features/candidate/api'
import { RegistrationDetails } from '@/features/candidate/registration-details'
import { applicationsApi } from '@/features/applications/api'
import { AsyncSection } from '@/features/admin/components'
import { useProfilePicture } from '@/features/profile/picture-context'
import { useAsync, useMutation } from '@/hooks/use-async'
import { useAuth } from '@/hooks/use-auth'
import { ROLE_LABEL } from '@/lib/portal-nav'
import { UserRole, type UserDetail } from '@/lib/types'

export default function AccountPage() {
  const { profile, logout } = useAuth()
  const { data, error, initialLoading, refetch } = useAsync(() => candidateApi.myDetail(), [])

  const isCandidate = profile?.role === UserRole.CANDIDATE

  // Shared with the header's own avatar via `ProfilePictureProvider` — one
  // fetch, not two, so the two cannot show different pictures.
  const { pictureUrl } = useProfilePicture()

  // Candidate-only and non-essential: staff have no application, and a
  // failure here should leave the rest of the page working. `useAsync`
  // surfaces its own error, which is why it is not folded into `myDetail`.
  const { data: applications } = useAsync(
    () => (isCandidate ? applicationsApi.mine() : Promise.resolve([])),
    [isCandidate],
  )

  // The full profile, which `/auth/me/detail` deliberately does not carry:
  // its `CandidateProfileSummary` is narrowed so the admin user directory —
  // which shares that response shape — cannot see a candidate's father's CNIC
  // or picture path. Widening it there would leak those to every admin, so
  // the wide shape is fetched from `/auth/me` instead, which is only ever
  // about the caller themselves.
  const { data: fullProfile } = useAsync(
    () => (isCandidate ? authApi.me() : Promise.resolve(null)),
    [isCandidate],
  )

  // The live application if there is one, else the most recent — the same
  // rule the dashboard uses, so the code shown here matches the one there.
  const application =
    applications?.find((a) => a.status === 'ACTIVE') ?? applications?.[0] ?? null

  return (
    <>
      <PageHeader
        title="Profile & settings"
        description="Your details, and how you sign in."
      />

      <AsyncSection
        initialLoading={initialLoading}
        error={error}
        onRetry={refetch}
      >
        {data && (
          <div className="grid gap-5 lg:grid-cols-3">
            <IdentityCard
              detail={data}
              pictureUrl={pictureUrl}
              onSignOut={() => void logout()}
            />
            {/* Keyed on the server's own values so a save remounts the form
                with the saved copy, rather than syncing it through an effect. */}
            <DetailsForm
              key={`${data.full_name}:${data.phone}:${data.candidate_profile?.cnic}`}
              detail={data}
              isCandidate={isCandidate}
              onSaved={refetch}
            />

            {isCandidate && (
              <RegistrationDetails
                candidate={fullProfile?.candidate_profile ?? null}
                candidateCode={application?.candidate_code}
                bootcampName={application?.bootcamp_name}
              />
            )}
          </div>
        )}
      </AsyncSection>
    </>
  )
}

function IdentityCard({
  detail,
  pictureUrl,
  onSignOut,
}: {
  detail: UserDetail
  /** Signed and short-lived; null until it loads, or if none was uploaded. */
  pictureUrl: string | null
  onSignOut: () => void
}) {
  return (
    <Card className="lg:col-span-1">
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        {/* The generic bust glyph remains the fallback: the URL is signed
            and expires, and staff never upload a picture at all. */}
        <UserAvatar pictureUrl={pictureUrl} size="xl" className="border border-border" />

        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{detail.full_name ?? 'Your name'}</h2>
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5" />
            {detail.email}
          </p>
        </div>

        <Badge variant="outline" className="gap-1.5 font-normal">
          <ShieldCheck className="size-3.5" />
          {ROLE_LABEL[detail.role]}
        </Badge>

        {detail.application_count > 0 && (
          <p className="text-sm text-muted-foreground">
            {detail.application_count} application
            {detail.application_count === 1 ? '' : 's'}
          </p>
        )}

        <Separator />

        <div className="flex w-full flex-col gap-2 text-left">
          <p className="text-xs text-muted-foreground">
            Your email address and password are managed by the sign-in system. To change your
            password, sign out and use “Forgot password”.
          </p>
          <Button variant="outline" onClick={onSignOut} className="w-full">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailsForm({
  detail,
  isCandidate,
  onSaved,
}: {
  detail: UserDetail
  isCandidate: boolean
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(detail.full_name ?? '')
  const [phone, setPhone] = useState(detail.phone ?? '')
  const [cnic, setCnic] = useState(detail.candidate_profile?.cnic ?? '')
  const [dob, setDob] = useState(detail.candidate_profile?.date_of_birth ?? '')
  const [city, setCity] = useState(detail.candidate_profile?.city ?? '')
  const [education, setEducation] = useState(detail.candidate_profile?.education ?? '')

  const save = useMutation(() =>
    candidateApi.updateProfile({
      full_name: fullName,
      phone: phone || null,
      // Candidate-only fields are omitted entirely for staff, so the API is
      // never asked to create a candidate_profile row for an administrator.
      ...(isCandidate
        ? {
            cnic: cnic || null,
            date_of_birth: dob || null,
            city: city || null,
            education: education || null,
          }
        : {}),
    }),
  )

  async function submit() {
    if (await save.run()) {
      toast.success('Profile updated')
      onSaved()
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Your details</CardTitle>
        <CardDescription>
          {isCandidate
            ? 'Kept with your application. Administrators can see these.'
            : 'How you appear to other administrators.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-name">Full name</Label>
            <Input
              id="ac-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={150}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-phone">Phone</Label>
            <Input
              id="ac-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={30}
              placeholder="03xx xxxxxxx"
            />
          </div>
        </div>

        {isCandidate && (
          <>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ac-cnic">CNIC</Label>
                <Input
                  id="ac-cnic"
                  value={cnic}
                  onChange={(event) => setCnic(event.target.value)}
                  maxLength={20}
                  placeholder="42101-1234567-8"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ac-dob">Date of birth</Label>
                <Input
                  id="ac-dob"
                  type="date"
                  value={dob}
                  onChange={(event) => setDob(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ac-city">City</Label>
                <Input
                  id="ac-city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  maxLength={80}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ac-education">Highest education</Label>
                <Input
                  id="ac-education"
                  value={education}
                  onChange={(event) => setEducation(event.target.value)}
                  maxLength={120}
                  placeholder="BSc Computer Science"
                />
              </div>
            </div>
          </>
        )}

        {save.error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{save.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button onClick={submit} disabled={save.pending}>
            <Save className="size-4" />
            <PendingLabel idle="Save changes" pending="Saving…" isPending={save.pending} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
