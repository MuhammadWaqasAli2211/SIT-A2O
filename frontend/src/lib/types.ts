/** Mirrors app/models/enums.py — keep both in sync. */
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CANDIDATE: 'CANDIDATE',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface AuthResponse {
  tokens: TokenPair
  profile: Profile | null
}

export interface SignupResponse {
  message: string
  email: string
  email_confirmation_required: boolean
}

/** Shape of every error the API returns; see backend app/main.py handlers. */
export interface ApiError {
  code: string
  message: string
  details?: unknown
}

/** Landing route per role, used after login and by the guards. */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  SUPER_ADMIN: '/super-admin',
  ADMIN: '/admin',
  CANDIDATE: '/dashboard',
}
