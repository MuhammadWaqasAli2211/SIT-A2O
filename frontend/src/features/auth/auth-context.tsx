import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { authApi } from '@/features/auth/api'
import { setSessionExpiredHandler } from '@/lib/api-client'
import { tokenStore } from '@/lib/storage'
import type { Profile } from '@/lib/types'

interface AuthContextValue {
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<Profile>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  // Starts true so guards wait for the session check instead of bouncing
  // an authenticated user to /login on first paint.
  const [isLoading, setIsLoading] = useState(true)

  const clearSession = useCallback(() => {
    tokenStore.clear()
    setProfile(null)
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(clearSession)
  }, [clearSession])

  useEffect(() => {
    if (!tokenStore.access) {
      setIsLoading(false)
      return
    }
    let active = true
    authApi
      .me()
      .then((me) => active && setProfile(me))
      .catch(() => active && clearSession())
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    const { tokens, profile: me } = await authApi.login(email, password)
    tokenStore.save(tokens)
    const resolved = me ?? (await authApi.me())
    setProfile(resolved)
    return resolved
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo(
    () => ({ profile, isLoading, isAuthenticated: profile !== null, login, logout }),
    [profile, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
