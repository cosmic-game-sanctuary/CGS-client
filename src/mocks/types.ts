/**
 * Client-side shapes for the CGS API.
 *
 * These mirror the backend contract in CLAUDE.md §3. Kai's shapes may shift
 * early — confirm before treating any of this as settled. Until the
 * integration phase these are only ever filled by `src/mocks/games.ts`.
 */

export type StickerKind = 'new' | 'jam' | 'updated'

export interface Studio {
  id: string
  /** Human name the studio chose. */
  name: string
  /** ENS subname, when claimed. Wins over `name` and `address` in the UI. */
  ens?: string
  /** Hedera EVM address. Last resort for display — always truncate. */
  address: string
  bio?: string
  memberCount: number
}

/** One line of a revenue split. Locked at publish, immutable after. */
export interface SplitMember {
  handle: string
  role: string
  /** Whole percent. All members of a game must total exactly 100. */
  pct: number
}

export interface Game {
  id: string
  slug: string
  title: string
  tagline: string
  description: string
  studio: Studio
  /** USDC. `0` means free — free games still mint a GameKey. */
  priceUsd: number
  tags: string[]
  sticker?: StickerKind
  /** Deterministic seed for the generated placeholder cover art. */
  coverSeed: number
  publishedAt: string
  /** Public on the listing: buyers can see exactly where their money goes. */
  splits: SplitMember[]
  rating: number
  reviewCount: number
  plays: number
  /** Rough build size, shown so the "no install" claim is concrete. */
  buildKb: number
}

export interface Review {
  id: string
  gameId: string
  /** ENS name if the reviewer has one, else a truncated address. */
  author: string
  authorIsEns: boolean
  rating: number
  body: string
  createdAt: string
}

export type SortKey = 'newest' | 'price-low' | 'price-high' | 'rating'

export interface CatalogQuery {
  search?: string
  tag?: string
  sort?: SortKey
  freeOnly?: boolean
}
