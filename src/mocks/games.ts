/**
 * Mock catalog. No backend, no chain, no Privy — see CLAUDE.md §3.
 *
 * Every call is deliberately async with a small delay so loading states are
 * real and get designed rather than skipped.
 */
import { notify } from './notifications'
import type { CatalogQuery, Game, MediaItem, Review, Studio } from './types'

const LATENCY_MS = 320

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export const studios: Record<string, Studio> = {
  tinroof: {
    id: 'st_tinroof',
    name: 'Tin Roof',
    ens: 'tinroof.eth',
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    bio: 'Three people, one jam, no publisher. We make small sad games about buildings.',
    memberCount: 3,
  },
  smallhours: {
    id: 'st_smallhours',
    name: 'Small Hours',
    ens: 'smallhours.eth',
    address: '0x9A3f2C1b44Ee7d8901Bc5f6789012345678AbCdE',
    bio: 'Nocturnal two-person studio. Everything we ship was finished after 1am.',
    memberCount: 2,
  },
  driftco: {
    id: 'st_driftco',
    name: 'Drift Co.',
    ens: 'driftco.eth',
    address: '0x4d5E6f708192A3b4C5d6E7f8091A2b3C4d5E6f70',
    bio: 'Slow games for fast weeks.',
    memberCount: 4,
  },
  moss: {
    id: 'st_moss',
    name: 'Moss Collective',
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d81234',
    bio: 'A rotating group of five who met in a game jam Discord and never left.',
    memberCount: 5,
  },
  paperlung: {
    id: 'st_paperlung',
    name: 'Paper Lung',
    ens: 'paperlung.eth',
    address: '0xAb1234567890CdEf1234567890AbCdEf12345678',
    bio: 'One person. Mostly typing.',
    memberCount: 1,
  },
  brightsalt: {
    id: 'st_brightsalt',
    name: 'Bright Salt',
    ens: 'brightsalt.eth',
    address: '0xFe0987654321BaDc0987654321FeDcBa09876543',
    bio: 'We were on itch until we weren’t.',
    memberCount: 2,
  },
}

