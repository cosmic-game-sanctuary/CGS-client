/**
 * Wire to view.
 *
 * The only module that knows both `api/wire.ts` (what the server sends) and
 * `mocks/types.ts` (what every component is written against). Keeping the
 * translation in one place means an API change is a diff here rather than a
 * hundred edits across screens.
 *
 * Two fields have no server equivalent and are derived rather than faked:
 * `sticker`, which only ever meant "recently published", and `localBuildEntry`,
 * which is a build mounted in this browser session and never comes from an API.
 */
import type { Game, MediaItem, Review, Studio } from '@/mocks/types'
import type {
  WireGame,
  WireMedia,
  WireReview,
  WireStudio,
  WireStudioRef,
} from '@/api/wire'

/** How long a game wears the "New" flash. */
const NEW_FOR_DAYS = 14

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * The zero address is never a wallet anybody holds, so showing it truncated
 * reads as a broken value rather than an absent one. Empty means "no address
 * to show", which every caller already handles.
 */
function realAddress(address: string | null | undefined): string {
  return !address || address === ZERO_ADDRESS ? '' : address
}

function stickerFor(publishedAt: string | null): Game['sticker'] {
  if (!publishedAt) return undefined
  const age = Date.now() - Date.parse(publishedAt)
  return age < NEW_FOR_DAYS * 86_400_000 ? 'new' : undefined
}

export function adaptStudioRef(wire: WireStudioRef): Studio {
  return {
    id: wire.id,
    name: wire.name,
    ens: wire.ens ?? undefined,
    // Studios have no wallet of their own; the address on a listing is the
    // owner's. Empty rather than absent so `displayIdentity` stays total.
    address: realAddress(wire.ownerAddress),
    bio: wire.bio ?? undefined,
    memberCount: wire.memberCount ?? 0,
  }
}

export function adaptMedia(wire: WireMedia): MediaItem {
  return { id: wire.id, kind: wire.kind, url: wire.url }
}

export function adaptGame(wire: WireGame): Game {
  return {
    id: wire.id,
    slug: wire.slug,
    title: wire.title,
    tagline: wire.tagline,
    description: wire.description,
    studio: adaptStudioRef(wire.studio),
    priceUsd: wire.priceUsd,
    tags: wire.tags,
    sticker: stickerFor(wire.publishedAt),
    coverSeed: wire.coverSeed,
    coverUrl: wire.coverUrl ?? undefined,
    media: wire.media?.map(adaptMedia),
    // A draft has no publish date. Nothing in the catalog is a draft, but the
    // studio page lists them, so fall back rather than render "Invalid Date".
    publishedAt: wire.publishedAt ?? new Date().toISOString(),
    splits: wire.splits,
    rating: wire.rating,
    reviewCount: wire.reviewCount,
    plays: wire.plays,
    buildKb: wire.buildKb ?? 0,
  }
}

export function adaptReview(wire: WireReview): Review {
  return {
    id: wire.id,
    gameId: wire.gameId,
    // Already truncated server-side. Truncating again would eat the ellipsis.
    author: wire.author,
    authorIsEns: wire.authorIsEns,
    rating: wire.rating,
    body: wire.body,
    createdAt: wire.createdAt,
  }
}

export function adaptStudio(wire: WireStudio): Studio {
  return {
    id: wire.id,
    name: wire.name,
    ens: wire.ens ?? undefined,
    address: realAddress(wire.ownerAddress),
    bio: wire.bio ?? undefined,
    memberCount: wire.memberCount,
  }
}
