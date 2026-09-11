import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { LightsDown } from '@/components/play/LightsDown'
import {
  FundingBody,
  GateShell,
  SignInBody,
} from '@/components/checkout/AccountGate'
import { useCountdown } from '@/lib/countdown'
import { gatePhaseFor } from '@/lib/gate'
import { cn } from '@/lib/utils'
import { formatAmount, formatPrice } from '@/lib/format'
import { buildPathFor, mountBuildFromPath, buyGame } from '@/api/purchase'
import { buyChunk, getTrial, type WireTrial } from '@/api/trials'
import { ApiError, errorMessage } from '@/lib/api'
import { fund, signIn, useSession } from '@/auth/session'
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
 *
 * Three components, in the order someone meets them. `TrialGate` is the
 * sign-in and funding ladder, skipped entirely by anyone already signed in
 * with money in the wallet. `RunningTrial` is the game and the meter.
 * `TrialOver` replaces the frame when the time is up, which is the only thing
 * that actually stops a cross-origin build.
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
  const session = useSession()
  // One chunk is the entry price, not the game's. Trying something for a
  // minute should not ask for the whole cover charge up front.
  const needUnits = trial.chunkPriceUnits ?? 0

  // Latched at mount, and only ever set forward. Someone already signed in
  // with money in the wallet pressed a button that said "Try it" and meant it,
  // so they go straight in. Everyone else climbs the ladder and presses start
  // at the top of it. It cannot be derived every render: the meter spends the
  // balance as they play, and a derived gate would slam shut mid-game and take
  // the running build with it.
  const [launched, setLaunched] = useState(
    () => gatePhaseFor(session, needUnits) === 'ready',
  )

  if (!launched) {
    return (
      <TrialGate
        game={game}
        trial={trial}
        needUnits={needUnits}
        onStart={() => setLaunched(true)}
        onClose={onClose}
      />
    )
  }

  return (
    <RunningTrial
      game={game}
      trial={trial}
      onClose={onClose}
      onBought={onBought}
    />
  )
}

/**
 * Sign in, then put something in the wallet, then start.
 *
 * The same two panels checkout uses, because they are the same two questions
 * and there is no reason for a person to meet two different versions of them.
 * Pressing "Try it" signed out used to drop straight into Privy's modal with
 * nothing of ours in front of it, and pressing it with an empty wallet started
 * a session whose very first charge could only fail, after the build had
 * downloaded and the shutter had come up.
 */
