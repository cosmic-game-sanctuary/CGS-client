import { request } from '@/lib/api'

/**
 * What was earned, and what is still owed.
 *
 * Two views of one calculation. The server computes both from the same
 * function, so a studio owner looking at a game and a collaborator looking at
 * the same game cannot be shown different numbers for the same share.
 *
 * **Nothing here is stored.** Every figure is recomputed from sales and splits
 * on each read, which is why there is no cache in this module either: a total
 * we remembered is a total that can disagree with the transfers people actually
 * received.
 */

/** Every money value the earnings API sends arrives in this shape. */
export interface WireMoney {
  /** Integer, smallest units. The truth, and the only thing to compute with. */
  units: number
  /** The same amount for printing. Never do arithmetic on it. */
  display: number
  assetDecimals: number
}

export interface WireEarningsGame {
  gameId: string
  slug: string
  title: string
  status: 'draft' | 'published' | 'delisted' | 'removed'
  priceUnits: number
  studio: { id: string; name: string; slug: string }
  sales: number
  /** What buyers paid, before it was divided. */
  gross: WireMoney
  /** Your cut of that gross. Personal report only. */
  yours?: { pct: number; role: string; earned: WireMoney }
  plays: number
  likes: number
  reviews: number
  rating: number
}

/**
 * A share that was owed and did not go out.
 *
 * `held` means the person had no Hedera account to send it to. `failed` means
 * the transfer was attempted and the network refused it. Neither loses the
 * money: the row is the record that it is owed.
 */
export interface WireOwedRow {
  id: string
  gameId: string
  gameTitle: string | null
  gameSlug: string | null
  amount: WireMoney
  amountUnits: number
  asset: string
  reason: string
  since: string
  status: 'held' | 'failed'
}

export interface WirePersonalEarnings {
  totals: {
    /** Yours. */
    earned: WireMoney
    /** What the games took in altogether, your share included. */
    gross: WireMoney
    sales: number
    games: number
    held: WireMoney
    failed: WireMoney
    asset: string
  }
  games: WireEarningsGame[]
  held: WireOwedRow[]
  failed: WireOwedRow[]
}

/**
 * Everything you are credited on, across every team.
 *
 * Cross-studio deliberately. Being added to a split by email is exactly what
 * puts one person on games from several studios, so a per-studio view would
 * hide money from the people the splits feature exists for.
 */
export function getMyEarnings(
  signal?: AbortSignal,
): Promise<WirePersonalEarnings> {
  return request<WirePersonalEarnings>('/api/me/earnings', { signal })
}

export interface WireStudioPerson {
  handle: string
  role: string
  earnedUnits: number
  games: number
  /**
   * False while this share is still pointed at an invite nobody has opened.
   * That person's money is in `held` rather than in their wallet.
   */
  claimed: boolean
  earned: WireMoney
}

export interface WireStudioEarnings {
  studio: { id: string; name: string; slug: string }
  totals: {
    gross: WireMoney
    sales: number
    games: number
    published: number
    held: WireMoney
    failed: WireMoney
    asset: string
  }
  games: WireEarningsGame[]
  /** Everyone on the studio's splits, whether or not they have an account. */
  people: WireStudioPerson[]
  held: WireOwedRow[]
  failed: WireOwedRow[]
}

/**
 * Owner and accepted members only. Anyone else gets `NOT_OWNER`, so callers
 * should decide from the session whether to ask at all rather than fetching and
 * catching.
 */
export function getStudioEarnings(
  studioId: string,
  signal?: AbortSignal,
): Promise<WireStudioEarnings> {
  return request<WireStudioEarnings>(`/api/studios/${studioId}/earnings`, {
    signal,
  })
}
