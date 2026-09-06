import { CoverArt } from '@/components/CoverArt'
import { cn } from '@/lib/utils'
import type { Game } from '@/mocks/types'

/**
 * A game's cover, wherever it appears.
 *
 * Real art if the dev added any, otherwise the generated riso composition.
 * Everything renders through here so the catalog never has to care which it is.
 */
export function Cover({
  game,
  className,
  title,
}: {
  // `coverUrl` is nullable rather than optional because that is how the API
  // sends it, and every caller here passes a server shape straight through.
  game: Pick<Game, 'coverSeed' | 'title'> & { coverUrl?: string | null }
  className?: string
  title?: string
}) {
  if (game.coverUrl) {
    return (
      <img
        src={game.coverUrl}
        alt={title ?? ''}
        className={cn('block aspect-4/3 w-full object-cover', className)}
      />
    )
  }
  return <CoverArt seed={game.coverSeed} className={className} title={title} />
}
