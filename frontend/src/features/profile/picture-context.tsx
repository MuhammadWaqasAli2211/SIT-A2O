/**
 * One answer to "what does this user's profile picture look like right now?",
 * shared portal-wide — the same shape as `ApplicationProvider`, and for the
 * same reason.
 *
 * Before this existed, the navbar's `<UserAvatar>` was called with no
 * `pictureUrl` at all: the only fetch of `/profile/picture` lived inside
 * `account-page.tsx`'s own local state, so the header never showed a real
 * photo — not after upload, not after a full reload, not anywhere. Holding it
 * here instead means the header and the account page read one source, and
 * `reload()` is what the upload flow calls so both update the moment it
 * succeeds, with no page navigation or refresh needed — `register-page.tsx`,
 * where the only upload control lives, is mounted inside this same
 * `PortalLayout`, so the header sits in the same component tree the whole
 * time a candidate is filling in their registration form.
 */

import { createContext, useContext, type ReactNode } from 'react'

import { useAsync } from '@/hooks/use-async'
import { useAuth } from '@/hooks/use-auth'
import { pictureApi } from '@/features/registration/picture-api'
import { UserRole } from '@/lib/types'

export interface ProfilePictureState {
  /** Signed and short-lived; null until it loads, or if none was uploaded, or
   *  for a staff account (only candidates upload one). */
  pictureUrl: string | null
  /** Call after a successful upload so every consumer picks it up at once. */
  reload: () => void
}

const ProfilePictureContext = createContext<ProfilePictureState | null>(null)

export function ProfilePictureProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const isCandidate = profile?.role === UserRole.CANDIDATE

  const { data, refetch } = useAsync(
    () => (isCandidate ? pictureApi.current() : Promise.resolve(null)),
    [isCandidate],
  )

  return (
    <ProfilePictureContext value={{ pictureUrl: data?.url ?? null, reload: refetch }}>
      {children}
    </ProfilePictureContext>
  )
}

export function useProfilePicture(): ProfilePictureState {
  const value = useContext(ProfilePictureContext)
  if (!value) {
    throw new Error('useProfilePicture must be used inside a ProfilePictureProvider')
  }
  return value
}