export const games: Game[] = [
  {
    id: 'gm_hollowgrave',
    slug: 'hollowgrave',
    title: 'Hollowgrave',
    tagline: 'Dig down. Something is already there.',
    description:
      'A one-button descent into a mine that keeps getting deeper than it should. Every run reshuffles the tunnels, and the lantern only lasts so long. Built in nine days for a jam about verticality, then finished properly because we could not stop playing it.\n\nNo save files, no meta-progression, no currency. You go down, you come back up, or you do not.',
    studio: studios.tinroof,
    priceUsd: 3,
    tags: ['roguelike', 'atmospheric', 'one-button'],
    sticker: 'new',
    coverSeed: 11,
    publishedAt: '2026-09-01T09:00:00Z',
    splits: [
      { handle: 'miracode', role: 'code', pct: 50 },
      { handle: 'junart', role: 'art', pct: 30 },
      { handle: 'olamusic', role: 'music', pct: 20 },
    ],
    rating: 4.6,
    reviewCount: 23,
    plays: 1840,
    buildKb: 4200,
  },
  {
    id: 'gm_tinhalo',
    slug: 'tin-halo',
    title: 'Tin Halo',
    tagline: 'A saint made of scrap, walking home.',
    description:
      'A short walking game with no combat and no fail state. You are a small tin figure crossing a red country toward a house you may have invented. Takes about twenty minutes. Play it with sound on.\n\nFree because the first one should be.',
    studio: studios.smallhours,
    priceUsd: 0,
    tags: ['narrative', 'short', 'no-fail'],
    coverSeed: 2,
    publishedAt: '2026-08-28T14:30:00Z',
    splits: [
      { handle: 'devi', role: 'code + art', pct: 60 },
      { handle: 'ashwin', role: 'writing', pct: 40 },
    ],
    rating: 4.8,
    reviewCount: 41,
    plays: 6120,
    buildKb: 1850,
  },
  {
    id: 'gm_mossrust',
    slug: 'moss-and-rust',
    title: 'Moss & Rust',
    tagline: 'Terraform a dead satellite with nothing but patience.',
    description:
      'A slow builder about coaxing life back onto a hulk in orbit. Place moss, wait, place more. There is no threat and no timer; the only pressure is that the station keeps drifting further from the sun.\n\nMade by five people who have never been in the same room.',
    studio: studios.moss,
    priceUsd: 1.8,
    tags: ['builder', 'idle', 'cozy'],
    sticker: 'updated',
    coverSeed: 5,
    publishedAt: '2026-08-19T11:15:00Z',
    splits: [
      { handle: 'renn', role: 'code', pct: 35 },
      { handle: 'plum', role: 'art', pct: 25 },
      { handle: 'kestrel', role: 'design', pct: 20 },
      { handle: 'sable', role: 'music', pct: 20 },
    ],
    rating: 4.3,
    reviewCount: 17,
    plays: 980,
    buildKb: 7400,
  },
  {
    id: 'gm_paperclip',
    slug: 'paperclip-ocean',
    title: 'Paperclip Ocean',
    tagline: 'Fold a boat. Sail it into weather you cannot fold.',
    description:
      'An origami sailing game with real fluid simulation and absolutely no tutorial. Fold your hull between crossings; every crease you add costs you somewhere else.\n\nRuns at 60fps in a browser tab on a five-year-old laptop, which took longer than the game did.',
    studio: studios.driftco,
    priceUsd: 5,
    tags: ['physics', 'sailing', 'no-tutorial'],
    coverSeed: 8,
    publishedAt: '2026-08-11T16:45:00Z',
    splits: [
      { handle: 'aria', role: 'engine', pct: 40 },
      { handle: 'toma', role: 'art', pct: 30 },
      { handle: 'bex', role: 'design', pct: 20 },
      { handle: 'nils', role: 'audio', pct: 10 },
    ],
    rating: 4.5,
    reviewCount: 29,
    plays: 2310,
    buildKb: 9100,
  },
  {
    id: 'gm_lastbus',
    slug: 'last-bus-to-anywhere',
    title: 'Last Bus to Anywhere',
    tagline: 'Everyone on board is going home. You are not sure you are.',
    description:
      'A conversation game set on a night bus that never quite arrives. Eleven passengers, one route, and a driver who will answer exactly one question. Branching is small and deliberate; you will see most of it in two runs.',
    studio: studios.paperlung,
    priceUsd: 2.5,
    tags: ['narrative', 'dialogue', 'short'],
    coverSeed: 14,
    publishedAt: '2026-08-04T08:20:00Z',
    splits: [{ handle: 'wren', role: 'everything', pct: 100 }],
    rating: 4.7,
    reviewCount: 52,
    plays: 4400,
    buildKb: 2200,
  },
  {
    id: 'gm_saltflat',
    slug: 'saltflat-derby',
    title: 'Saltflat Derby',
    tagline: 'Drive very fast in a straight line. Try to keep the wheels on.',
    description:
      'Land-speed racing reduced to its only interesting decision: when to lift. One track, one car, one minute per attempt, and a leaderboard that resets every Sunday.',
    studio: studios.brightsalt,
    priceUsd: 1.5,
    tags: ['racing', 'arcade', 'leaderboard'],
    sticker: 'jam',
    coverSeed: 3,
    publishedAt: '2026-07-30T13:00:00Z',
    splits: [
      { handle: 'ines', role: 'code', pct: 55 },
      { handle: 'gus', role: 'art + audio', pct: 45 },
    ],
    rating: 4.1,
    reviewCount: 11,
    plays: 720,
    buildKb: 3300,
  },
  {
    id: 'gm_lantern',
    slug: 'lantern-arithmetic',
    title: 'Lantern Arithmetic',
    tagline: 'A puzzle box that teaches you its own maths.',
    description:
      'Forty rooms, no words. Each room introduces one rule and then immediately tests whether you actually learned it. The last ten rooms are genuinely hard and we are not sorry.',
    studio: studios.paperlung,
    priceUsd: 4,
    tags: ['puzzle', 'wordless', 'hard'],
    coverSeed: 6,
    publishedAt: '2026-07-22T10:10:00Z',
    splits: [{ handle: 'wren', role: 'everything', pct: 100 }],
    rating: 4.9,
    reviewCount: 38,
    plays: 1560,
    buildKb: 1400,
  },
  {
    id: 'gm_thicket',
    slug: 'thicket',
    title: 'Thicket',
    tagline: 'Grow a hedge maze. Live in it.',
    description:
      'Part gardener, part cartographer. You plant the maze and then have to find your way back through it from memory. Autumn arrives on turn forty and takes the leaves with it.',
    studio: studios.moss,
    priceUsd: 0,
    tags: ['strategy', 'cozy', 'seasonal'],
    coverSeed: 9,
    publishedAt: '2026-07-14T12:00:00Z',
    splits: [
      { handle: 'renn', role: 'code', pct: 50 },
      { handle: 'plum', role: 'art', pct: 50 },
    ],
    rating: 4.2,
    reviewCount: 14,
    plays: 3050,
    buildKb: 2600,
  },
  {
    id: 'gm_switchback',
    slug: 'switchback',
    title: 'Switchback',
    tagline: 'One mountain. Twelve routes. Weather that does not care.',
    description:
      'A climbing game about route-reading rather than reflexes. Pick a line, commit, and find out whether the weather agrees with you. Every ascent is timed but nothing is a race.',
    studio: studios.driftco,
    priceUsd: 3.5,
    tags: ['climbing', 'simulation', 'weather'],
    coverSeed: 12,
    publishedAt: '2026-07-02T15:40:00Z',
    splits: [
      { handle: 'aria', role: 'code', pct: 45 },
      { handle: 'toma', role: 'art', pct: 35 },
      { handle: 'nils', role: 'audio', pct: 20 },
    ],
    rating: 4.4,
    reviewCount: 20,
    plays: 1210,
    buildKb: 6800,
  },
  {
    id: 'gm_smallgods',
    slug: 'small-gods-of-the-tram-network',
    title: 'Small Gods of the Tram Network',
    tagline: 'Every line has a spirit. Most of them are tired.',
    description:
      'Manage a city tram network in which each route is a minor deity with opinions about punctuality. Keep them happy, keep them running, or watch the timetable become mythology.',
    studio: studios.brightsalt,
    priceUsd: 6,
    tags: ['management', 'comedy', 'city'],
    coverSeed: 1,
    publishedAt: '2026-06-25T09:30:00Z',
    splits: [
      { handle: 'ines', role: 'code', pct: 50 },
      { handle: 'gus', role: 'art', pct: 30 },
      { handle: 'dara', role: 'writing', pct: 20 },
    ],
    rating: 4.0,
    reviewCount: 9,
    plays: 640,
    buildKb: 8200,
  },
  {
    id: 'gm_undertow',
    slug: 'undertow',
    title: 'Undertow',
    tagline: 'Swim down. The light gets more interesting.',
    description:
      'A breath-holding descent with no enemies and one rule: you must always be able to get back. Procedural kelp, real caustics, and a pressure gauge that is the entire UI.',
    studio: studios.smallhours,
    priceUsd: 2,
    tags: ['atmospheric', 'diving', 'minimal-ui'],
    coverSeed: 4,
    publishedAt: '2026-06-16T18:00:00Z',
    splits: [
      { handle: 'devi', role: 'code', pct: 50 },
      { handle: 'ashwin', role: 'art + audio', pct: 50 },
    ],
    rating: 4.6,
    reviewCount: 26,
    plays: 2740,
    buildKb: 5600,
  },
  {
    id: 'gm_ninefold',
    slug: 'ninefold',
    title: 'Ninefold',
    tagline: 'A card game against nine versions of yourself.',
    description:
      'Deckbuilder where every card you play is added to your opponent’s deck for the next round. Nine rounds, escalating, and by round seven you are losing to your own best ideas.',
    studio: studios.tinroof,
    priceUsd: 4.5,
    tags: ['deckbuilder', 'strategy', 'roguelike'],
    coverSeed: 7,
    publishedAt: '2026-06-08T11:00:00Z',
    splits: [
      { handle: 'miracode', role: 'code', pct: 45 },
      { handle: 'junart', role: 'art', pct: 35 },
      { handle: 'olamusic', role: 'music', pct: 20 },
    ],
    rating: 4.5,
    reviewCount: 33,
    plays: 1930,
    buildKb: 3900,
  },
]

