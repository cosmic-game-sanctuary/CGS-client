import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { LightsDown } from '@/components/play/LightsDown'
import { useCountdown } from '@/lib/countdown'
import { cn } from '@/lib/utils'
import { formatAmount } from '@/lib/format'
import { buildPathFor, mountBuildFromPath, buyGame } from '@/api/purchase'
import { buyChunk, getTrial, type WireTrial } from '@/api/trials'
import { ApiError, errorMessage } from '@/lib/api'
import { useWalletSigner } from '@/auth/useWalletSigner'
import type { Beat } from '@/components/play/beats'
import type { Game } from '@/mocks/types'

/**
 * Trying a game by the minute.
 *
 * The pitch is that this is not a demo: it is the real build, on the real
 * isolated origin, booted the same way a purchase boots it. The only
 * difference is what was paid for, which is time rather than ownership.
 *
 * **The clock is honoured, not enforced, and that is deliberate on both
 * sides.** The build is unpacked into the browser, so whoever holds it holds
 * it; the server says as much. Which makes this component the place the deal
 * is actually kept: when the time runs out, the frame goes. Pretending
 * otherwise would be theatre, and pretending the server enforced it would be
 * a lie about what was bought.
 *
 * **Metering runs itself, and there is nothing to press.** `useMeteredPlay`
 * buys the next chunk shortly before the current one ends, each a real x402
 * payment signed silently by the player's own embedded wallet. Playing is
 * paying; the only decision left is when to stop, so Leave is the only button
 * on the meter. Buying the game is offered when the trial ends, where it is
 * an actual choice rather than a thing to fumble mid-jump.
 *
 * Leaving unmounts this component and the loop dies with it, so nothing is
 * ever charged for time nobody is playing. This is the consumer side of the
 * same metered-x402 pattern the wishlist agent uses to pay for its own
 * reasoning; the difference is only whose wallet it is.
 */
