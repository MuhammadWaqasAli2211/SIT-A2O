/** Mirrors app/models/enums.py — keep both in sync. */
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CANDIDATE: 'CANDIDATE',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

/** Person-level details captured at registration. Null until somebody registers. */
export interface CandidateProfile {
  full_name: string | null
  father_name: string | null
  gender: string | null
  date_of_birth: string | null
  city: string | null
  phone: string | null
  father_phone: string | null
  cnic: string | null
  father_cnic: string | null
  address: string | null
  saylani_roll_number: string | null
  education: string | null
  picture_path: string | null
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  candidate_profile: CandidateProfile | null
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
