import { useCallback, useEffect, useState } from 'react'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type WireNotification,
} from '@/api/notifications'
import { useSession } from '@/auth/session'

/**
 * The inbox, as the panel wants it.
 *
 * Everything here is something that happened *to you* while you weren't
 * looking: a sale on a game you're credited on, an invite to a studio, an
 * agent that finally bought the thing it was watching. It is a feed of facts,
 * not a marketing channel, so there is no "new games you might like" kind and
 * there shouldn't be one.
 *
 * The server sends `type` plus a payload of facts. Every sentence below is
 * written here, because copy is a design decision and a row already written
 * into a database cannot be reworded without a migration.
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

function str(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key]
  return typeof value === 'string' ? value : undefined
}

function num(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key]
  return typeof value === 'number' ? value : undefined
}

/** A game the row can point at, by slug when there is one and id otherwise. */
function gameLink(payload: Record<string, unknown>): string | undefined {
  const key = str(payload, 'slug') ?? str(payload, 'gameId')
  return key ? `/game/${key}` : undefined
}

export function adaptNotification(wire: WireNotification): AppNotification {
  const p = wire.payload ?? {}
  const base = { id: wire.id, at: wire.createdAt, read: wire.readAt !== null }
  const title = str(p, 'title') ?? 'your game'

  switch (wire.type) {
    case 'sale': {
      const share = num(p, 'shareUsd')
      return {
        ...base,
        kind: 'sale',
        title: `${title} sold`,
        // Only claim a share when this person is actually on the splits. A
        // studio owner who credited the work to other people still wants to
        // know it sold, and telling them they earned nothing would be true
        // but useless.
        detail:
          share === undefined
            ? 'Settled on chain.'
            : 'Settled on chain. Your share is already in your wallet.',
        amountUsd: share,
        to: gameLink(p),
      }
    }

    case 'published':
      return {
        ...base,
        kind: 'live',
        title: `${title} is live`,
        detail: 'It is in the catalog and anyone can play it.',
        to: gameLink(p),
      }

    case 'invite': {
      const handle = str(p, 'handle')
      const studio = str(p, 'studioName')
      const studioKey = str(p, 'studioSlug') ?? str(p, 'studioId')
      return {
        ...base,
        kind: 'invite',
        title: handle
          ? `${handle} joined${studio ? ` ${studio}` : ' your studio'}`
          : 'Someone joined your studio',
        detail: 'They claimed the share that was waiting for them.',
        to: studioKey ? `/studio/${studioKey}` : undefined,
      }
    }

    case 'agent_fired': {
      const paid = num(p, 'priceUsd')
      const trigger = num(p, 'triggerPriceUsd')
      const name = str(p, 'title')
      return {
        ...base,
        kind: 'agent',
        title: name ? `Your agent bought ${name}` : 'Your agent bought a game',
        detail:
          paid !== undefined && trigger !== undefined
            ? `It hit $${paid.toFixed(2)}, under your $${trigger.toFixed(2)} trigger. The key is in your wallet.`
            : 'The key is in your wallet.',
        amountUsd: paid,
        to: gameLink(p),
      }
    }
  }
}

/**
 * Polling, not a socket. Every row here is something the server wrote minutes
 * ago at the earliest, and a purchase already updates the screen it happened
 * on, so there is nothing a live connection would make feel faster.
 */
const POLL_MS = 60_000

export function useNotifications() {
  const session = useSession()
  const [items, setItems] = useState<AppNotification[]>([])

  const signedIn = session.signedIn

  useEffect(() => {
    if (!signedIn) return

    let live = true
    const controller = new AbortController()

    function load() {
      listNotifications(controller.signal)
        .then((page) => {
          if (live) setItems(page.notifications.map(adaptNotification))
        })
        .catch(() => {
          // The bell is not worth an error state. A failed poll leaves the
          // last good list on screen and tries again on the next tick.
        })
    }

    load()
    const timer = window.setInterval(load, POLL_MS)
    return () => {
      live = false
      controller.abort()
      window.clearInterval(timer)
    }
  }, [signedIn])

  // Marked read locally first: the row is already open in front of the reader,
  // and a round trip before the highlight clears would look like a bug.
  const markRead = useCallback((id: string) => {
    setItems((all) =>
      all.map((item) => (item.id === id ? { ...item, read: true } : item)),
    )
    void markNotificationRead(id).catch(() => {})
  }, [])

  const markAllRead = useCallback(() => {
    if (items.every((item) => item.read)) return
    setItems((all) => all.map((item) => ({ ...item, read: true })))
    void markAllNotificationsRead().catch(() => {})
  }, [items])

  return { items, markRead, markAllRead }
}
