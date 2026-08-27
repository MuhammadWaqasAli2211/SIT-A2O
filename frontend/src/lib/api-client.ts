import axios, { AxiosError, AxiosHeaders } from 'axios'

import { tokenStore } from '@/lib/storage'
import type { ApiError, AuthResponse } from '@/lib/types'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers)

  const token = tokenStore.access
  if (token) headers.set('Authorization', `Bearer ${token}`)

  // The instance defaults to application/json, which would override the
  // multipart type *and* drop the boundary the server needs to split the
  // parts. Deleting it lets the browser set both.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    headers.delete('Content-Type')
  }

  config.headers = headers
  return config
})

/** Callback invoked when the session cannot be recovered; set by AuthProvider. */
let onSessionExpired: (() => void) | null = null
export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn
}

// A single in-flight refresh, shared by every request that got a 401, so a page
// firing several calls at once does not start several refreshes.
let refreshInFlight: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refresh_token = tokenStore.refresh
  if (!refresh_token) throw new Error('no refresh token')

  const { data } = await axios.post<AuthResponse>(
    `${api.defaults.baseURL}/auth/refresh`,
    { refresh_token },
    { headers: { 'Content-Type': 'application/json' } },
  )
  tokenStore.save(data.tokens)
  return data.tokens.access_token
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined
    const isExpired = error.response?.status === 401 && error.response.data?.code === 'token_expired'

    if (isExpired && original && !original._retried && tokenStore.refresh) {
      original._retried = true
      try {
        refreshInFlight ??= refreshAccessToken().finally(() => {
          refreshInFlight = null
        })
        const token = await refreshInFlight
        const headers = AxiosHeaders.from(original.headers)
        headers.set('Authorization', `Bearer ${token}`)
        original.headers = headers
        return api.request(original)
      } catch {
        tokenStore.clear()
        onSessionExpired?.()
      }
    }
    return Promise.reject(error)
  },
)

/** The API's own error code, when the failure came from the API at all.
 *  Callers branch on this; `toErrorMessage` is for what the user reads. */
export function toErrorCode(error: unknown): string | null {
  if (axios.isAxiosError<ApiError>(error)) return error.response?.data?.code ?? null
  return null
}

/** Normalise any thrown value into a message safe to show a user. */
export function toErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (axios.isAxiosError<ApiError>(error)) {
    if (!error.response) return 'Cannot reach the server. Is the API running?'
    return error.response.data?.message ?? fallback
  }
  return fallback
}
