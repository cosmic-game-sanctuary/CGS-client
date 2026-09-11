import { useEffect, useMemo, useRef, useState } from 'react'
import { PURCHASE_BEATS } from '@/components/play/beats'
import { LightsDown } from '@/components/play/LightsDown'
import {
  FundingBody,
  GateShell,
  SignInBody,
} from '@/components/checkout/AccountGate'
import { gatePhaseFor } from '@/lib/gate'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/format'
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

export function CheckoutOverlay({
  game,
  owedUnits,
  owedUsd,
  onClose,
}: {
  game: Game
  /**
   * What this buyer actually pays, with any trial credit already off — the
   * server's figure, the same one `/download` charges. Defaults to the list
   * price. Everything money-related here reads this, not `game.price*`, or the
   * funding step asks for a top-up the purchase does not need and the button
   * quotes a number the buyer is never charged.
   */
  owedUnits?: number
  owedUsd?: number
  onClose: () => void
}) {
  const session = useSession()
  const wallet = useWalletSigner()

  const oweUnits = owedUnits ?? game.priceUnits
  const oweUsd = owedUsd ?? game.priceUsd
  const creditUsd = Math.max(0, game.priceUsd - oweUsd)

  // Sticky, because it is the only step you can't leave. Everything before it
  // is derived from the session instead of stored, so signing in or funding in
  // another tab moves the panel on rather than stranding it on a step that is
  // already done. Holding `phase` in state is what made the panel sit on "sign
  // in" after Privy's modal had already signed you in.
  const [paying, setPaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [playUrl, setPlayUrl] = useState<string | null>(null)

  // The sign-in and funding steps are the shared ladder every money screen
  // climbs. See AccountGate: the trial uses the same two, with a chunk's price
  // in place of the game's.
  const gate = gatePhaseFor(session, oweUnits)
  const phase: Phase = paying ? 'paying' : gate === 'ready' ? 'confirm' : gate

  const timers = useRef<number[]>([])

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

  const shortfall = Math.max(0, oweUsd - session.balanceUsd)

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Buy ${game.title}`}
    >
      <GateShell
        title="checkout"
        step={
          phase === 'signin'
            ? 'Step 1 of 3 · sign in'
            : phase === 'funding'
              ? 'Step 2 of 3 · add funds'
              : 'Step 3 of 3 · confirm'
        }
        priceUsd={oweUsd}
        hidden={lightsDown}
        dismissable={dismissable}
        problem={problem}
        onClose={onClose}
      >
        {phase === 'signin' ? (
          <SignInBody heading="Sign in to buy" onSignIn={handleSignIn} />
        ) : phase === 'funding' ? (
          <FundingBody
            shortfallUsd={shortfall}
            lines={[
              { label: 'Balance', value: formatPrice(session.balanceUsd) },
              { label: game.title, value: formatPrice(game.priceUsd) },
              ...(creditUsd > 0
                ? [
                    {
                      label: 'Trial credit',
                      value: `-${formatPrice(creditUsd)}`,
                      tone: 'green' as const,
                    },
                  ]
                : []),
            ]}
            busy={busy}
            onFund={(amount) => void handleFund(amount)}
          />
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
              {creditUsd > 0 ? (
                <div className="flex justify-between text-green">
                  <dt>Trial credit</dt>
                  <dd className="tnum">-{formatPrice(creditUsd)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-ink-soft">Balance after</dt>
                <dd className="tnum">
                  {formatPrice(session.balanceUsd - oweUsd)}
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
              {oweUsd === 0
                ? 'Get it and play'
                : `Pay ${formatPrice(oweUsd)} and play`}
            </Button>
            <p className="mt-3 font-mono text-[11px] text-ink-soft">
              All sales final. The key is yours to keep.
            </p>
          </>
        )}
      </GateShell>

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