function TrialGate({
  game,
  trial,
  needUnits,
  onStart,
  onClose,
}: {
  game: Game
  trial: WireTrial
  needUnits: number
  onStart: () => void
  onClose: () => void
}) {
  const session = useSession()
  const wallet = useWalletSigner()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const phase = gatePhaseFor(session, needUnits)
  const chunkUsd = trial.chunkPriceUsd ?? 0
  const shortfall = Math.max(0, chunkUsd - session.balanceUsd)

  async function handleFund(amount: number) {
    setBusy(true)
    setProblem(null)
    try {
      // TODO(integration): Privy's own funding UI replaces the dev faucet
      // before any deploy. Same call site either way.
      await fund(amount)
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Try ${game.title}`}
    >
      <GateShell
        title="this trial"
        step={
          phase === 'signin'
            ? 'Step 1 of 2 · sign in'
            : phase === 'funding'
              ? 'Step 2 of 2 · add funds'
              : 'Ready when you are'
        }
        priceUsd={chunkUsd}
        problem={problem}
        onClose={onClose}
      >
        {phase === 'signin' ? (
          <SignInBody
            heading="Sign in to try it"
            onSignIn={() => {
              setProblem(null)
              signIn()
            }}
          />
        ) : phase === 'funding' ? (
          <FundingBody
            shortfallUsd={shortfall}
            lines={[
              { label: 'Balance', value: formatPrice(session.balanceUsd) },
              {
                label: `${trial.chunkMinutes} minutes`,
                value: formatAmount(chunkUsd),
              },
              {
                label: 'Never more than',
                value: formatAmount(trial.worstCaseUsd),
              },
            ]}
            busy={busy}
            onFund={(amount) => void handleFund(amount)}
          />
        ) : (
          <>
            <h2 className="text-2xl">{game.title}</h2>
            <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
              {trial.chunkMinutes} minutes at a time, bought as you play. Stop
              whenever you like and nothing more is charged.
            </p>

            <dl className="mt-5 flex flex-col gap-1.5 rounded-card border-2 border-ink bg-paper-sunk px-4 py-3 font-mono text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">
                  First {trial.chunkMinutes} minutes
                </dt>
                <dd className="tnum">{formatAmount(chunkUsd)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Never more than</dt>
                <dd className="tnum">{formatAmount(trial.worstCaseUsd)}</dd>
              </div>
              <div className="flex justify-between text-green">
                <dt>Comes off the price</dt>
                <dd className="tnum">all of it</dd>
              </div>
            </dl>

            <Button
              variant="primary"
              size="lg"
              className="mt-4 w-full"
              disabled={!wallet.ready}
              onClick={onStart}
            >
              {wallet.ready
                ? `Start playing · ${formatAmount(chunkUsd)}`
                : 'Connecting wallet…'}
            </Button>
            <p className="mt-3 font-mono text-[11px] text-ink-soft">
              Every cent comes off the price if you buy it.
            </p>
          </>
        )}
      </GateShell>
    </div>
  )
}

/**
 * The trial itself, once there is an account with money in it.
 *
 * Mounted only when that is true, so the first beat's payment has something to
 * pay with, and never unmounted for a balance that drops as the meter spends
 * it.
 */
function RunningTrial({
  game,
  trial,
  onClose,
  onBought,
}: {
  game: Game
  trial: WireTrial
  onClose: () => void
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

  /**
   * One clock for the session, read here rather than inside the meter.
   *
   * Running out of time is not a thing the meter can decide on its own any
   * more: it changes what is rendered in the frame's place, so the component
   * that owns the frame has to be the one that knows.
   */
  const left = useCountdown(expiresAt ?? '')
  const outOfTime = expiresAt !== null && left === null && !owned

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
          outOfTime ? undefined : (
            <TrialMeter
              status={status}
              left={left}
              metering={meter.running}
              meterError={meter.error}
              owned={owned}
              onRetry={meter.retry}
              onClose={onClose}
            />
          )
        }
        takeover={
          outOfTime ? (
            <TrialOver
              game={game}
              status={status}
              meterError={meter.error}
              onRetry={meter.retry}
              onBought={() => {
                setOwned(true)
                onBought()
              }}
              onClose={onClose}
            />
          ) : undefined
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
 *
 * The clock comes in as a prop. It used to be read here, which meant the only
 * thing that knew the trial had ended was a chip drawn *over* the game, and
 * all a chip can do is cover something. See `TrialOver`.
 */
function TrialMeter({
  status,
  left,
  metering,
  meterError,
  owned,
  onRetry,
  onClose,
}: {
  status: WireTrial
  /** Time left as text, or null once the deadline has passed. */
  left: string | null
  metering: boolean
  meterError: string | null
  owned: boolean
  onRetry: () => void
  onClose: () => void
}) {
  // Bought outright. The only way here is through `TrialOver`, which means the
  // frame was unmounted and has just come back, so the game has restarted and
  // the copy says so rather than letting that look like a glitch.
  if (owned) {
    return (
      <div className="absolute top-3 left-3 z-10 max-w-56 rounded-card border-2 border-ink bg-green px-2.5 py-1.5 font-mono text-[10px] leading-snug text-paper shadow-hard">
        Yours now. It starts again from the top, and you can play as long as
        you like.
      </div>
    )
  }

  // Under a minute. Read off the string rather than a second clock: anything
  // without an `m` in it is seconds only.
  const low = left !== null && !left.includes('m')

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
              low ? 'text-red' : 'text-ink',
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

/**
 * Time is up.
 *
 * Rendered **in place of** the build, not over it. That is the whole point:
 * this used to be an overlay, and an overlay cannot stop a game. The frame
 * kept running behind it, audio and all, while the screen in front said the
 * trial had ended. A cross-origin build has no pause to call, so unmounting it
 * is the only thing that actually stops it, and stopping it is what keeping
 * the deal means.
 *
 * It is also the one place buying belongs. On the running meter it would be a
 * money button beside a game somebody is playing; here it is a decision they
 * are actually being asked to make.
 */
function TrialOver({
  game,
  status,
  meterError,
  onRetry,
  onBought,
  onClose,
}: {
  game: Game
  status: WireTrial
  meterError: string | null
  onRetry: () => void
  onBought: () => void
  onClose: () => void
}) {
  const signer = useWalletSigner()
  const [buying, setBuying] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // The meter halting on an error while chunks remain is a different ending
  // from running out of them, and only the first is worth offering to resume.
  const stoppedEarly = meterError !== null && status.chunksLeft > 0
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

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-night px-6 text-center text-paper">
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
