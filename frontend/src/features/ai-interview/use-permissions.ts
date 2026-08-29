/**
 * Which AI Interviewer writes the signed-in admin may perform.
 *
 * Used to disable a control rather than let an admin click something that
 * will come back 403. The backend enforces the same rule independently — this
 * is for the affordance, never for the security.
 */

import { permissionApi } from '@/features/admin/api'
import { useAsync } from '@/hooks/use-async'
import type { AiScope } from '@/lib/types'

export function useAiPermissions() {
  const { data, initialLoading } = useAsync(() => permissionApi.mine(), [])
  const scopes = data ?? []

  return {
    scopes,
    loading: initialLoading,
    /** Treated as "no" while still loading: offering a write and withdrawing
        it a moment later reads as a bug, the reverse just settles. */
    can: (scope: AiScope) => scopes.includes(scope),
  }
}
