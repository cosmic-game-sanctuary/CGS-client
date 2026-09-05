import { useSyncExternalStore } from 'react'

/**
 * The inbox.
 *
 * Everything here is something that happened *to you* while you weren't
 * looking: a sale on a game you're credited on, an invite to a studio, an
 * agent that finally bought the thing it was watching. It is a feed of facts,
 * not a marketing channel, so there is no "new games you might like" kind here
 * and there shouldn't be one.
 *
 * It renders with **Print** (DESIGN.md §4) because that's what it is: rows
 * arriving on a receipt.
 *
 * TODO(integration): these arrive from the backend. Sales and payouts are
 * derived from the HCS topic, so the same events are independently verifiable
 * rather than being ours to assert.
 */

export type NotificationKind = 'sale' | 'invite' | 'agent' | 'live'

export interface AppNotification {
  id: string
  kind: NotificationKind
  at: string
  /** One line, written as a fact. */
  title: string
  /** Optional second line. Detail, never justification. */
  detail?: string
  /** Money attached, when there is any. Rendered in mono, like all ledger values. */
  amountUsd?: number
  /** Where clicking it goes. */
  to?: string
  read: boolean
}

let items: AppNotification[] = []
const listeners = new Set<() => void>()
let sequence = 0

function set(next: AppNotification[]) {
  items = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return items
}

/** Newest first. */
export function useNotifications(): AppNotification[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useUnreadCount(): number {
  return useNotifications().filter((item) => !item.read).length
}

export function notify(input: {
  kind: NotificationKind
  title: string
  detail?: string
  amountUsd?: number
  to?: string
  /** Backdated, for things that happened before you looked. */
  at?: string
  read?: boolean
}): AppNotification {
  sequence += 1
  const item: AppNotification = {
    id: `nt_${sequence}`,
    kind: input.kind,
    at: input.at ?? new Date().toISOString(),
    title: input.title,
    detail: input.detail,
    amountUsd: input.amountUsd,
    to: input.to,
    read: input.read ?? false,
  }
  set(
    [item, ...items].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
  )
  return item
}

export function markRead(id: string) {
  if (!items.some((item) => item.id === id && !item.read)) return
  set(items.map((item) => (item.id === id ? { ...item, read: true } : item)))
}

export function markAllRead() {
  if (items.every((item) => item.read)) return
  set(items.map((item) => ({ ...item, read: true })))
}

/** The inbox belongs to the account, so it goes when the account does. */
export function clearInbox() {
  set([])
}

const AGO = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()

/**
 * TODO(demo): delete with the rest of the mocks. A studio you just joined has
 * history, and an empty inbox would hide the whole screen. Sales are the only
 * thing seeded; everything else in here is a real event from the app.
 */
export function seedStudioActivity(
  studioGames: Array<{ title: string; slug: string }>,
  yourShare: (index: number) => number,
) {
  studioGames.slice(0, 3).forEach((game, i) => {
    notify({
      kind: 'sale',
      title: `${game.title} sold`,
      detail: 'Settled on chain. Your share is already in your wallet.',
      amountUsd: yourShare(i),
      to: `/game/${game.slug}`,
      at: AGO(37 + i * 214),
      read: i > 0,
    })
  })
}
