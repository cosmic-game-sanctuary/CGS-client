/**
 * Reads for the browse screens. Catalog, listing, reviews, studio.
 *
 * These are the real versions of what `mocks/games.ts` faked, with the same
 * names and the same return types, so the screens above them did not have to
 * change shape to use them.
 *
 * Note which endpoints take which key: only `GET /api/games/:idOrSlug` and
 * `GET /api/studios/:idOrSlug` accept a slug. Reviews, download, owned, pay,
 * publish and sessions are all keyed by the game's UUID, so anything that
 * needs them chains off the detail response rather than off the URL.
 */
import { request, requestOptional } from '@/lib/api'
import { adaptGame, adaptReview, adaptStudio } from '@/api/adapt'
import type {
  WireCatalog,
  WireGame,
  WireReviewPage,
  WireStudio,
  WireStudioGame,
} from '@/api/wire'
import type { CatalogQuery, Game, Review, Studio } from '@/mocks/types'

export interface CatalogPage {
  games: Game[]
  /** Pass back as `cursor` for the next page. Null when there are no more. */
  nextCursor: string | null
}

export async function listGames(
  query: CatalogQuery & { studioId?: string; cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<CatalogPage> {
  const page = await request<WireCatalog>('/api/games', {
    query: {
      search: query.search?.trim() || undefined,
      tag: query.tag,
      studioId: query.studioId,
      sort: query.sort,
      freeOnly: query.freeOnly ? 'true' : undefined,
      cursor: query.cursor,
      limit: query.limit,
    },
    signal,
  })
  return { games: page.games.map(adaptGame), nextCursor: page.nextCursor }
}

/** Undefined means no such game, which is a real answer the listing renders. */
export async function getGame(
  idOrSlug: string,
  signal?: AbortSignal,
): Promise<Game | undefined> {
  const wire = await requestOptional<WireGame>(
    `/api/games/${encodeURIComponent(idOrSlug)}`,
    { signal },
  )
  return wire ? adaptGame(wire) : undefined
}

/**
 * The detail response carries `owned` and `liked` only when signed in, and
 * `adaptGame` drops them because the view model has nowhere to put them. This
 * returns both alongside, for the listing, which needs them.
 */
export async function getGameWithState(
  idOrSlug: string,
  signal?: AbortSignal,
): Promise<{ game: Game; owned: boolean; liked: boolean } | undefined> {
  const wire = await requestOptional<WireGame>(
    `/api/games/${encodeURIComponent(idOrSlug)}`,
    { signal },
  )
  if (!wire) return undefined
  return {
    game: adaptGame(wire),
    owned: wire.owned ?? false,
    liked: wire.liked ?? false,
  }
}

/** Keyed by UUID, not slug. */
export async function getReviews(
  gameId: string,
  signal?: AbortSignal,
): Promise<Review[]> {
  const page = await request<WireReviewPage>(
    `/api/games/${gameId}/reviews`,
    { query: { limit: 50 }, signal },
  )
  return page.reviews.map(adaptReview)
}

export interface StudioProfile {
  studio: Studio
  /** Every game the studio has, including drafts. Filter by status to taste. */
  games: WireStudioGame[]
  members: WireStudio['members']
}

export async function getStudio(
  idOrSlug: string,
  signal?: AbortSignal,
): Promise<StudioProfile | undefined> {
  const wire = await requestOptional<WireStudio>(
    `/api/studios/${encodeURIComponent(idOrSlug)}`,
    { signal },
  )
  if (!wire) return undefined
  return {
    studio: adaptStudio(wire),
    games: wire.games,
    members: wire.members,
  }
}

/**
 * The studio page shows full cards, and the studio route returns only enough
 * of each game to identify it. One catalog read filtered by studio is cheaper
 * than one detail read per game, and it excludes drafts for us.
 */
export async function listGamesByStudio(
  studioId: string,
  signal?: AbortSignal,
): Promise<Game[]> {
  const { games } = await listGames({ studioId, limit: 60 }, signal)
  return games
}

/**
 * Every tag in a set of games, most common first.
 *
 * Pure, because the filter row's vocabulary has to come from the whole catalog
 * rather than from the results currently on screen. Filtering to one tag would
 * otherwise leave that tag as the only one you could still click.
 */
export function tagsFrom(games: Game[]): string[] {
  const counts = new Map<string, number>()
  for (const game of games) {
    for (const tag of game.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag)
}
