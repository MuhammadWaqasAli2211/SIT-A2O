/**
 * Granting AI Interviewer write permissions to individual administrators.
 *
 * Only writes appear here. Every admin can already *read* everything from the
 * AI Interviewer API, scoped to their own intakes — that is not withheld and
 * so is not grantable. What a super admin decides is who may additionally
 * send, delete, edit or decide.
 *
 * Each toggle is one grant or revoke, applied immediately and written to the
 * platform audit trail, so there is no save button to forget.
 */

import { AlertTriangle, KeyRound, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { Reveal } from '@/components/motion/reveal'
import { EmptyState, PageHeader } from '@/components/shared/portal-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { permissionApi } from '@/features/admin/api'
import { AsyncSection } from '@/features/admin/components'
import { useAsync, useMutation } from '@/hooks/use-async'
import { AI_SCOPE_LABEL, AiScope, type AdminGrants } from '@/lib/types'

const SCOPES = Object.values(AiScope)

export default function SuperAdminPermissionsPage() {
  const grants = useAsync(() => permissionApi.grants(), [])
  const key = useAsync(() => permissionApi.keyScopes(), [])

  return (
    <>
      <PageHeader
        title="AI interview permissions"
        description="Choose which administrators can perform write actions on InterviewerAI."
      />

      <div className="flex flex-col gap-5">
        <KeyCard loading={key.initialLoading} data={key.data} />

        <Alert>
          <ShieldCheck className="size-4" />
          <AlertDescription>
            Every administrator can already read interviews, reports, recordings and
            proctoring evidence for their own intakes. The permissions below are write
            actions only, and each one is recorded in the audit trail.
          </AlertDescription>
        </Alert>

        <AsyncSection
          initialLoading={grants.initialLoading}
          error={grants.error}
          onRetry={grants.refetch}
          skeleton={<Skeleton className="h-64 w-full rounded-xl" />}
        >
          {(grants.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No administrators yet"
              description="Create an administrator first — permissions are granted per person."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {grants.data?.map((admin) => (
                <AdminRow key={admin.profile_id} admin={admin} />
              ))}
            </div>
          )}
        </AsyncSection>
      </div>
    </>
  )
}

function KeyCard({
  loading,
  data,
}: {
  loading: boolean
  data: { name: string | null; company_name: string | null; scopes: string[] } | undefined
}) {
  if (loading) return <Skeleton className="h-28 w-full rounded-xl" />
  if (!data) return null

  return (
    <Reveal>
      <Card>
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <KeyRound className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">
              {data.name ?? 'InterviewerAI key'}
            </CardTitle>
            <CardDescription>
              {data.company_name ? `Company: ${data.company_name}. ` : ''}
              These are the scopes our own key holds — nothing beyond them can be granted.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {data.scopes.map((scope) => (
            <Badge key={scope} variant="outline" className="font-mono text-xs font-normal">
              {scope}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </Reveal>
  )
}

function AdminRow({ admin }: { admin: AdminGrants }) {
  // Held locally so a toggle reflects immediately rather than waiting for a
  // refetch of the whole table; the server's answer replaces it on return.
  const [scopes, setScopes] = useState<AiScope[]>(admin.scopes)

  const toggle = useMutation(async (scope: AiScope, next: boolean) => {
    const updated = next
      ? await permissionApi.grant(admin.profile_id, scope)
      : await permissionApi.revoke(admin.profile_id, scope)
    setScopes(updated)
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{admin.full_name ?? admin.email}</CardTitle>
        <CardDescription>{admin.email}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {toggle.error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{toggle.error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {SCOPES.map((scope) => {
            const held = scopes.includes(scope)
            return (
              <label
                key={scope}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm"
              >
                <span>{AI_SCOPE_LABEL[scope]}</span>
                <Switch
                  checked={held}
                  disabled={toggle.pending}
                  onCheckedChange={(next) => void toggle.run(scope, next)}
                  aria-label={`${AI_SCOPE_LABEL[scope]} for ${admin.email}`}
                />
              </label>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
