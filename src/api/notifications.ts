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

/**
 * Every type the server's `notification_type` enum can hold.
 *
 * Kept in step with `CGS-server/src/db/schema.ts`. It is deliberately a plain
 * union and not exhaustive-checked anywhere: `adaptNotification` returns null
 * for anything it doesn't recognise, so the next type added on the other side
 * is a row we skip rather than a panel that breaks.
 */
export type WireNotificationType =
  | 'sale'
  | 'invite'
  | 'agent_fired'
  | 'published'
  | 'payout_held'
  | 'payout_settled'
  | 'agent_underfunded'
  | 'agent_cancelled'
  | 'agent_failed'
  | 'agent_target_gone'
  | 'build_updated'
  | 'price_drop'
  | 'review_reply'
  | 'report_resolved'

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
