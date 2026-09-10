import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { LightsDown } from '@/components/play/LightsDown'
import { useCountdown } from '@/lib/countdown'
import { formatAmount } from '@/lib/format'
import { buildPathFor, mountBuildFromPath, buyGame } from '@/api/purchase'
import { buyChunk, getTrial, type WireTrial } from '@/api/trials'
import { errorMessage } from '@/lib/api'
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
 * The next chunk is bought **while the current one is still running**, so a
 * signature prompt never lands on top of someone mid-jump.
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
  /** When the paid-for time runs out. Extended by each chunk bought. */
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [owned, setOwned] = useState(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  /** Re-read the numbers after anything that spends money. */
  const refresh = useCallback(() => {
    getTrial(game.id)
      .then(setStatus)
      .catch(() => {
        // The meter going stale is not worth interrupting play for.
      })
  }, [game.id])

  const beats = useMemo<Beat[]>(() => {
    // Held between two steps of one run, so it belongs to this sequence and
    // dies with it. Same shape as the purchase path, same reason.
    const held: { minutes: number } = { minutes: trial.chunkMinutes }

    return [
      {
        label: `Buying ${trial.chunkMinutes} minutes`,
        ms: 750,
        work: async () => {
          console.info('[cgs trial] beat 1: buying a chunk')
          const bought = await buyChunk(game.id, signer.signHashes)
          held.minutes = bought.chunkMinutes || trial.chunkMinutes
          console.info('[cgs trial] beat 1 done, minutes =', held.minutes)
        },
      },
      {
        label: 'Unpacking the build',
        ms: 400,
        work: async (report) => {
          console.info('[cgs trial] beat 2: fetching + mounting the build')
          const url = await mountBuildFromPath(buildPathFor(game.id), report)
          console.info('[cgs trial] beat 2: mounted at', url)
          setPlayUrl(url)
          // Started when the build is actually in hand, not when the payment
          // settled: the minutes were sold as play, and a slow download is
          // ours to absorb rather than theirs to pay for.
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
        onExit={onClose}
        overlay={
          <TrialMeter
            game={game}
            status={status}
            expiresAt={expiresAt}
            owned={owned}
            onExtended={(until) => {
              setExpiresAt(until)
              refresh()
            }}
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

/**
 * The meter, in the corner of the running game.
 *
 * Not a modal, for the same reason checkout is an overlay rather than a route:
 * the game is running underneath and interrupting it is the one thing this
 * feature cannot afford to do.
 */
function TrialMeter({
  game,
  status,
  expiresAt,
  owned,
  onExtended,
  onBought,
  onClose,
}: {
  game: Game
  status: WireTrial
  expiresAt: string | null
  owned: boolean
  onExtended: (until: string) => void
  onBought: () => void
  onClose: () => void
}) {
  const signer = useWalletSigner()
  const left = useCountdown(expiresAt ?? '')
  const [busy, setBusy] = useState<'chunk' | 'buy' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  // Bought outright from in here. The meter has nothing left to say, and the
  // game keeps running underneath without so much as a reload.
  if (owned) {
    return (
      <div className="absolute top-3 left-3 z-10 rounded-card border-2 border-ink bg-green px-3 py-2 font-mono text-[11px] text-paper shadow-hard">
        Yours now. Play as long as you like.
      </div>
    )
  }

  const outOfTime = expiresAt !== null && left === null
  const running = expiresAt !== null && left !== null
  // Under a minute, which is when buying the next chunk stops being optional
  // and starts being urgent. Read off the string rather than a second clock:
  // anything without an `m` in it is seconds only.
  const low = left !== null && !left.includes('m')
  const chunkPrice = status.chunkPriceUsd ?? 0

  async function extend() {
    setBusy('chunk')
    setProblem(null)
    try {
      const bought = await buyChunk(game.id, signer.signHashes)
      const minutes = bought.chunkMinutes || status.chunkMinutes
      // Added to whatever is left rather than to now. They paid for the time
      // while still holding time, which is the whole point of buying early.
      const from = Math.max(Date.now(), new Date(expiresAt ?? '').getTime() || 0)
      onExtended(new Date(from + minutes * 60_000).toISOString())
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function buyOutright() {
    setBusy('buy')
    setProblem(null)
    try {
      // The ordinary purchase. `/download` subtracts what the trial already
      // paid, so this charges the difference with nothing here doing sums.
      await buyGame(game.id, signer.signHashes)
      onBought()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  // Time is up. The frame is still running underneath, so this covers it: the
  // clock is only ever kept by this page, and keeping it means saying no.
  if (outOfTime) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-night/95 px-6 text-center text-paper">
        <h2 className="text-2xl text-paper">That&rsquo;s your time.</h2>
        <p className="max-w-100 font-body text-sm leading-relaxed text-paper/70">
          {formatAmount(status.spentUsd)} spent so far, and all of it comes off
          the price.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="primary"
            disabled={busy !== null}
            onClick={() => void buyOutright()}
          >
            {busy === 'buy'
              ? 'Paying…'
              : `Buy it · ${formatAmount(Math.max(0, game.priceUsd - status.creditUsd))}`}
          </Button>
          {status.chunksLeft > 0 ? (
            <Button
              variant="neutral"
              disabled={busy !== null}
              onClick={() => void extend()}
            >
              {busy === 'chunk'
                ? 'Buying…'
                : `${status.chunkMinutes} more minutes · ${formatAmount(chunkPrice)}`}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            <span className="text-paper">Leave it</span>
          </Button>
        </div>
        {problem ? (
          <p role="alert" className="font-body text-sm text-red">
            {problem}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="absolute top-3 left-3 z-10 flex max-w-72 flex-col gap-2 rounded-card border-2 border-ink bg-paper/95 px-3.5 py-3 shadow-hard">
      {/* The clock leads. It is the thing someone in the middle of a game
          glances at, and it was previously a small number tucked beside a
          label, which is the wrong weighting for the one fact that changes. */}
      <div>
        <span className="label-micro block text-ink-soft">Time left</span>
        <span
          className={`tnum block font-mono text-2xl leading-none font-bold ${
            running && low ? 'text-red' : 'text-ink'
          }`}
        >
          {left ?? '—'}
        </span>
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-ink-soft">
        {formatAmount(status.creditUsd)} off the price so far
        {status.chunksLeft > 0
          ? ` · ${status.chunksLeft} more to buy`
          : ' · that was the last one'}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {status.chunksLeft > 0 ? (
          <Button
            size="sm"
            variant={low ? 'primary' : 'neutral'}
            disabled={busy !== null}
            onClick={() => void extend()}
          >
            {busy === 'chunk' ? 'Buying…' : `+${status.chunkMinutes}m · ${formatAmount(chunkPrice)}`}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="go"
          disabled={busy !== null}
          onClick={() => void buyOutright()}
        >
          {busy === 'buy'
            ? 'Paying…'
            : `Buy · ${formatAmount(Math.max(0, game.priceUsd - status.creditUsd))}`}
        </Button>
      </div>

      {problem ? (
        <p role="alert" className="font-mono text-[10px] text-red">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
