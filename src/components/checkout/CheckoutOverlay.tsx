import { useEffect, useRef, useState } from 'react'
import { GameStage } from '@/components/GameStage'
import { Freehand } from '@/components/icons/Freehand'
import { Button } from '@/components/ui/Button'
import { PriceChip } from '@/components/ui/PriceChip'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { fund, grantKey, signIn, useSession } from '@/mocks/session'
import type { Game } from '@/mocks/types'

/**
 * Checkout → instant play. The critical path (CLAUDE.md §1, priority 1).
 *
 * It is an overlay, not a route, because the promise is "the game boots in the
 * same tab, seconds later" — a navigation would unmount the page and break
 * exactly the thing we're claiming.
 *
 * The lights-down wipe (DESIGN.md §5) starts the moment payment is submitted
 * and covers the settlement wait, so the latency reads as staging rather than
 * as a spinner. Beat timings come straight from the spec.
 *
 * No Privy, no chain, no x402 — every step is faked in `@/mocks/session`.
 * The seams are marked TODO(integration).
 */

type Phase =
  | 'signin'
  | 'funding'
  | 'confirm'
  | 'paying'
  | 'minting'
  | 'booting'
  | 'playing'

const BEATS: Record<'paying' | 'minting' | 'booting' | 'playing', string> = {
  paying: 'Paying',
  minting: 'Minting GameKey',
  booting: 'Booting build from IPFS',
  playing: 'Playing',
}

/** Top-up options, so nobody has to type an amount. */
function suggestedTopUp(shortfall: number) {
  return Math.max(5, Math.ceil(shortfall / 5) * 5)
}

