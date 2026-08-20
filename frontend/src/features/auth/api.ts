import { api } from '@/lib/api-client'
import type { AuthResponse, Profile, SignupResponse } from '@/lib/types'

export interface SignupPayload {
  email: string
  password: string
  full_name: string
  phone?: string
}

export const authApi = {
  async signup(payload: SignupPayload) {
    const { data } = await api.post<SignupResponse>('/auth/signup', payload)
    return data
  },
  async login(email: string, password: string) {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
    return data
  },
  async me() {
    const { data } = await api.get<Profile>('/auth/me')
    return data
  },
  async logout() {
    await api.post('/auth/logout')
  },
}
