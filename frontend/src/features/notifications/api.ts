import { api } from '@/lib/api-client'

/** Mirrors NotificationOut. */
export interface NotificationRow {
  id: string
  application_id: string | null
  title: string
  body: string
  read: boolean
  created_at: string
}

/** Mirrors NotificationPage. */
export interface NotificationPageResponse {
  items: NotificationRow[]
  unread_count: number
}

export const notificationsApi = {
  async list() {
    const { data } = await api.get<NotificationPageResponse>('/notifications')
    return data
  },

  async markRead(id: string) {
    const { data } = await api.post<NotificationRow>(`/notifications/${id}/read`)
    return data
  },

  markAllRead: () => api.post('/notifications/read-all'),
}