export function CheckoutOverlay({
  game,
  onClose,
}: {
  game: Game
  onClose: () => void
}) {
  const session = useSession()

  const [phase, setPhase] = useState<Phase>(() => {
    if (!session.signedIn) return 'signin'
    if (session.balanceUsd < game.priceUsd) return 'funding'
    return 'confirm'
  })
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const timers = useRef<number[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  const isPlaying = phase === 'playing'
  const lightsDown =
    phase === 'paying' ||
    phase === 'minting' ||
    phase === 'booting' ||
    isPlaying
  const dismissable = !lightsDown

  // Clear any in-flight beat timers if the overlay goes away mid-sequence.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const id of pending) window.clearTimeout(id)
    }
  }, [])

  // Escape closes, but only before payment is submitted.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissable) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismissable, onClose])

  // Hold the page still behind the overlay.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  function after(ms: number, run: () => void) {
    timers.current.push(window.setTimeout(run, ms))
  }

  function handleSignIn() {
    if (!email.trim()) return
    setBusy(true)
    // TODO(integration): Privy email login, embedded wallet created on login.
    after(600, () => {
      signIn(email.trim())
      setBusy(false)
      setPhase(game.priceUsd > 0 ? 'funding' : 'confirm')
    })
  }

  function handleFund(amount: number) {
    setBusy(true)
    // TODO(integration): Privy's built-in funding flow.
    after(850, () => {
      fund(amount)
      setBusy(false)
      setPhase('confirm')
    })
  }

  function handlePay() {
    // TODO(integration): this is the x402 path — request the download, get a
    // 402 with payment requirements, sign, retry. Kai supplies the helper.
    setPhase('paying')
    after(750, () => setPhase('minting'))
    after(1400, () => {
      grantKey(game.id, game.priceUsd)
      setPhase('booting')
    })
    after(2100, () => setPhase('playing'))
  }

  const shortfall = Math.max(0, game.priceUsd - session.balanceUsd)
  const topUp = suggestedTopUp(shortfall)

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Buy ${game.title}`}
    >
      {/* Flat ink scrim — no blur anywhere in this language. §9 */}
      <button
        type="button"
        aria-label="Close checkout"
        tabIndex={dismissable ? 0 : -1}
        onClick={() => dismissable && onClose()}
        className={cn(
          'absolute inset-0 h-full w-full border-0 bg-ink/45',
          dismissable ? 'cursor-pointer' : 'cursor-default',
        )}
      />

      {/* The paper panel: sign in, fund, confirm. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cn(
            'animate-stamp pointer-events-auto w-full max-w-[440px] rounded-card border-[3px] border-ink bg-paper shadow-hard-lg outline-none',
            lightsDown && 'invisible',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper-sunk px-5 py-3">
            <span className="label-micro text-ink-soft">
              {phase === 'signin'
                ? 'Step 1 of 3 · sign in'
                : phase === 'funding'
                  ? 'Step 2 of 3 · add funds'
                  : 'Step 3 of 3 · confirm'}
            </span>
            <PriceChip usd={game.priceUsd} size="sm" />
          </div>

          <div className="px-5 py-5">
            {phase === 'signin' ? (
              <>
                <h2 className="text-2xl">Sign in to buy</h2>
                <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
                  Email only. We make the wallet for you, so there&rsquo;s no
                  extension to install and no phrase to write down.
                </p>
                <label
                  htmlFor="checkout-email"
                  className="label-micro mt-5 block text-ink-soft"
                >
                  Email
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleSignIn()}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-base text-ink outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
                />
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-4 w-full"
                  disabled={busy || !email.trim()}
                  onClick={handleSignIn}
                >
                  {busy ? 'Signing in…' : 'Continue'}
                </Button>
              </>
            ) : phase === 'funding' ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl">Add funds</h2>
                    <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
                      Your wallet is {formatPrice(shortfall)} short. Top it up
                      once and the rest of your buys are one tap.
                    </p>
                  </div>
                  <Freehand
                    name="money-wallet"
                    className="h-11 w-11 shrink-0 text-ink"
                  />
                </div>

                <dl className="mt-5 flex flex-col gap-1.5 rounded-card border-2 border-ink bg-paper-sunk px-4 py-3 font-mono text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Balance</dt>
                    <dd className="tnum">{formatPrice(session.balanceUsd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">{game.title}</dt>
                    <dd className="tnum">{formatPrice(game.priceUsd)}</dd>
                  </div>
                </dl>

                <Button
                  variant="go"
                  size="lg"
                  className="mt-4 w-full"
                  disabled={busy}
                  onClick={() => handleFund(topUp)}
                >
                  {busy ? 'Adding…' : `Add ${formatPrice(topUp)}`}
                </Button>
                <p className="mt-3 font-mono text-[11px] text-ink-soft">
                  Card or bank, handled by our payments partner.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl">{game.title}</h2>
                <p className="mt-2 font-body text-sm text-ink-soft">
                  by {game.studio.ens ?? game.studio.name}
                </p>

                <dl className="mt-5 flex flex-col gap-1.5 rounded-card border-2 border-ink bg-paper-sunk px-4 py-3 font-mono text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Price</dt>
                    <dd className="tnum">{formatPrice(game.priceUsd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Balance after</dt>
                    <dd className="tnum">
                      {formatPrice(session.balanceUsd - game.priceUsd)}
                    </dd>
                  </div>
                </dl>

                <Button
                  variant="primary"
                  size="lg"
                  className="mt-4 w-full"
                  onClick={handlePay}
                >
                  {game.priceUsd === 0
                    ? 'Get it and play'
                    : `Pay ${formatPrice(game.priceUsd)} and play`}
                </Button>
                <p className="mt-3 font-mono text-[11px] text-ink-soft">
                  All sales final. The key is yours to keep.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lights down: one clip-path wipe over the whole viewport. §5 */}
      <div
        aria-hidden={!lightsDown}
        className={cn(
          'absolute inset-0 bg-night transition-[clip-path] duration-600 ease-[cubic-bezier(.7,0,.2,1)]',
          lightsDown ? 'wipe-down' : 'wipe-up pointer-events-none',
        )}
      >
        {isPlaying ? (
          <GameStage game={game} onExit={onClose} />
        ) : (
          <BootSequence phase={phase} />
        )}
      </div>
    </div>
  )
}

const STEPS = ['paying', 'minting', 'booting'] as const

/** The beats that play behind the wipe while settlement happens. */
function BootSequence({ phase }: { phase: Phase }) {
  const label = BEATS[phase as keyof typeof BEATS] ?? ''
  const reached = STEPS.indexOf(phase as (typeof STEPS)[number])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-paper">
      <p aria-live="polite" className="label-micro min-h-4 text-paper/70">
        {label ? `${label}…` : ''}
      </p>

      {/* Three steps, filling as each completes. Progress, not a spinner. */}
      <div className="flex gap-2" aria-hidden>
        {STEPS.map((step, i) => (
          <span
            key={step}
            className={cn(
              'h-2 w-12 rounded-chip border-2 border-paper transition-colors duration-300',
              reached === -1 || reached > i ? 'bg-green' : 'bg-transparent',
            )}
          />
        ))}
      </div>
    </div>
  )
}