const reviews: Review[] = [
  {
    id: 'rv_1',
    gameId: 'gm_hollowgrave',
    author: 'petra.eth',
    authorIsEns: true,
    rating: 5,
    body: 'Got to floor 14 and the lantern went out while I was reading a note. Sat there in the dark for a second genuinely upset. Great game.',
    createdAt: '2026-09-03T19:20:00Z',
  },
  {
    id: 'rv_2',
    gameId: 'gm_hollowgrave',
    author: '0x9A3f2C1b44Ee7d8901Bc5f6789012345678AbCdE',
    authorIsEns: false,
    rating: 4,
    body: 'One button is doing a lot of work here and it mostly holds. Wish the map reshuffled a little less aggressively on death.',
    createdAt: '2026-09-02T08:05:00Z',
  },
  {
    id: 'rv_3',
    gameId: 'gm_hollowgrave',
    author: 'juno.eth',
    authorIsEns: true,
    rating: 5,
    body: 'Bought it, played it in the same tab about four seconds later. Still slightly suspicious that worked.',
    createdAt: '2026-09-01T22:41:00Z',
  },
  {
    id: 'rv_4',
    gameId: 'gm_hollowgrave',
    author: 'marek.eth',
    authorIsEns: true,
    rating: 4,
    body: 'The sound design is the best part and nobody is talking about it. Headphones, floor 8, you will see.',
    createdAt: '2026-08-30T13:12:00Z',
  },
]

