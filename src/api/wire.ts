/**
 * The shapes the server actually sends.
 *
 * Transcribed from CGS-server's route handlers, not from the docs. They are
 * kept separate from `mocks/types.ts` on purpose: that file is the view model
 * every component is written against, this one is the wire, and `adapt.ts` is
 * the only place that knows both. When the API changes, the diff is here.
 */

export interface WireStudioRef {
  id: string
  name: string
  /** Full ENS name (`tinroof.cgs-sanctuary.eth`), or null. */
  ens: string | null
  slug: string
  bio?: string | null
  memberCount?: number
  ownerAddress?: string | null
}

export interface WireSplit {
  handle: string
  role: string
  pct: number
}

export interface WireMedia {
  id: string
  kind: 'image' | 'video'
  cid: string
  position: number
  url: string
}

export interface WireGame {
  id: string
  slug: string
  title: string
  tagline: string
  description: string
  studio: WireStudioRef
  /** Integer, smallest units. All arithmetic uses this. */
  priceUnits: number
  priceAsset: string
  /** Display only. Never do money math on it. */
  priceUsd: number
  priceAssetDecimals: number
  tags: string[]
  coverCid: string | null
  coverUrl: string | null
  coverSeed: number
  publishedAt: string | null
  splits: WireSplit[]
  rating: number
  reviewCount: number
  plays: number
  likeCount: number
  buildKb: number | null
  /** Detail only. */
  media?: WireMedia[]
  /** Detail only, and only when signed in. */
  owned?: boolean
  liked?: boolean
}

export interface WireCatalog {
  games: WireGame[]
  nextCursor: string | null
}

export interface WireReview {
  id: string
  gameId: string
  userId: string
  rating: number
  body: string
  createdAt: string
  editedAt: string | null
  /** Already truncated by the server. Do not truncate again. */
  author: string
  authorIsEns: boolean
}

export interface WireReviewPage {
  reviews: WireReview[]
  nextCursor: string | null
}

export interface WireStudioMember {
  id: string
  handle: string
  role: 'owner' | 'member'
  acceptedAt: string | null
  /** Present only when the caller owns the studio. */
  email?: string
}

export interface WireStudioGame {
  id: string
  slug: string
  title: string
  coverCid: string | null
  coverSeed: number
  status: 'draft' | 'published' | 'delisted' | 'removed'
}

export interface WireStudio {
  id: string
  ownerUserId: string
  name: string
  slug: string
  bio: string | null
  /** The bare label the studio chose. */
  ensSubname: string | null
  /** The full resolved name, or null. Prefer this over `ensSubname`. */
  ens: string | null
  createdAt: string
  ownerAddress: string | null
  memberCount: number
  members: WireStudioMember[]
  games: WireStudioGame[]
}