export function TrialSession({
  game,
  trial,
  onClose,
  onBought,
}: {
  game: Game
  /** Read before opening, so the first chunk is known to be available. */
  trial: WireTrial
  onClose: () => void
  /** They bought the game outright from inside the trial. */
  onBought: () => void
}) {
  const signer = useWalletSigner()
  const [playUrl, setPlayUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<WireTrial>(trial)
  /** When the paid-for time runs out. Extended by each chunk the meter buys. */
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [owned, setOwned] = useState(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  /**
   * Re-read the numbers after anything that spends money.
   *
   * Every figure on the meter comes from here rather than being added up as it
   * goes. An optimistic total plus a server total that arrives a moment later
   * is two sources for one number, and they disagree exactly when a charge is
   * in flight, which is the moment someone is most likely to be looking.
   */
  const refresh = useCallback(() => {
    getTrial(game.id)
      .then(setStatus)
      .catch(() => {
        // The meter going stale is not worth interrupting play for.
      })
  }, [game.id])

  const meter = useMeteredPlay({
    gameId: game.id,
    trial,
    signHashes: signer.signHashes,
    expiresAt,
    chunksLeft: status.chunksLeft,
    stopped: owned,
    onChunk: (minutes) => {
      setExpiresAt((prev) => {
        // Added to whatever is left rather than to now. The chunk was bought
        // while time remained, and that head start is the point of buying it
        // early rather than at zero.
        const from = Math.max(Date.now(), new Date(prev ?? '').getTime() || 0)
        return new Date(from + minutes * 60_000).toISOString()
      })
      refresh()
    },
  })

  const beats = useMemo<Beat[]>(() => {
    // Held between two steps of one run, so it belongs to this sequence and
    // dies with it. Same shape as the purchase path, same reason.
    const held: { minutes: number } = { minutes: trial.chunkMinutes }

    return [
      {
        label: `Buying ${trial.chunkMinutes} minutes`,
        ms: 750,
        work: async () => {
          const bought = await buyChunk(game.id, signer.signHashes)
          held.minutes = bought.chunkMinutes || trial.chunkMinutes
        },
      },
      {
        label: 'Unpacking the build',
        ms: 400,
        work: async (report) => {
          const url = await mountBuildFromPath(buildPathFor(game.id), report)
          setPlayUrl(url)
          // Started when the build is actually in hand, not when the payment
          // settled: the minutes were sold as play, and a slow download is
          // ours to absorb rather than theirs to pay for. The meter takes
          // over from here.
          setExpiresAt(new Date(Date.now() + held.minutes * 60_000).toISOString())
          refresh()
        },
      },
    ]
    // Built once, from the game alone. A beat's own work changes what this
    // renders, and a sequence that can restart is a sequence that can charge
    // twice. See LightsDown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id])

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Trying ${game.title}`}
    >
      <LightsDown
        game={game}
        beats={beats}
        playUrl={playUrl}
        trial
        onExit={onClose}
        overlay={
          <TrialMeter
            game={game}
            status={status}
            expiresAt={expiresAt}
            metering={meter.running}
            meterError={meter.error}
            owned={owned}
            onRetry={meter.retry}
            onBought={() => {
              setOwned(true)
              onBought()
            }}
            onClose={onClose}
          />
        }
      />
    </div>
  )
}

/** 429 and a dead network are worth waiting out. Nothing else is. */
function worthRetrying(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 429 || error.status === 0
}

/**
 * The meter loop.
 *
 * One long-lived loop for the life of a running trial: every few seconds it
 * looks at how much paid time is left, and once that drops below a floor it
 * buys the next chunk. `buyChunk` is prepare / sign / settle, exactly as a
 * purchase is, and the signature is silent because it is the player's own
 * embedded wallet.
 *
 * **A refusal is not always the end.** A rate limit or a dropped connection
 * says nothing about whether the player can still pay, so those back off and
 * try again, doubling the wait each time. Anything else — an empty wallet, the
 * chunk cap — halts the loop, because retrying it on a timer would spend the
 * time someone paid for on requests that cannot succeed.
 *
 * Unmounting kills it. That is the whole guarantee that leaving stops the
 * charges: there is no server-side timer to cancel, because there is no
 * server-side loop.
 */
function useMeteredPlay({
  gameId,
  trial,
  signHashes,
  expiresAt,
  chunksLeft,
  stopped,
  onChunk,
}: {
  gameId: string
  trial: WireTrial
  signHashes: (h: string[]) => Promise<{ hash: string; signature: string }[]>
  expiresAt: string | null
  chunksLeft: number
  stopped: boolean
  onChunk: (minutes: number) => void
}) {
  // `halted` is the meter stopping itself — the cap reached, or a charge that
  // cannot be retried. `stopped` is the caller stopping it (bought outright).
  // Running is neither, derived rather than synced so nothing has to setState
  // in an effect to keep it true.
  const [halted, setHalted] = useState<null | 'cap' | 'error'>(null)
  const [error, setError] = useState<string | null>(null)
  const running = !stopped && halted === null

  // The loop reads these through refs so it can be a single long-lived effect
  // rather than one that tears down and restarts every time the clock moves.
  const expiryRef = useRef(expiresAt)
  const chunksLeftRef = useRef(chunksLeft)
  const onChunkRef = useRef(onChunk)
  useEffect(() => {
    expiryRef.current = expiresAt
  }, [expiresAt])
  useEffect(() => {
    chunksLeftRef.current = chunksLeft
  }, [chunksLeft])
  useEffect(() => {
    onChunkRef.current = onChunk
  }, [onChunk])

  useEffect(() => {
    if (!running) return

    // Buy the next chunk this long before the current one ends. A chunk's
    // prepare / sign / settle has been seen to take ~15s on a cold path, and
    // a retry after a rate limit needs room on top of that.
    const TOP_UP_AT_MS = 30_000
    const POLL_MS = 4_000
    const BACKOFF_MS = [5_000, 15_000, 40_000]

    let stop = false
    let timer: number | undefined
    let attempt = 0

    const loop = async () => {
      if (stop) return
      const exp = expiryRef.current

      if (exp) {
        // The cap is a stopping point, not a failure. The chunk already paid
        // for keeps running; the takeover lands when it actually expires.
        if (chunksLeftRef.current <= 0) {
          setHalted('cap')
          return
        }
        if (new Date(exp).getTime() - Date.now() <= TOP_UP_AT_MS) {
          try {
            const bought = await buyChunk(gameId, signHashes)
            if (stop) return
            attempt = 0
            setError(null)
            onChunkRef.current(bought.chunkMinutes || trial.chunkMinutes)
          } catch (err) {
            if (stop) return
            if (worthRetrying(err) && attempt < BACKOFF_MS.length) {
              const wait = BACKOFF_MS[attempt]
              attempt += 1
              setError(null)
              timer = window.setTimeout(loop, wait)
              return
            }
            setError(errorMessage(err))
            setHalted('error')
            return
          }
        }
      }
      timer = window.setTimeout(loop, POLL_MS)
    }

    void loop()
    return () => {
      stop = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [running, gameId, signHashes, trial.chunkMinutes])

  const retry = useCallback(() => {
    setError(null)
    setHalted(null)
  }, [])

  return { running, error, retry }
}

/**
 * The meter, in the corner of the running game.
 *
 * Not a modal, for the same reason checkout is an overlay rather than a route:
 * the game is running underneath and interrupting it is the one thing this
 * feature cannot afford to do. So it is deliberately small and carries only
 * what someone glancing away from a game can read: the clock, the running
 * total, and the way out.
 *
 * **No buy button here.** Playing already spends money and the meter already
 * says so; a second money button beside a running game is a misclick waiting
 * to happen, and buying is offered properly when the time is up. It lifts on
 * hover the way every other solid thing in the app does (DESIGN.md §4, Press)
 * rather than scaling as a flat box would.
 */
function TrialMeter({
  game,
  status,
  expiresAt,
  metering,
  meterError,
  owned,
  onRetry,
  onBought,
  onClose,
}: {
  game: Game
  status: WireTrial
  expiresAt: string | null
  metering: boolean
  meterError: string | null
  owned: boolean
  onRetry: () => void
  onBought: () => void
  onClose: () => void
}) {
  const signer = useWalletSigner()
  const left = useCountdown(expiresAt ?? '')
  const [buying, setBuying] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Bought outright from in here. The meter has nothing left to say, and the
  // game keeps running underneath without so much as a reload.
  if (owned) {
    return (
      <div className="absolute top-3 left-3 z-10 rounded-card border-2 border-ink bg-green px-2.5 py-1.5 font-mono text-[10px] text-paper shadow-hard">
        Yours now. Play as long as you like.
      </div>
    )
  }

  const outOfTime = expiresAt !== null && left === null
  const running = expiresAt !== null && left !== null
  // Under a minute. Read off the string rather than a second clock: anything
  // without an `m` in it is seconds only.
  const low = left !== null && !left.includes('m')
  // The server's figure, never `price - credit` worked out here. See WireTrial.
  const owedUsd = status.owedUsd

  async function buyOutright() {
    setBuying(true)
    setProblem(null)
    try {
      // The ordinary purchase. `/download` subtracts what the trial already
      // paid, so this charges the difference with nothing here doing sums.
      await buyGame(game.id, signer.signHashes)
      onBought()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBuying(false)
    }
  }

  // Time is up. The frame is still running underneath, so this covers it: the
  // clock is only ever kept by this page, and keeping it means saying no. This
  // is also the one place buying belongs, because it is now a decision someone
  // is actually being asked to make rather than a button beside a game.
  if (outOfTime) {
    const stoppedEarly = meterError !== null && status.chunksLeft > 0
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-night/95 px-6 text-center text-paper">
        <h2 className="text-2xl text-paper">That&rsquo;s your time.</h2>
        <p className="max-w-100 font-body text-sm leading-relaxed text-paper/70">
          {formatAmount(status.spentUsd)} spent, and all of it comes off the
          price.
        </p>
        {meterError ? (
          <p role="alert" className="max-w-100 font-body text-sm text-red">
            {meterError}
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="max-w-100 font-body text-sm text-red">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="primary"
            disabled={buying}
            onClick={() => void buyOutright()}
          >
            {buying ? 'Paying…' : `Buy it · ${formatAmount(owedUsd)}`}
          </Button>
          {stoppedEarly ? (
            <Button variant="neutral" disabled={buying} onClick={onRetry}>
              Keep playing
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            <span className="text-paper">Leave it</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-3 left-3 z-10 flex max-w-56 flex-col gap-1.5 rounded-card border-2 border-ink bg-paper/95 px-2.5 py-2 shadow-hard transition-transform duration-130 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-lg">
      <div className="flex items-start gap-3">
        <div>
          <span className="label-micro block text-[9px] text-ink-soft">
            Time left
          </span>
          <span
            className={cn(
              'tnum block font-mono text-base leading-tight font-bold',
              running && low ? 'text-red' : 'text-ink',
            )}
          >
            {left ?? '—'}
          </span>
        </div>
        <div>
          <span className="label-micro block text-[9px] text-ink-soft">
            Paid so far
          </span>
          <span className="tnum block font-mono text-base leading-tight font-bold text-ink">
            {formatAmount(status.spentUsd)}
          </span>
        </div>
      </div>

      <p className="font-mono text-[9px] leading-snug text-ink-soft">
        {metering
          ? 'Buying as you play. It all comes off the price.'
          : status.chunksLeft > 0
            ? 'Paused. What you spent comes off the price.'
            : 'Last of your trial time.'}
      </p>

      {meterError ? (
        <p role="alert" className="font-mono text-[9px] leading-snug text-red">
          {meterError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="neutral" onClick={onClose}>
          Leave
        </Button>
        {meterError && status.chunksLeft > 0 ? (
          <Button size="sm" variant="neutral" onClick={onRetry}>
            Keep playing
          </Button>
        ) : null}
      </div>
    </div>
  )
}
