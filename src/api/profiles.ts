import { request } from '@/lib/api'
import type { WireProfile, WireStudioRef } from '@/api/wire'

/**
 * Who someone is, publicly.
 *
 * This is what every truncated address on the site was standing in for. A
 * review, a comment and a credit on a game all named the same person three
 * slightly different ways, and all three looked like an anonymous stranger.
 *
 * Nothing here ever returns an email address, including on your own page. The
 * page is public; the email is not, and keeping that true in the API rather
 * than in the component is the only way it stays true.
 */

/** Enough of a game to show a card for it. Shared by credits and library. */
export interface WireProfileGame {
  id: string
  slug: string
  title: string
  coverCid?: string | null
  coverUrl: string | null
  coverSeed: number
  studio: { id: string; name: string; slug: string }
}

export interface WireCredit {
  gameId: string
  slug: string
  title: string
  coverCid?: string | null
  coverUrl: string | null
  coverSeed: number
  studio: { id: string; name: string; slug: string }
  /** What this game called them. Per game, so it varies across credits. */
  role: string
  pct: number
}

export interface WireProfileReview {
  id: string
  rating: number
  body: string
  createdAt: string
  editedAt: string | null
  /** Null if the game went away underneath the review. */
  game: WireProfileGame | null
}

export interface WireProfileLibraryGame {
  gameId: string
  slug: string
  title: string
  coverCid?: string | null
  coverUrl: string | null
  coverSeed: number
  playtimeSeconds: number
}

export interface WireUserProfile extends WireProfile {
  bio: string | null
  avatarCid?: string | null
  addressShort: string
  hederaAccountId: string | null
  joinedAt: string
  isSelf: boolean
  /** False hides `library` and nulls `stats.gamesOwned`, unless it's your page. */
  libraryPublic: boolean
  studios: (WireStudioRef & { role: 'owner' | 'member' })[]
  /**
   * Every game they have a share of, with the share.
   *
   * The most interesting thing on the page. Steam names a publisher and itch
   * names an uploader; this names everyone who made the thing and says what
   * each of them is paid.
   */
  credits: WireCredit[]
  reviews: WireProfileReview[]
  library: WireProfileLibraryGame[]
  stats: {
    gamesCredited: number
    /** Null when their library is private and it isn't you looking. */
    gamesOwned: number | null
    reviewCount: number
    wishlistCount: number
    playCount: number
    playtimeSeconds: number
  }
}

/** Case-insensitive, public, no token needed. */
export function getProfile(
  handle: string,
  signal?: AbortSignal,
): Promise<WireUserProfile> {
  return request<WireUserProfile>(
    `/api/users/${encodeURIComponent(handle)}`,
    { signal },
  )
}

export interface WireHandleCheck {
  handle: string
  /** What the handle becomes: lowercased, non-URL-safe characters dropped. */
  normalised: string | null
  available: boolean
  reason: 'taken' | 'reserved' | 'unusable' | null
}

/**
 * Show the normalised value back before saving. "Kai Saha" becomes `kaisaha`,
 * and finding that out after pressing save is a small betrayal.
 */
export function checkHandle(
  handle: string,
  signal?: AbortSignal,
): Promise<WireHandleCheck> {
  return request<WireHandleCheck>('/api/users/handle-availability', {
    query: { handle },
    signal,
  })
}

export function updateProfile(body: {
  displayName?: string | null
  handle?: string
  bio?: string | null
  libraryPublic?: boolean
}): Promise<WireUserProfile> {
  return request<WireUserProfile>('/api/me/profile', { method: 'PATCH', body })
}

/** Images only, 5MB, through the same moderation gate as any other upload. */
export function uploadAvatar(file: File): Promise<{ avatarUrl: string | null }> {
  const form = new FormData()
  form.append('avatar', file)
  return request<{ avatarUrl: string | null }>('/api/me/avatar', {
    method: 'POST',
    form,
  })
}

export function removeAvatar(): Promise<{ avatarUrl: null }> {
  return request<{ avatarUrl: null }>('/api/me/avatar', { method: 'DELETE' })
}

/**
 * Receipts. One row per purchase, each with the settlement transaction, so a
 * buyer can check what they paid against the chain rather than against us.
 */
export interface WirePurchase {
  id: string
  at: string
  priceUnits: number
  priceUsd: number
  priceAsset: string
  assetDecimals: number
  /** Look it up on the Mirror Node. This is what makes it a receipt. */
  settlementTxId: string
  hcsSaleTxId: string | null
  /** Null if the game was removed from storage after the sale. */
  game: (WireProfileGame & { status: string }) | null
  key: { tokenId: string | null; serial: number | null } | null
}

export async function getPurchases(
  signal?: AbortSignal,
): Promise<WirePurchase[]> {
  const { purchases } = await request<{ purchases: WirePurchase[] }>(
    '/api/me/purchases',
    { signal },
  )
  return purchases
}
