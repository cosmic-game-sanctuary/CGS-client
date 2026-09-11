import { Button } from '@/components/ui/Button'
import { type WireTrial } from '@/api/trials'
import { formatAmount } from '@/lib/format'
import { signIn, useSession } from '@/auth/session'
import { useWalletSigner } from '@/auth/useWalletSigner'

/**
 * Try before you buy, under the buy button.
 *
 * A sibling to Buy rather than a page of its own, and secondary to it: the
 * default answer to a game you like is still to buy it.
 *
 * **The worst case is the headline, not the chunk price.** `chunkPrice ×
 * maxChunks` is what someone is really deciding about, because the fear a meter
 * creates is not knowing where it stops. The server refuses a config where that
 * ceiling exceeds the game's own price, so the promise on this button is
 * structural rather than marketing.
 *
 * Presentational only. The listing owns the `getTrial` fetch, because the buy
 * box and the checkout overlay need the same credit-adjusted price and a second
 * fetch here would be a second source that could disagree with them.
 *
 * The session itself is opened by the route, not from in here. Buying the game
 * mid-trial flips the buy box to its owned state, which would unmount this
 * component and take the running game with it.
 */
export function TrialPanel({
  trial,
  onTry,
}: {
  /** Null while it loads, or on a game with no trial. */
  trial: WireTrial | null
  onTry: (trial: WireTrial) => void
}) {
  const session = useSession()
  const signedIn = session.signedIn
  // Checkout's Pay button has always waited for this; this one didn't, and a
  // click landing before Privy's embedded wallet had finished connecting threw
  // straight out of `signHashes` with no server call to blame it on. Privy
  // lazily loads its signing iframe on first use, which is slow enough to hit
  // in the seconds right after a listing loads.
  const wallet = useWalletSigner()
  const connecting = signedIn && !wallet.ready

  if (!trial?.enabled) return null

  const spent = trial.creditUnits > 0

  return (
    <div className="mt-3 rounded-card border-2 border-ink bg-paper px-3.5 py-3">
      {spent ? (
        // Both numbers come from the server, and `owedUsd` is the one
        // `/download` will actually charge. Saying only "X comes off" left the
        // buy button above still reading as the full price, with nothing
        // anywhere stating what buying now costs.
        <p className="font-mono text-[11px] leading-relaxed text-green">
          <b className="tnum">{formatAmount(trial.creditUsd)}</b> of what you
          spent trying this comes off the price. It&rsquo;s{' '}
          <b className="tnum">{formatAmount(trial.owedUsd)}</b> for you now.
        </p>
      ) : (
        <p className="font-mono text-[11px] leading-relaxed text-ink-soft">
          Not sure? Play it {trial.chunkMinutes} minutes at a time. It never
          costs more than{' '}
          <b className="tnum text-ink">{formatAmount(trial.worstCaseUsd)}</b>{' '}
          altogether, and every cent comes off the price if you buy.
        </p>
      )}

      <Button
        variant="neutral"
        size="sm"
        className="mt-2.5 w-full"
        disabled={trial.chunksLeft <= 0 || connecting}
        onClick={() => (signedIn ? onTry(trial) : signIn())}
      >
        {trial.chunksLeft <= 0
          ? 'No trial time left'
          : connecting
            ? 'Connecting wallet…'
            : spent
              ? `Keep playing · ${formatAmount(trial.chunkPriceUsd ?? 0)}`
              : `Try it · ${formatAmount(trial.chunkPriceUsd ?? 0)} for ${trial.chunkMinutes} min`}
      </Button>
    </div>
  )
}
