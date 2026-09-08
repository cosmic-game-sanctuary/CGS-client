/**
 * Reads for the browse screens. Catalog, listing, reviews, studio.
 *
 * These are the real versions of what `mocks/games.ts` faked, with the same
 * names and the same return types, so the screens above them did not have to
 * change shape to use them.
 *
 * ~~Only the two detail routes accept a slug.~~ **Every `/api/games/:id/…`
 * route takes one now** — several used to answer 500 for a slug, so
 * `/api/games/deadzone/reviews` was a server error while `/api/games/deadzone`
 * worked. The calls below still chain off the detail response for their ids,
 * which costs nothing and keeps one lookup as the single source of the game;
 * the constraint that forced it is simply gone.
 */
import { request, requestOptional } from '@/lib/api'
import { adaptGame, adaptStudio } from '@/api/adapt'
import type {
  WireCatalog,
  WireGame,
  WireStudio,
  WireStudioGame,
} from '@/api/wire'
import type { CatalogQuery, Game, Studio } from '@/mocks/types'

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
): Promise<
  | {
      game: Game
      owned: boolean
      wishlisted: boolean
      wishlistCount: number
      /** The agent's ceiling on this game, in units. Null for a plain save. */
      agentMaxUnits: number | null
    }
  | undefined
> {
  const wire = await requestOptional<WireGame>(
    `/api/games/${encodeURIComponent(idOrSlug)}`,
    { signal },
  )
  if (!wire) return undefined
  return {
    game: adaptGame(wire),
    owned: wire.owned ?? false,
    // `liked` is the same flag under its older name, kept so nothing that
    // predates the wishlist broke. Either is correct; prefer the new one.
    wishlisted: wire.wishlisted ?? wire.liked ?? false,
    wishlistCount: wire.wishlistCount ?? wire.likeCount ?? 0,
    agentMaxUnits: wire.agentMaxUnits ?? null,
  }
}

export interface StudioProfile {
  studio: Studio
  /** Whose studio it is. Compared against the session to gate the roster. */
  ownerUserId: string
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
    ownerUserId: wire.ownerUserId,
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
