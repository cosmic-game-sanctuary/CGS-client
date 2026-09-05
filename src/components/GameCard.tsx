import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Cover } from '@/components/Cover'
import { PriceChip } from '@/components/ui/PriceChip'
import { Sticker } from '@/components/ui/Sticker'
import { displayIdentity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Game } from '@/mocks/types'

const STICKER_LABEL = {
  new: 'New',
  jam: 'Jam',
  updated: 'Updated',
} as const

/**
 * The atom of the catalog.
 *
 * Hover is per-part, never per-box — DESIGN.md §4. Five parts move on five
 * timings: frame, art, title, studio, price chip, sticker. A single uniform
 * scale-up is the tell that someone animated a box instead of an object.
 */
export function GameCard({
  game,
  style,
  className,
}: {
  game: Game
  style?: CSSProperties
  className?: string
}) {
  return (
    <Link
      to={`/game/${game.slug}`}
      style={style}
      className={cn(
        'group relative block overflow-hidden rounded-card border-2 border-ink bg-paper text-ink no-underline shadow-hard',
        'transition-[transform,box-shadow] duration-220 ease-land',
        'hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-hard-lg',
        className,
      )}
    >
      <div className="overflow-hidden border-b-2 border-ink">
        <Cover
          game={game}
          className="transition-transform duration-420 ease-[cubic-bezier(.2,.7,.3,1)] group-hover:-translate-y-0.5 group-hover:scale-[1.07]"
        />
      </div>

      <div className="px-3.5 pt-3 pb-4">
        <h3 className="text-lg leading-tight transition-transform duration-240 delay-30 ease-land group-hover:translate-x-1">
          {game.title}
        </h3>

        <p className="mt-1 truncate font-mono text-[11px] text-ink-soft transition-transform duration-240 delay-60 ease-land group-hover:translate-x-1">
          {displayIdentity({
            ens: game.studio.ens,
            name: game.studio.name,
            address: game.studio.address,
          })}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <PriceChip
            usd={game.priceUsd}
            className="transition-transform duration-300 delay-50 ease-pop group-hover:-rotate-3 group-hover:scale-[1.08]"
          />
          <span className="font-wonk text-[13px] text-ink-soft transition-colors group-hover:text-ink">
            {game.priceUsd === 0 ? 'Play →' : 'View →'}
          </span>
        </div>
      </div>

      {game.sticker ? (
        <Sticker
          className={cn(
            'absolute top-2.5 -right-1 rotate-3',
            'transition-[transform,box-shadow] duration-320 delay-80 ease-pop',
            'group-hover:-translate-y-1 group-hover:rotate-[9deg] group-hover:scale-[1.07] group-hover:shadow-hard',
          )}
        >
          {STICKER_LABEL[game.sticker]}
        </Sticker>
      ) : null}
    </Link>
  )
}

/** Hatched placeholder at the exact dimensions of a card. No shimmer. §8 */
export function GameCardSkeleton({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={style}
      className="overflow-hidden rounded-card border-2 border-ink bg-paper shadow-hard"
    >
      <div className="hatch aspect-4/3 w-full border-b-2 border-ink" />
      <div className="px-3.5 pt-3 pb-4">
        <div className="hatch h-5 w-3/4 rounded-sm border-2 border-ink" />
        <div className="hatch mt-2 h-3 w-1/2 rounded-sm border-2 border-ink" />
        <div className="mt-3 flex items-center justify-between">
          <div className="hatch h-6 w-16 rounded-chip border-2 border-ink" />
        </div>
      </div>
    </div>
  )
}
