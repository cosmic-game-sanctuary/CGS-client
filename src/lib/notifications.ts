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

/**
 * How a row looks, not what it is. Several server types share one: an agent
 * running out of money and an agent buying something are both the agent
 * speaking, and the sentence is what tells them apart.
 */
export type NotificationKind =
  | 'sale'
  | 'held'
  | 'invite'
  | 'agent'
  | 'live'
  | 'deal'
  | 'reply'

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

/**
 * Null for a type this build has never heard of.
 *
 * The server's enum grows faster than this file does, and it used to grow into
 * a `switch` with no default — which returned `undefined` and put a hole in the
 * array the panel iterates, so one unrecognised row took the whole bell down.
 * Skipping what we cannot phrase is the only behaviour that stays correct as
 * the other side adds things.
 */
export function adaptNotification(wire: WireNotification): AppNotification | null {
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

    // Stage 18's three. `agent_fired` above is the old one-agent-per-game
    // shape; these are what one agent spending a shared budget looks like.
    case 'agent_purchased': {
      const chosen = p.chosenGameIds
      const count =
        num(p, 'count') ?? (Array.isArray(chosen) ? chosen.length : undefined)
      return {
        ...base,
        kind: 'agent',
        title:
          count && count > 1
            ? `Your agent bought ${count} games`
            : 'Your agent bought something',
        // One notification per decision, not per game. Three games bought in
        // one round is one round of thinking, and one thing to read.
        detail: 'The keys are in your library.',
        amountUsd: num(p, 'spentUsd') ?? num(p, 'priceUsd'),
        to: '/agent',
      }
    }

    case 'agent_asked':
      return {
        ...base,
        kind: 'agent',
        title: 'Your agent wants a decision',
        // The deadline is the reason this cannot wait, so it leads.
        detail: 'It found more than it can afford. Answer before the deadline, or it decides.',
        to: '/agent',
      }

    case 'agent_expired':
      return {
        ...base,
        kind: 'agent',
        title: 'Your agent finished',
        detail: 'It reached the date you set. Anything left came back to your wallet.',
        amountUsd: num(p, 'refundedUsd'),
        to: '/agent',
      }

    // The rest of what an agent can do, none of which is buying. All of them
    // are about the buyer's money sitting in a wallet that cannot spend it, so
    // all of them need an action, not a status.
    case 'agent_underfunded':
      return {
        ...base,
        kind: 'agent',
        title: `Your agent can’t afford ${title}`,
        detail: 'Top up its wallet and it keeps watching.',
        to: gameLink(p),
      }

    case 'agent_cancelled':
      return {
        ...base,
        kind: 'agent',
        title: `You stopped watching ${title}`,
        detail: 'The money in that agent is yours to take back.',
        to: gameLink(p),
      }

    case 'agent_failed':
      return {
        ...base,
        kind: 'agent',
        title: `Your agent couldn’t buy ${title}`,
        // Never "try again": it did try, and saying so is what makes the next
        // sentence believable.
        detail: 'Nothing was charged. The trigger is still set.',
        to: gameLink(p),
      }

    case 'agent_target_gone':
      return {
        ...base,
        kind: 'agent',
        title: `${title} is no longer for sale`,
        detail: 'Your agent is still holding your money. Close it to get it back.',
        to: gameLink(p),
      }

    case 'payout_held': {
      const waiting = num(p, 'waitingOn')
      return {
        ...base,
        kind: 'held',
        title: `Part of ${title}’s split is waiting`,
        detail:
          waiting === 1
            ? 'Someone on the credits hasn’t claimed their invite yet.'
            : `${waiting ?? 'Some'} people on the credits haven’t claimed their invites yet.`,
        amountUsd: num(p, 'heldUsd'),
        to: gameLink(p),
      }
    }

    case 'payout_settled':
      return {
        ...base,
        kind: 'sale',
        title: 'Money that was waiting for you arrived',
        detail: 'It is in your wallet now.',
        amountUsd: num(p, 'amountUsd'),
        // The row carries no game, because a settlement can cover shares from
        // several at once. The money page is the only screen that can show all
        // of them, and it is where the balance this just changed is printed.
        to: '/money',
      }

    case 'build_updated': {
      const version = num(p, 'version')
      return {
        ...base,
        kind: 'live',
        title: `${title} shipped an update`,
        // The whole argument for holding a key rather than a download is that
        // the key keeps being worth something. This is that, out loud.
        detail: version ? `Version ${version}. Your key covers it.` : 'Your key covers it.',
        to: gameLink(p),
      }
    }

    case 'price_drop': {
      const off = num(p, 'percentOff')
      return {
        ...base,
        kind: 'deal',
        title: `${title} got cheaper`,
        detail: off ? `${off}% off since you saved it.` : 'It dropped since you saved it.',
        amountUsd: num(p, 'priceUsd'),
        to: gameLink(p),
      }
    }

    case 'review_reply':
      return {
        ...base,
        kind: 'reply',
        title: `The studio replied to your review of ${title}`,
        to: gameLink(p),
      }

    case 'report_resolved': {
      // "none" means it was looked at and left alone, which is a real outcome
      // and the one most worth saying plainly. Anything else is an action taken.
      const action = str(p, 'action')
      return {
        ...base,
        kind: 'reply',
        title: 'Your report was reviewed',
        detail:
          action === 'none'
            ? 'It was looked at, and nothing was changed.'
            : action === 'removed_from_storage'
              ? 'The content was taken down.'
              : 'It was taken out of the catalog.',
        to: gameLink(p),
      }
    }

    default:
      return null
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
          // A row this build cannot phrase is dropped rather than rendered
          // empty. See adaptNotification.
          if (live) {
            setItems(
              page.notifications
                .map(adaptNotification)
                .filter((item) => item !== null),
            )
          }
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
