import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { CoverArt } from '@/components/CoverArt'
import { cn } from '@/lib/utils'
import type { Game } from '@/mocks/types'

/**
 * The play surface — the one place `night` is used (DESIGN.md §5).
 *
 * Deliberately inverted: paper-coloured chrome on an ink ground, so crossing
 * from the store into the game is felt rather than announced.
 *
 * ── The seam ──────────────────────────────────────────────────────────────
 * `children` is where the real build mounts. When there's an actual HTML5
 * game to load this becomes an <iframe sandbox="allow-scripts allow-pointer-lock">
 * pointed at the CID from the x402 download, and nothing else here changes.
 */
export function GameStage({
  game,
  onExit,
  children,
  className,
}: {
  game: Game
  onExit?: () => void
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex h-full w-full flex-col bg-night text-paper', className)}>
      <div className="flex shrink-0 items-center justify-between gap-4 border-b-2 border-paper/25 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="font-wonk truncate text-base leading-none text-paper">
            {game.title}
          </span>
          <span className="hidden truncate font-mono text-[11px] text-paper/55 sm:block">
            {game.studio.ens ?? game.studio.name}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="label-micro hidden text-paper/55 sm:block">
            Running in this tab
          </span>
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit the game"
              className="flex cursor-pointer items-center gap-1.5 rounded-chip border-2 border-paper bg-transparent px-3 py-1 font-mono text-[11px] font-bold text-paper transition-transform duration-130 ease-out hover:-translate-y-px active:translate-y-px"
            >
              <X size={13} strokeWidth={3} />
              Exit
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[860px] overflow-hidden rounded-card border-[3px] border-paper">
          {children ?? (
            <div className="relative">
              <CoverArt seed={game.coverSeed} className="aspect-16/10" />
              <span className="label-micro absolute right-2 bottom-2 rounded-chip border-2 border-ink bg-paper px-2 py-0.5 text-ink">
                Demo build
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
