import { useEffect, useMemo, useRef, useState } from 'react'
import { GameStage } from '@/components/GameStage'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api'
import { getDownload, mountGrant, type AccessGrant } from '@/api/purchase'
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
 *
 * The beats now carry the work rather than running to a script beside it. A
 * payment takes as long as the network takes, and a sequence that finished
 * first would drop the buyer onto a game that had not been paid for yet.
 */

export function LightsDown({
  game,
  beats,
  active = true,
  playUrl,
  onExit,
}: {
  game: Game
  beats: Beat[]
  /** Checkout keeps the panel up until payment starts. */
  active?: boolean
  /** The build to run, once something has fetched one. */
  playUrl?: string | null
  onExit: () => void
}) {
  const [index, setIndex] = useState(-1)
  const [progress, setProgress] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)
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

  // The sequence is read through a ref and started exactly once.
  //
  // It used to depend on `beats` directly, which is a live grenade here: the
  // work a beat does can change what the app renders — a purchase updates the
  // session — and a re-rendered parent hands down a new beats array. The effect
  // would tear down mid-payment and start again, and the second run would pay
  // for the game a second time. Nothing about a boot sequence should restart,
  // so it doesn't.
  const beatsRef = useRef(beats)
  useEffect(() => {
    beatsRef.current = beats
  }, [beats])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const sequence = beatsRef.current

    async function run() {
      for (let i = 0; i < sequence.length; i++) {
        if (cancelled) return
        const beat = sequence[i]
        setIndex(i)
        setProgress(0)
        beat.at?.()

        // The floor and the work run together, so a beat lasts the longer of
        // the two. Without the floor a cached answer would flash three labels
        // in one frame; without the work the sequence would outrun the payment.
        try {
          await Promise.all([
            new Promise((resolve) => {
              timers.current.push(window.setTimeout(resolve, beat.ms))
            }),
            beat.work?.((fraction) => {
              if (!cancelled) setProgress(fraction)
            }),
          ])
        } catch (error) {
          if (!cancelled) setFailure(errorMessage(error))
          return
        }
      }
      if (!cancelled) setIndex(sequence.length)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [active])

  const playing = index >= beats.length

  return (
    <div
      aria-hidden={!active}
      className={cn(
        'absolute inset-0 bg-night',
        leaving ? 'wipe-out' : active ? 'wipe-down' : 'wipe-up pointer-events-none',
      )}
    >
      {failure ? (
        <Failure message={failure} onExit={beginExit} />
      ) : playing ? (
        <GameStage game={game} playUrl={playUrl} onExit={beginExit} />
      ) : (
        <BootSequence beats={beats} index={index} progress={progress} />
      )}
    </div>
  )
}

function BootSequence({
  beats,
  index,
  progress,
}: {
  beats: Beat[]
  index: number
  progress: number
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-paper">
      <p aria-live="polite" className="label-micro min-h-4 text-paper/70">
        {index >= 0 && index < beats.length ? `${beats[index].label}…` : ''}
      </p>

      {/* Steps filling as each completes. Progress, not a spinner. The step in
          hand fills as it goes, for the one that downloads a whole build. */}
      <div className="flex gap-2" aria-hidden>
        {beats.map((beat, i) => (
          <span
            key={beat.label}
            className="relative block h-2 w-12 overflow-hidden rounded-chip border-2 border-paper"
          >
            <span
              className="absolute inset-y-0 left-0 bg-green transition-[width] duration-200 ease-out"
              style={{
                width: index > i ? '100%' : index === i ? `${progress * 100}%` : '0%',
              }}
            />
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Something went wrong behind the shutter.
 *
 * Said on the night surface rather than by throwing the buyer back to the
 * listing with nothing on screen. The wording is deliberately about money: on
 * this screen the only question anyone has is whether they were charged.
 */
function Failure({ message, onExit }: { message: string; onExit: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center text-paper">
      <h2 className="text-2xl text-paper">That didn&rsquo;t go through.</h2>
      <p className="max-w-100 font-body text-sm leading-relaxed text-paper/70">
        {message}
      </p>
      <Button variant="neutral" size="md" onClick={onExit}>
        Back to the listing
      </Button>
    </div>
  )
}

/**
 * Full-screen play, opened in place so the page never navigates away.
 *
 * Fetches the build itself, on the first beat. A game you already own still has
 * to ask where its build is, because the answer is an ownership-checked call,
 * not something the catalog hands out.
 */
export function PlayOverlay({
  game,
  onClose,
}: {
  game: Game
  onClose: () => void
}) {
  const [playUrl, setPlayUrl] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const beats = useMemo(() => {
    // A build already running in this browser skips both steps. That is the
    // dev previewing their own game, which has nothing published to fetch.
    if (game.localBuildEntry) return PLAY_BEATS()

    // Scratch space handed from the checking beat to the booting one, made
    // here so it belongs to this sequence and dies with it. Not a ref: nothing
    // renders from it, and it exists only between two steps of one run.
    const held: { grant: AccessGrant | null } = { grant: null }

    return PLAY_BEATS({
      check: async () => {
        held.grant = await getDownload(game.id)
        if (!held.grant) throw new Error('You don’t own this one yet.')
      },
      boot: async (report) => {
        if (!held.grant) return
        setPlayUrl(await mountGrant(held.grant, report))
      },
    })
  }, [game.id, game.localBuildEntry])

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${game.title}`}
    >
      <LightsDown game={game} beats={beats} playUrl={playUrl} onExit={onClose} />
    </div>
  )
}
