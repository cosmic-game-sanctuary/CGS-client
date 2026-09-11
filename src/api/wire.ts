/**
 * The shapes the server actually sends.
 *
 * Transcribed from CGS-server's route handlers, not from the docs. They are
 * kept separate from `mocks/types.ts` on purpose: that file is the view model
 * every component is written against, this one is the wire, and `adapt.ts` is
 * the only place that knows both. When the API changes, the diff is here.
 */

import type { WirePromotion } from '@/api/promotions'

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

/**
 * Who a person is, wherever the server names one: a review author, a comment
 * author, a credit on a game. `label` is what to print — the server already
 * does the display-name then handle then address fallback, and reimplementing
 * it here is how the two drift.
 */
export interface WireProfile {
  handle: string | null
  displayName: string | null
  avatarUrl: string | null
  address: string
  label: string
}

export interface WireSplit {
  /** The name on *this* game's credits. Per game on purpose. */
  handle: string
  role: string
  pct: number
  /**
   * The person behind that name, and null when there isn't one yet. An
   * invited collaborator is credited and paid from the first sale whether or
   * not they ever open the site.
   */
  profile?: WireProfile | null
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
  /**
   * The same number twice. Likes became a wishlist, and both names are sent so
   * nothing broke; prefer `wishlistCount` in anything new.
   */
  likeCount: number
  wishlistCount?: number
  buildKb: number | null
  /**
   * The listing's own state. Nothing outside a studio page could see this
   * before, and a client that may be allowed to manage a game needs to know
   * whether it is a draft, live, or unlisted.
   */
  status?: 'draft' | 'published' | 'delisted' | 'removed'
  updatedAt?: string | null
  /** Bumped by every patch the developer ships. A key covers all of them. */
  buildVersion?: number
  delistedBy?: string | null
  /** Detail only. */
  media?: WireMedia[]
  /**
   * The sale this price came from, when it came from one.
   *
   * **Detail only.** The catalog list does not carry it, so a card can show the
   * discounted price (it is the game's real price while a sale runs) but cannot
   * say it is discounted. See `api/promotions.ts`.
   */
  promotion?: WirePromotion | null
  /** Detail only, and only when signed in. */
  owned?: boolean
  liked?: boolean
  wishlisted?: boolean
  /**
   * The ceiling your agent will buy this at, and your note to it. Detail only,
   * null for a plain saved game and for anyone signed out.
   */
  agentMaxUnits?: number | null
  agentNote?: string | null
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
  /**
   * Ready to print. Used to be a truncated address for everyone; it is the
   * person's real name now, when they have one. Do not truncate it again.
   */
  author: string
  authorIsEns: boolean
  /** The person behind that name, for linking. Null if they never signed in. */
  authorProfile?: WireProfile | null
  /** The studio's answer, when there is one. One per review, on the review. */
  developerReply?: string | null
  developerReplyAt?: string | null
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
  /**
   * The signed-in caller's own row in `members`, or null if they are not on
   * this team (or are not signed in). No one else's userId is on this
   * response; this is the one exception, and it is only ever the viewer's
   * own id being handed back to them.
   */
  viewerMemberId: string | null
  members: WireStudioMember[]
  games: WireStudioGame[]
}
