import { request } from '@/lib/api'

/**
 * The inbox.
 *
 * The server sends a `type` and a `payload` of facts; it does not send prose.
 * That split is deliberate and worth keeping: the wording of a row is a design
 * decision that belongs next to the design system, and copy baked into a
 * database row cannot be changed without a migration.
 *
 * Money arrives twice, as everywhere else: integer `*Units` plus a `*Usd`
 * float the server derived. Nothing here does arithmetic on either.
 */

export type WireNotificationType = 'sale' | 'invite' | 'agent_fired' | 'published'

export interface WireNotification {
  id: string
  userId: string
  type: WireNotificationType
  payload: Record<string, unknown>
  createdAt: string
  readAt: string | null
}

export interface WireNotificationPage {
  notifications: WireNotification[]
  nextCursor: string | null
}

export function listNotifications(
  signal?: AbortSignal,
): Promise<WireNotificationPage> {
  return request<WireNotificationPage>('/api/notifications', {
    query: { limit: 30 },
    signal,
  })
}

export function markNotificationRead(id: string): Promise<WireNotification> {
  return request<WireNotification>(`/api/notifications/${id}/read`, {
    method: 'POST',
  })
}

/** One gesture, one request. Marking thirty rows read is not thirty requests. */
export function markAllNotificationsRead(): Promise<{ read: number }> {
  return request<{ read: number }>('/api/notifications/read-all', {
    method: 'POST',
  })
}
