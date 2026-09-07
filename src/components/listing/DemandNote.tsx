import { useEffect, useState } from 'react'
import { getDemand, type WireDemand } from '@/api/wishlist'

/**
 * How many people are waiting for this game, and where to check it.
 *
 * Every storefront knows this number. None of them publish it — Steam treats
 * wishlist counts as one of its most valuable private datasets. Here the count
 * is written to a public topic each time it crosses a milestone, so a visitor
 * can read it on the Mirror Node without believing anything we say.
 *
 * One sentence, and no plumbing. The milestone and the topic id were on screen
 * here and they are the wrong audience: a shopper does not want a topic id, and
 * anyone who does want to verify the number is reading the docs, not a buy box.
 */
export function DemandNote({ gameId }: { gameId: string }) {
  const [demand, setDemand] = useState<WireDemand | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getDemand(gameId, controller.signal)
      .then(setDemand)
      .catch(() => {
        // A count that will not load is not worth a hole on the page.
      })
    return () => controller.abort()
  }, [gameId])

  if (!demand || demand.wishlistCount === 0) return null

  return (
    <p className="mt-3 border-t-2 border-paper-deep pt-3 font-mono text-[11px] leading-relaxed text-ink-soft">
      <b className="tnum text-ink">{demand.wishlistCount}</b>{' '}
      {demand.wishlistCount === 1 ? 'person is' : 'people are'} waiting for this.
    </p>
  )
}
