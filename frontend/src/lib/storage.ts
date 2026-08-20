import type { TokenPair } from '@/lib/types'

const ACCESS_KEY = 'sit.access_token'
const REFRESH_KEY = 'sit.refresh_token'

/** Token persistence.
 *
 * localStorage keeps sessions across reloads and matches Supabase's own default,
 * but it is readable by any script on the page, so an XSS bug becomes a session
 * compromise. Moving to httpOnly cookies is tracked in docs/security.md.
 * Confining access to this module keeps that migration to one file.
 */
export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  save(tokens: TokenPair) {
    localStorage.setItem(ACCESS_KEY, tokens.access_token)
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}
