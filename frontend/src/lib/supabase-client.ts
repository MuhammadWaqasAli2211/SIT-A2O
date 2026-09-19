import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Used for exactly one thing: the OAuth redirect handshake (Google today).
 * Everything else in the app — login, session refresh, every data call —
 * goes through our own backend, which verifies Supabase-issued JWTs itself
 * and never asks Supabase again per request. This client's own session
 * persistence and auto-refresh are switched off so it cannot grow into a
 * second, competing source of truth for "who is signed in": `tokenStore`
 * (see `@/lib/storage`) stays the only place that answers that.
 *
 * Built lazily, on first call, rather than as a module-level constant:
 * `createClient` throws synchronously if the URL is missing, and a
 * module-level throw takes the whole page down with it — the login page
 * itself failed to render entirely on an environment with no
 * `VITE_SUPABASE_URL` set yet, not just the Google button on it. Deferred
 * like this, an unconfigured environment only breaks Google sign-in, at the
 * moment someone actually clicks it.
 */
let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error(
        'Google sign-in is not configured yet (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing).',
      )
    }
    client = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        // The one thing this client is for: reading the `?code=` (or, on an
        // older GoTrue, the `#access_token=`) the OAuth redirect lands with.
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