// ── queries ───────────────────────────────────────────────────────────────

export async function listGames(query: CatalogQuery = {}): Promise<Game[]> {
  const { search, tag, sort = 'newest', freeOnly } = query
  const needle = search?.trim().toLowerCase()

  let result = games.filter((game) => {
    if (freeOnly && game.priceUsd > 0) return false
    if (tag && !game.tags.includes(tag)) return false
    if (!needle) return true
    return (
      game.title.toLowerCase().includes(needle) ||
      game.tagline.toLowerCase().includes(needle) ||
      game.tags.some((t) => t.includes(needle)) ||
      game.studio.name.toLowerCase().includes(needle) ||
      (game.studio.ens?.toLowerCase().includes(needle) ?? false)
    )
  })

  result = [...result].sort((a, b) => {
    switch (sort) {
      case 'price-low':
        return a.priceUsd - b.priceUsd
      case 'price-high':
        return b.priceUsd - a.priceUsd
      case 'rating':
        return b.rating - a.rating
      default:
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
    }
  })

  return delay(result)
}

export async function getGame(slug: string): Promise<Game | undefined> {
  return delay(games.find((game) => game.slug === slug))
}

let reviewSeq = 0

/** TODO(integration): POST /api/games/:id/reviews, ownership-gated server side. */
export async function addReview(input: {
  gameId: string
  author: string
  authorIsEns: boolean
  rating: number
  body: string
}): Promise<Review> {
  reviewSeq += 1
  const review: Review = {
    id: `rv_new_${reviewSeq}`,
    gameId: input.gameId,
    author: input.author,
    authorIsEns: input.authorIsEns,
    rating: input.rating,
    body: input.body,
    createdAt: new Date().toISOString(),
  }
  reviews.unshift(review)

  const game = games.find((candidate) => candidate.id === input.gameId)
  if (game) {
    const total = game.rating * game.reviewCount + input.rating
    game.reviewCount += 1
    game.rating = Math.round((total / game.reviewCount) * 10) / 10
  }

  return delay(review, 500)
}

/** TODO(integration): POST /api/reports. Reports pull a game immediately. */
export async function submitReport(input: {
  gameId: string
  reason: string
  detail: string
}): Promise<{ ok: true }> {
  console.info('[mock] report filed', input)
  return delay({ ok: true } as const, 600)
}

