import type { Game } from '@/mocks/types'

/**
 * Who is actually in a studio, derived from the splits across everything they
 * published.
 *
 * More honest than a members table: it lists the people who were paid for the
 * work, with the roles they actually took, and it is the same data the listing
 * already shows publicly. A members row can say anything; a split had to be
 * agreed before the first sale and cannot be edited after it.
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
