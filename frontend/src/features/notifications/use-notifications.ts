/**
 * Candidate-only: polls `/notifications` every 30s. No websocket/SSE in this
 * backend, so polling is the whole delivery mechanism — see the bell in
 * portal-layout.tsx for where this is consumed.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { notificationsApi, type NotificationRow } from '@/features/notifications/api'

const POLL_MS = 30_000

export interface UseNotificationsOptions {
  /** Skip entirely for a role with no notification source yet (staff). */
  enabled?: boolean
}

export function useNotifications({ enabled = true }: UseNotificationsOptions = {}) {
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  // Guards the initial fetch only — a poll tick failing silently is fine,
  // the previous list just stays on screen until the next one succeeds.
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const page = await notificationsApi.list()
      setItems(page.items)
      setUnreadCount(page.unread_count)
    } finally {
      loadedOnce.current = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [enabled, refresh])

  const markRead = useCallback(async (id: string) => {
    // Optimistic: the candidate has already seen it by clicking, no need to
    // wait on the round trip before the dot updates.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
    await notificationsApi.markRead(id)
  }, [])

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    await notificationsApi.markAllRead()
  }, [])

  return { items, unreadCount, markRead, markAllRead }
}
