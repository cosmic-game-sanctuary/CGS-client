import { request } from '@/lib/api'

/**
 * Sales.
 *
 * A sale here is a **scheduled price**, not a special kind of price. It starts,
 * it ends, and it puts the old price back on its own, which is most of why
 * sales barely existed before: nobody had to remember to change it back.
 *
 * Two consequences that shape every screen touching this:
 *
 * - **The game's own `priceUnits` is already the sale price** while one runs.
 *   Nothing has to apply a discount client-side, and nothing should try. The
 *   promotion carries `basePriceUnits` so the old number can be shown struck
 *   through, and that is the only reason it is needed for rendering a price.
 * - **The sale owns the price until it ends.** Editing the price underneath it
 *   answers `409 PROMOTION_ACTIVE`, because the change would either be silently
 *   undone at `endsAt` or revert to a number nobody chose.
 *
 * Both ends of every sale are written to the public HCS topic, with `endsAt` in
 * the message. The deadline is on a ledger before it matters, which is what
 * makes a countdown on the listing a fact rather than a marketing device.
 */

export interface WirePromotion {
  id: string
  /**
   * `scheduled` has not started. `active` is running now. `ended` ran its
   * course; `cancelled` was stopped early, or was never allowed to start.
   */
  status: 'scheduled' | 'active' | 'ended' | 'cancelled'
  /** What the game costs while this runs. Already the game's live price. */
  salePriceUnits: number
  salePriceUsd: number
  /** What it goes back to. Captured at creation, not read at revert time. */
  basePriceUnits: number
  basePriceUsd: number
  asset: string
  assetDecimals: number
  percentOff: number
  startsAt: string
  endsAt: string
  /** The public record of the sale opening, and of it closing. */
  hcsStartTxId: string | null
  hcsEndTxId: string | null
  /** Set when this sale revives an earlier one rather than editing it. */
  supersedesId: string | null
  createdAt: string
}

export interface WirePromotions {
  /** Running or scheduled. Null when neither. */
  active: WirePromotion | null
  /** Every sale this game has ever run, newest first. Public: it is price history. */
  history: WirePromotion[]
}

/** Public, and takes a slug as well as an id. */
export function getPromotions(
  gameId: string,
  signal?: AbortSignal,
): Promise<WirePromotions> {
  return request<WirePromotions>(`/api/games/${gameId}/promotions`, { signal })
}

export interface NewSale {
  /** Integer units, and it has to be **below** the current price. */
  salePriceUnits: number
  endsAt: string
  /** Omit to start now. A scheduled sale is announced when it starts. */
  startsAt?: string
}

/** `409 PROMOTION_EXISTS` if one is already scheduled or running. One at a time. */
export function startSale(
  gameId: string,
  body: NewSale,
): Promise<WirePromotion> {
  return request<WirePromotion>(`/api/games/${gameId}/promotions`, {
    method: 'POST',
    body,
  })
}

/**
 * Move the end later, and only later. A deadline that was published cannot be
 * pulled in: anyone who read the original would be stranded by it. Ending early
 * is `endSale`, which is announced.
 */
export function extendSale(
  gameId: string,
  promotionId: string,
  endsAt: string,
): Promise<WirePromotion> {
  return request<WirePromotion>(
    `/api/games/${gameId}/promotions/${promotionId}`,
    { method: 'PATCH', body: { endsAt } },
  )
}

/**
 * Bring a sale to an end early.
 *
 * A running sale is **wound down to its last hour**, not stopped dead. The
 * deadline was published on a public topic, and an agent may have chosen to
 * wait for it rather than spend its budget on the first thing that got cheap.
 * Pulling the price instantly would cost that buyer a game they were going to
 * get, which is our own design costing them the purchase. An hour is exactly
 * how long an agent is guaranteed to need to act on a deadline, so it is what a
 * studio has to give.
 *
 * A sale that never started is cancelled outright, since nothing was announced.
 * One already inside its final hour is refused: it is on its way out anyway.
 */
export function endSale(
  gameId: string,
  promotionId: string,
): Promise<WirePromotion> {
  return request<WirePromotion>(
    `/api/games/${gameId}/promotions/${promotionId}`,
    { method: 'DELETE' },
  )
}
