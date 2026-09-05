import { Cover } from '@/components/Cover'
import { Freehand } from '@/components/icons/Freehand'
import { PriceChip } from '@/components/ui/PriceChip'
import { cn } from '@/lib/utils'
import { games } from '@/mocks/games'

/**
 * The hero graphic: a fanned handful of games, dealt onto the page.
 *
 * Tone C — this is the landing surface, so rotation is allowed and the
 * freehand icon runs at full size behind as texture (DESIGN.md §6). The
 * cards enter with Stamp, staggered, which is the Deal motion doing what it
 * is named after.
 *
 * It shows the actual product rather than an illustration of it, and it grows
 * with the catalog instead of dating like a stock image would.
 */

const FAN = ['hollowgrave', 'undertow', 'tin-halo', 'ninefold'] as const

const ANGLES = ['-rotate-6', '-rotate-2', 'rotate-3', 'rotate-8']
const OFFSETS = ['mt-8', 'mt-0', 'mt-10', 'mt-2']

export function HeroCollage({ className }: { className?: string }) {
  const fan = FAN.map((slug) => games.find((game) => game.slug === slug)).filter(
    (game) => game !== undefined,
  )

  return (
    <div className={cn('relative', className)}>
      <Freehand
        name="video-game-controller"
        className="pointer-events-none absolute -right-6 -bottom-10 h-56 w-56 text-ink opacity-15"
      />

      <div className="relative flex justify-center -space-x-8 sm:justify-start">
        {fan.map((game, i) => (
          <article
            key={game.id}
            style={{ animationDelay: `${120 + i * 90}ms` }}
            className={cn(
              'animate-stamp w-[136px] shrink-0 overflow-hidden rounded-card border-2 border-ink bg-paper shadow-hard',
              'transition-transform duration-220 ease-land hover:-translate-y-2 hover:rotate-0',
              ANGLES[i],
              OFFSETS[i],
              // Two cards is enough on a narrow screen; four turns to mush.
              i > 1 && 'hidden sm:block',
            )}
          >
            <div className="border-b-2 border-ink">
              <Cover game={game} />
            </div>
            <div className="flex items-center justify-between gap-1.5 px-2.5 py-2">
              <span className="truncate font-wonk text-[13px] leading-none">
                {game.title}
              </span>
              <PriceChip usd={game.priceUsd} size="sm" className="shrink-0" />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
