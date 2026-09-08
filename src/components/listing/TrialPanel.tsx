import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { getTrial, type WireTrial } from '@/api/trials'
import { formatAmount } from '@/lib/format'
import { signIn, useSession } from '@/auth/session'

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
 * Nothing here subtracts credit from a price. `GET /download` does that, and a
 * second opinion computed on this side could only ever disagree with the one
 * that moves money.
 *
 * The session itself is opened by the route, not from in here. Buying the game
 * mid-trial flips the buy box to its owned state, which would unmount this
 * component and take the running game with it.
 */
export function TrialPanel({
  gameId,
  onTry,
}: {
  gameId: string
  onTry: (trial: WireTrial) => void
}) {
  const session = useSession()
  const [trial, setTrial] = useState<WireTrial | null>(null)

  const signedIn = session.signedIn

  useEffect(() => {
    const controller = new AbortController()
    getTrial(gameId, controller.signal)
      .then(setTrial)
      .catch(() => {
        // A game with no trial answers with everything zeroed rather than an
        // error, so a failure here is the network and not worth a hole.
      })
    return () => controller.abort()
    // `signedIn` matters: the config is public, but the numbers about you only
    // come back with a token.
  }, [gameId, signedIn])

  if (!trial?.enabled) return null

  const spent = trial.creditUnits > 0

  return (
    <div className="mt-3 rounded-card border-2 border-ink bg-paper px-3.5 py-3">
      {spent ? (
        <p className="font-mono text-[11px] leading-relaxed text-green">
          <b className="tnum">{formatAmount(trial.creditUsd)}</b> of what you
          spent trying this already comes off the price.
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
        disabled={trial.chunksLeft <= 0}
        onClick={() => (signedIn ? onTry(trial) : signIn())}
      >
        {trial.chunksLeft <= 0
          ? 'No trial time left'
          : spent
            ? `Keep playing · ${formatAmount(trial.chunkPriceUsd ?? 0)}`
            : `Try it · ${formatAmount(trial.chunkPriceUsd ?? 0)} for ${trial.chunkMinutes} min`}
      </Button>
    </div>
  )
}