export async function getReviews(gameId: string): Promise<Review[]> {
  return delay(
    reviews
      .filter((review) => review.gameId === gameId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    LATENCY_MS + 180,
  )
}

/** The parent name every studio gets a subname under. */
export const ENS_PARENT = 'cgs.eth'

/** Mock availability. Real check is on chain against the parent registry. */
export function ensTaken(label: string): boolean {
  const wanted = `${label.toLowerCase()}.${ENS_PARENT}`
  return Object.values(studios).some(
    (studio) => studio.ens?.toLowerCase() === wanted,
  )
}

/**
 * TODO(integration): POST /api/studios, which also deploys the studio's own
 * subname registry when an ENS label is given.
 */
export async function createStudio(input: {
  name: string
  ensLabel?: string
  bio?: string
}): Promise<Studio> {
  const key = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'studio'
  const studio: Studio = {
    id: `st_${key}_${Object.keys(studios).length}`,
    name: input.name.trim(),
    ens: input.ensLabel ? `${input.ensLabel}.${ENS_PARENT}` : undefined,
    // TODO(integration): the real address is the Privy embedded wallet.
    address: '0xC0FFEE1234567890AbCdEf1234567890AbCdEf12',
    bio: input.bio?.trim() || undefined,
    memberCount: 1,
  }
  studios[key + studio.id] = studio
  return delay(studio, 700)
}

export function studioById(id: string): Studio | undefined {
  return Object.values(studios).find((studio) => studio.id === id)
}

export async function getStudio(id: string): Promise<Studio | undefined> {
  return delay(studioById(id))
}

export async function listGamesByStudio(studioId: string): Promise<Game[]> {
  return delay(
    games
      .filter((game) => game.studio.id === studioId)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
  )
}

/**
 * Who's actually in a studio, derived from the splits across everything they
 * published — the roles people took are more honest than a members table, and
 * it's the same data a real studio page would have.
 */
export function studioCredits(
  studioGames: Game[],
): Array<{ handle: string; roles: string[]; games: number }> {
  const people = new Map<string, { roles: Set<string>; games: number }>()
  for (const game of studioGames) {
    for (const member of game.splits) {
      const entry = people.get(member.handle) ?? { roles: new Set(), games: 0 }
      entry.roles.add(member.role)
      entry.games += 1
      people.set(member.handle, entry)
    }
  }
  return [...people.entries()]
    .map(([handle, entry]) => ({
      handle,
      roles: [...entry.roles],
      games: entry.games,
    }))
    .sort((a, b) => b.games - a.games || a.handle.localeCompare(b.handle))
}

/**
 * Handles that have appeared on this studio's splits before — the people you
 * can add to a new game by name, without needing an email.
 */
export function studioTeam(studioId: string): string[] {
  return studioCredits(
    games.filter((game) => game.studio.id === studioId),
  ).map((person) => person.handle)
}

/** A game being written in the publish flow, before it exists. */
export interface GameDraft {
  title: string
  tagline: string
  description: string
  tags: string[]
  priceUsd: number
  coverSeed: number
  splits: Game['splits']
  buildKb: number
  localBuildEntry?: string
  coverUrl?: string
  media?: MediaItem[]
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  )
}

/**
 * Publishes into the in-memory catalog so the flow ends somewhere real — the
 * new game appears in the grid and has a working listing page.
 * TODO(integration): POST /api/games, multipart with build + art + metadata.
 */
export async function publishGame(
  draft: GameDraft,
  studio: Studio,
): Promise<Game> {
  const base = slugify(draft.title)
  let slug = base
  let n = 2
  while (games.some((game) => game.slug === slug)) slug = `${base}-${n++}`

  const game: Game = {
    id: `gm_${slug.replace(/-/g, '')}`,
    slug,
    title: draft.title,
    tagline: draft.tagline,
    description: draft.description,
    studio,
    priceUsd: draft.priceUsd,
    tags: draft.tags,
    sticker: 'new',
    coverSeed: draft.coverSeed,
    publishedAt: new Date().toISOString(),
    splits: draft.splits,
    rating: 0,
    reviewCount: 0,
    plays: 0,
    buildKb: draft.buildKb,
    localBuildEntry: draft.localBuildEntry,
    coverUrl: draft.coverUrl,
    media: draft.media,
  }

  games.unshift(game)
  notify({
    kind: 'live',
    title: `${game.title} is live`,
    detail:
      game.splits.length > 1
        ? `Split ${game.splits.length} ways. Locked.`
        : 'Every sale lands in your wallet on settlement.',
    to: `/game/${game.slug}`,
  })
  return delay(game, 900)
}

/** Every tag in the catalog, most common first. */
export function allTags(): string[] {
  const counts = new Map<string, number>()
  for (const game of games) {
    for (const tag of game.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag)
}
