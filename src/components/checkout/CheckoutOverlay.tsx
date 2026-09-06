import { useEffect, useMemo, useRef, useState } from 'react'
import { PURCHASE_BEATS } from '@/components/play/beats'
import { LightsDown } from '@/components/play/LightsDown'
import { Freehand } from '@/components/icons/Freehand'
import { Button } from '@/components/ui/Button'
import { PriceChip } from '@/components/ui/PriceChip'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api'
import { buyGame, mountGrant, waitForKey, type AccessGrant } from '@/api/purchase'
import { useWalletSigner } from '@/auth/useWalletSigner'
import { fund, grantKey, signIn, useSession } from '@/auth/session'
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
 * as a spinner. The beats wait on the real payment now, so the shutter cannot
 * come up on a game that hasn't been bought.
 *
 * Real money from here down. The payment is an x402 settlement on Hedera,
 * signed by the buyer's own wallet in this tab. See `api/purchase.ts`.
 */

type Phase = 'signin' | 'funding' | 'confirm' | 'paying'

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
  const wallet = useWalletSigner()

  // Sticky, because it is the only step you can't leave. Everything before it
  // is derived from the session instead of stored, so signing in or funding in
  // another tab moves the panel on rather than stranding it on a step that is
  // already done. Holding `phase` in state is what made the panel sit on "sign
  // in" after Privy's modal had already signed you in.
  const [paying, setPaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [playUrl, setPlayUrl] = useState<string | null>(null)

  // Compared in integer units, never in dollars. A wallet holding exactly the
  // price of a game is where a float comparison decides wrong, and getting it
  // wrong means asking someone to top up a wallet that can already pay.
  const phase: Phase = paying
    ? 'paying'
    : !session.signedIn
      ? 'signin'
      : session.balanceUnits < game.priceUnits
        ? 'funding'
        : 'confirm'

  const timers = useRef<number[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  const lightsDown = phase === 'paying'
  const dismissable = !lightsDown

  const beats = useMemo(() => {
    // What paying produced, handed to the beat that boots it. Made here so it
    // belongs to this sequence: nothing renders from it, and it only has to
    // survive between two steps of one run.
    const held: { grant: AccessGrant | null } = { grant: null }

    return PURCHASE_BEATS({
      // The whole purchase: build the transfer, sign it here, settle it there.
      // The beat waits on this, so "Paying" lasts exactly as long as paying
      // does, and the shutter cannot come up on a game nobody bought.
      pay: async () => {
        held.grant = await buyGame(game.id, wallet.signHashes)
      },
      // Settlement has happened, so the buyer owns this whether or not the key
      // has minted. Say so locally now; the poll replaces it with the server's
      // answer when the GameKey lands, a few seconds later.
      minted: () => {
        grantKey(game.id)
        void waitForKey(game.id, () => grantKey(game.id))
      },
      boot: async (report) => {
        if (!held.grant) throw new Error('The purchase went through but the build didn’t.')
        setPlayUrl(await mountGrant(held.grant, report))
      },
    })
  }, [game.id, wallet.signHashes])

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

  // Privy owns the whole login flow, including which methods are offered, so
  // there is nothing to collect here first. The panel moves on by itself when
  // the session changes.
  function handleSignIn() {
    setProblem(null)
    signIn()
  }

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

  function handlePay() {
    setProblem(null)
    setPaying(true)
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
          // Hidden once the night layer covers it, so the wipe back up reveals
          // the page rather than a scrim.
          lightsDown && 'invisible',
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
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-5 w-full"
                  onClick={handleSignIn}
                >
                  Continue with email
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
                  onClick={() => void handleFund(topUp)}
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
                  disabled={!wallet.ready}
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

            {problem ? (
              <p
                role="alert"
                className="mt-4 rounded-card border-2 border-red bg-paper-sunk px-3.5 py-2.5 font-body text-sm leading-relaxed text-ink"
              >
                {problem}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Lights down: the shared store-to-play wipe. §5 */}
      <LightsDown
        game={game}
        beats={beats}
        active={lightsDown}
        playUrl={playUrl}
        onExit={onClose}
      />
    </div>
  )
}

