/**
 * Client-side shapes for the CGS API.
 *
 * These mirror the backend contract in CLAUDE.md §3. Kai's shapes may shift
 * early — confirm before treating any of this as settled. Until the
 * integration phase these are only ever filled by `src/mocks/games.ts`.
 */

export type StickerKind = 'new' | 'jam' | 'updated'

/** A screenshot or clip on a listing. */
export interface MediaItem {
  id: string
  kind: 'image' | 'video'
  /**
   * Where to load it from: a gateway URL from the API, or an object URL for a
   * file picked in this session. Absent for a game with no media of its own,
   * which falls back to a generated frame from `seed`.
   */
  url?: string
  /**
   * The file itself, only while it is being picked in the publish flow. This
   * is what gets uploaded; the object URL above is only for showing it first.
   */
  file?: File
  seed?: number
}

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
  /** USDC, for display. `0` means free — free games still mint a GameKey. */
  priceUsd: number
  /**
   * The same price as an integer, in the asset's smallest units.
   *
   * Anything that compares or adds money uses this. `priceUsd` is a float and
   * a wallet holding exactly the price of a game is the case where comparing
   * floats decides wrong, which is a buyer being asked to top up a wallet that
   * already has enough in it.
   */
  priceUnits: number
  tags: string[]
  sticker?: StickerKind
  /** Deterministic seed for the generated placeholder cover art. */
  coverSeed: number
  /** Real cover art, when the dev uploaded some. Wins over `coverSeed`. */
  coverUrl?: string
  /** Screenshots and clips. See `mocks/media.ts` for the fallback. */
  media?: MediaItem[]
  publishedAt: string
  /** Public on the listing: buyers can see exactly where their money goes. */
  splits: SplitMember[]
  rating: number
  reviewCount: number
  plays: number
  /** Rough build size, shown so the "no install" claim is concrete. */
  buildKb: number
  /**
   * Entry URL of a build mounted in this browser session, when the game was
   * published here. Mock-only: the real build comes from the IPFS CID through
   * the x402 download.
   */
  localBuildEntry?: string
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
