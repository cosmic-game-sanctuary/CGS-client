import { useEffect, useRef, useState } from 'react'
import { GameStage } from '@/components/GameStage'
import { cn } from '@/lib/utils'
import { PLAY_BEATS, type Beat } from '@/components/play/beats'
import type { Game } from '@/mocks/types'

/**
 * The store to play transition (DESIGN.md §5). One 600ms clip-path wipe over
 * the whole viewport, beats running behind it, then the game.
 *
 * The wipe covers whatever the wait actually is, so latency reads as staging
 * rather than as a spinner. Shared by purchase and by plain play, because the
 * moment should feel the same either way: the difference is only what the
 * beats say.
 */

export function LightsDown({
  game,
  beats,
  active = true,
  onExit,
}: {
  game: Game
  beats: Beat[]
  /** Checkout keeps the panel up until payment starts. */
  active?: boolean
  onExit: () => void
}) {
  const [index, setIndex] = useState(-1)
  const [leaving, setLeaving] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const id of pending) window.clearTimeout(id)
    }
  }, [])

  /** Run the shutter back up before handing control to the caller. */
  function beginExit() {
    if (leaving) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      onExit()
      return
    }
    setLeaving(true)
    timers.current.push(window.setTimeout(onExit, 560))
  }

  useEffect(() => {
    if (!active) return
    let elapsed = 0
    const ids: number[] = []
    beats.forEach((beat, i) => {
      ids.push(
        window.setTimeout(() => {
          setIndex(i)
          beat.at?.()
        }, elapsed),
      )
      elapsed += beat.ms
    })
    ids.push(window.setTimeout(() => setIndex(beats.length), elapsed))
    timers.current.push(...ids)
    return () => {
      for (const id of ids) window.clearTimeout(id)
    }
  }, [active, beats])

  const playing = index >= beats.length

  return (
    <div
      aria-hidden={!active}
      className={cn(
        'absolute inset-0 bg-night',
        leaving
          ? 'wipe-out'
          : active
            ? 'wipe-down'
            : 'wipe-up pointer-events-none',
      )}
    >
      {playing ? (
        <GameStage game={game} onExit={beginExit} />
      ) : (
        <BootSequence beats={beats} index={index} />
      )}
    </div>
  )
}

function BootSequence({ beats, index }: { beats: Beat[]; index: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-paper">
      <p aria-live="polite" className="label-micro min-h-4 text-paper/70">
        {index >= 0 && index < beats.length ? `${beats[index].label}…` : ''}
      </p>

      {/* Steps filling as each completes. Progress, not a spinner. */}
      <div className="flex gap-2" aria-hidden>
        {beats.map((beat, i) => (
          <span
            key={beat.label}
            className={cn(
              'h-2 w-12 rounded-chip border-2 border-paper transition-colors duration-300',
              index > i ? 'bg-green' : 'bg-transparent',
            )}
          />
        ))}
      </div>
    </div>
  )
}

/** Full-screen play, opened in place so the page never navigates away. */
export function PlayOverlay({
  game,
  onClose,
}: {
  game: Game
  onClose: () => void
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${game.title}`}
    >
      <LightsDown game={game} beats={PLAY_BEATS} onExit={onClose} />
    </div>
  )
}
