import type { Game, MediaItem } from './types'

/**
 * Screenshots for a game.
 *
 * A game published in this session carries whatever the dev actually added.
 * Everything in the seeded catalog has no files, so we derive a handful of
 * placeholder frames from its cover seed. That keeps every listing looking
 * like a real listing without shipping fake screenshots as assets.
 */
export function mediaFor(game: Game): MediaItem[] {
  if (game.media && game.media.length > 0) return game.media

  return [
    { id: `${game.id}-m0`, kind: 'image', seed: game.coverSeed },
    { id: `${game.id}-m1`, kind: 'image', seed: game.coverSeed + 7 },
    { id: `${game.id}-m2`, kind: 'image', seed: game.coverSeed + 13 },
    { id: `${game.id}-m3`, kind: 'image', seed: game.coverSeed + 21 },
  ]
}
