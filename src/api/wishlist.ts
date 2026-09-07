import { request } from '@/lib/api'

/**
 * Saving a game for later, and finding out when it gets cheaper.
 *
 * The rows behind this are the old `likes` table given a purpose. Every game
 * response still carries `liked` and `likeCount`, so nothing that used those
 * broke; `wishlisted` and `wishlistCount` are the same numbers under the name
 * the feature actually has now.
 *
 * Add and remove rather than toggle. A toggle undoes itself on a double click,
 * which is a bad way to lose something you meant to keep — and the server is
 * explicit that adding twice is not an error.
 */

export interface WishlistState {
  wishlisted: boolean
  wishlistCount: number
  /** The same two numbers, under the older names. */
  liked: boolean
  likeCount: number
}

export function addToWishlist(gameId: string): Promise<WishlistState> {
  return request<WishlistState>(`/api/games/${gameId}/wishlist`, {
    method: 'POST',
  })
}

export function removeFromWishlist(gameId: string): Promise<WishlistState> {
  return request<WishlistState>(`/api/games/${gameId}/wishlist`, {
    method: 'DELETE',
  })
}

export interface WireWishlistItem {
  addedAt: string
  notifyOnDrop: boolean
  game: {
    id: string
    slug: string
    title: string
    coverCid?: string | null
    coverUrl: string | null
    coverSeed: number
    studio: { id: string; name: string; slug: string; ens?: string | null }
    priceUnits: number
    priceUsd: number
  }
  /** What it cost when they saved it. The comparison a wishlist exists for. */
  savedAtUnits: number
  savedAtUsd: number
  changeUnits: number
  percentOff: number
  /**
   * False when the game was unlisted. It stays on the list on purpose:
   * somebody who saved it should learn what happened to it rather than find a
   * gap where it was.
   */
  stillForSale: boolean
  /** Non-null when an agent is watching this game for them. */
  agent: { id: string; status: string; triggerPriceUnits: number } | null
}

export interface WireWishlist {
  /** Items cheaper than when they were saved. No client arithmetic needed. */
  onSale: number
  items: WireWishlistItem[]
}

export function getWishlist(signal?: AbortSignal): Promise<WireWishlist> {
  return request<WireWishlist>('/api/me/wishlist', { signal })
}

/**
 * How many people are waiting for a game, publicly.
 *
 * Every storefront knows this number and none of them publish it. Here the
 * count crosses a milestone and gets written to the public HCS topic, so a
 * visitor can check it on the Mirror Node instead of taking our word for it.
 */
export interface WireDemand {
  gameId: string
  wishlistCount: number
  /** The last milestone actually written on chain, or null before the first. */
  announcedMilestone: number | null
  topicId: string | null
}

export function getDemand(
  gameRef: string,
  signal?: AbortSignal,
): Promise<WireDemand> {
  return request<WireDemand>(
    `/api/games/${encodeURIComponent(gameRef)}/demand`,
    { signal },
  )
}
