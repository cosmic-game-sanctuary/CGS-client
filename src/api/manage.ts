import { request } from '@/lib/api'
import type { WireGame, WireMedia } from '@/api/wire'

/**
 * A published game stops being frozen.
 *
 * Until this existed a listing was write-once: no price change, no typo fix,
 * no new build, and no way for a developer to take their own work down. Every
 * call here needs the caller to be the studio's founder or a promoted manager;
 * anyone else gets `NOT_OWNER`.
 *
 * Repricing is not just a storefront feature. A wishlist agent fires on a price
 * message on the public topic, and publishing writes exactly one of those per
 * game, ever — so before this, an agent armed on a live listing could never
 * fire at all.
 */

export interface WireBuildVersion {
  version: number
  /** The developer's own name for it. Shown as-is. */
  label: string | null
  notes: string | null
  buildCid: string
  buildSizeKb: number | null
  /** The HCS message that announced it, when there was one. */
  hcsTxId: string | null
  createdAt: string
}

/**
 * One price *change*, which is what the server stores. Integer units only —
 * there is no `…Usd` here, and reading one off a row that has none is what
 * took the manage screen down the first time a price moved.
 */
export interface WirePricePoint {
  fromUnits: number
  toUnits: number
  asset: string
  /**
   * The transaction that announced this change publicly. What makes a price
   * history checkable on the Mirror Node rather than a claim we make.
   */
  hcsTxId: string | null
  topicId: string | null
  at: string
}

export interface WireManageStats {
  sales: number
  grossUnits: number
  grossUsd: number
  /** Distinct wallets holding a key. Higher than `sales` for a free game. */
  owners: number
  plays: number
  playtimeSeconds: number
  reviewCount: number
  rating: number
  /**
   * Sales whose money never reached the collaborators. Worth showing plainly:
   * a team otherwise finds out when somebody asks where their money is.
   */
  unsettledSplits: number
  /** How many people are waiting. The number that decides a discount. */
  wishlisted?: number
}

export interface WireManageView {
  game: WireGame
  media: WireMedia[]
  builds: WireBuildVersion[]
  priceHistory: WirePricePoint[]
  stats: WireManageStats
}

export function getManageView(
  gameRef: string,
  signal?: AbortSignal,
): Promise<WireManageView> {
  return request<WireManageView>(
    `/api/games/${encodeURIComponent(gameRef)}/manage`,
    { signal },
  )
}

export interface EditGameBody {
  title?: string
  tagline?: string
  description?: string
  tags?: string[]
  /** Integer smallest units, like everywhere. 250000 is $0.25 at 6 decimals. */
  priceUnits?: number
  /** Picks an existing image as the cover. Does not upload one. */
  coverMediaId?: string | null
}

/**
 * Send only what changed.
 *
 * `announced` comes back when the price moved. False means the new price is
 * live here but has not reached the public topic yet, which is the difference
 * between putting a game on sale and the sale being public.
 *
 * The slug never changes, even when the title does. Nothing should re-route
 * after a rename.
 */
export function editGame(
  gameId: string,
  body: EditGameBody,
): Promise<WireGame & { announced?: boolean }> {
  return request<WireGame & { announced?: boolean }>(`/api/games/${gameId}`, {
    method: 'PATCH',
    body,
  })
}

/**
 * Ship a new build. Everyone who already owns the game gets it, which is the
 * whole argument for holding a key rather than a file.
 */
export function shipBuild(
  gameId: string,
  build: File,
  meta: { label?: string; notes?: string } = {},
): Promise<{ version: number; buildCid: string }> {
  const form = new FormData()
  form.append('build', build)
  if (meta.label) form.append('label', meta.label)
  if (meta.notes) form.append('notes', meta.notes)
  return request<{ version: number; buildCid: string }>(
    `/api/games/${gameId}/builds`,
    { method: 'POST', form },
  )
}

export function getBuilds(
  gameRef: string,
  signal?: AbortSignal,
): Promise<{ current: number; builds: WireBuildVersion[] }> {
  return request(`/api/games/${encodeURIComponent(gameRef)}/builds`, { signal })
}

export function getPriceHistory(
  gameRef: string,
  signal?: AbortSignal,
): Promise<{
  currentUnits: number
  currentUsd: number
  asset: string
  assetDecimals: number
  /** Includes the current price, so a game that never changed still answers. */
  lowestEverUnits: number
  history: (WirePricePoint & { fromUsd: number; toUsd: number })[]
}> {
  return request(`/api/games/${encodeURIComponent(gameRef)}/price-history`, {
    signal,
  })
}

/** Up to eight at a time. */
export function addMedia(gameId: string, files: File[]): Promise<{ media: WireMedia[] }> {
  const form = new FormData()
  for (const file of files) form.append('media', file)
  return request<{ media: WireMedia[] }>(`/api/games/${gameId}/media`, {
    method: 'POST',
    form,
  })
}

/** Anything left out keeps its relative position at the end. It isn't deleted. */
export function reorderMedia(
  gameId: string,
  mediaIds: string[],
): Promise<{ media: WireMedia[] }> {
  return request<{ media: WireMedia[] }>(`/api/games/${gameId}/media`, {
    method: 'PATCH',
    body: { mediaIds },
  })
}

export function removeMedia(gameId: string, mediaId: string): Promise<void> {
  return request(`/api/games/${gameId}/media/${mediaId}`, { method: 'DELETE' })
}

/**
 * Take it out of the catalog. `ownersKeepAccess` comes back true, and saying
 * so in the confirmation is the point: it is the thing a developer is actually
 * worried about.
 */
export function unpublishGame(
  gameId: string,
): Promise<{ ownersKeepAccess: boolean }> {
  return request<{ ownersKeepAccess: boolean }>(
    `/api/games/${gameId}/unpublish`,
    { method: 'POST' },
  )
}

/** `MODERATION_HOLD` if a moderator took it down rather than the developer. */
export function relistGame(gameId: string): Promise<WireGame> {
  return request<WireGame>(`/api/games/${gameId}/relist`, { method: 'POST' })
}

/** Drafts only. A published game is unlisted, never deleted. */
export function deleteDraft(gameId: string): Promise<void> {
  return request(`/api/games/${gameId}`, { method: 'DELETE' })
}
