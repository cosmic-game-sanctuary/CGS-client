import { Maximize2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BuildFrame } from '@/components/BuildFrame'
import { Cover } from '@/components/Cover'
import { cn } from '@/lib/utils'
import { endSession, startSession } from '@/api/purchase'
import type { Game } from '@/mocks/types'

/**
 * The play surface. The one place `night` is used (DESIGN.md §5).
 *
 * Deliberately inverted: paper-coloured chrome on an ink ground, so crossing
 * from the store into the game is felt rather than announced.
 *
 * ── Where the build comes from ────────────────────────────────────────────
 * `playUrl` is the pinned build, fetched through the x402 download by whoever
 * opened this. `localBuildEntry` is a zip unpacked in this browser, which is
 * how the publish flow shows a dev their own game before it exists anywhere
 * else. The placeholder is neither, and now means what it says: there is no
 * build to run.
 *
 * The two URLs are on different origins and that is deliberate for the same
 * reason in both cases. See BuildFrame.
 */
export function GameStage({
  game,
  playUrl,
  onExit,
  children,
  className,
}: {
  game: Game
  /** Absolute URL of the build's entry point, once something has fetched one. */
  playUrl?: string | null
  onExit?: () => void
  children?: ReactNode
  className?: string
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [isFull, setIsFull] = useState(false)
  const [showHint, setShowHint] = useState(false)

  // The build actually running, whichever it is. A local one wins: it is the
  // dev's own unpublished zip, and it is the only reason they opened this.
  const src = game.localBuildEntry ?? playUrl ?? null

  // A play is counted where the frame mounts, which is the only place that
  // knows a game really started. Fire and forget in both directions: a missed
  // count is a wrong number on a listing, never a game that won't run.
  useEffect(() => {
    if (!src) return
    let sessionId: string | null = null
    let ended = false

    void startSession(game.id).then((id) => {
      sessionId = id
      if (ended && id) void endSession(game.id, id)
    })

    return () => {
      ended = true
      if (sessionId) void endSession(game.id, sessionId)
    }
  }, [game.id, src])

  useEffect(() => {
    function onChange() {
      const full = document.fullscreenElement === frameRef.current
      setIsFull(full)
      setShowHint(full)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // The hint is a reminder, not a banner. Say it once and get out of the way.
  useEffect(() => {
    if (!showHint) return
    const timer = window.setTimeout(() => setShowHint(false), 2600)
    return () => window.clearTimeout(timer)
  }, [showHint])

  const toggleFullscreen = useCallback(() => {
    const node = frameRef.current
    if (!node) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void node.requestFullscreen?.().catch(() => setIsFull(false))
  }, [])

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
        <div
          ref={frameRef}
          className={cn(
            'relative w-full overflow-hidden bg-night',
            // In fullscreen the frame is the whole screen, so the ticket-stub
            // border and ratio would only get in the way.
            isFull
              ? 'h-full max-w-none rounded-none border-0'
              : 'aspect-16/10 max-w-215 rounded-card border-[3px] border-paper',
          )}
        >
          {children ??
            (src ? (
              <BuildFrame src={src} title={game.title} />
            ) : (
              <div className="relative h-full">
                <Cover game={game} className="h-full" />
                <span className="label-micro absolute bottom-2 left-2 rounded-chip border-2 border-ink bg-paper px-2 py-0.5 text-ink">
                  No build
                </span>
              </div>
            ))}

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFull ? 'Leave fullscreen' : 'Play fullscreen'}
            className="absolute right-3 bottom-3 z-10 flex cursor-pointer items-center gap-1.5 rounded-chip border-2 border-paper bg-night/85 px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-wider text-paper uppercase transition-transform duration-130 ease-out hover:-translate-y-px active:translate-y-px"
          >
            <Maximize2 size={12} strokeWidth={3} />
            {isFull ? 'Exit' : 'Fullscreen'}
          </button>

          {showHint ? (
            <span className="animate-stamp absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-chip border-2 border-paper bg-night/90 px-3 py-1.5 font-mono text-[11px] text-paper">
              Press Esc to come back
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
