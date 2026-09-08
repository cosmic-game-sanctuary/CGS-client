import { useCountdown } from '@/lib/countdown'
import { formatAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { WirePromotion } from '@/api/promotions'

/**
 * A price with a deadline on it.
 *
 * The discount is the smaller half of this. Any store can show a lower number;
 * what makes someone act on it is knowing when it stops, and here the deadline
 * is not our word for it. Both the start and the end of every sale are written
 * to the public HCS topic with `endsAt` in the message, before the sale matters
 * to anyone, so a shopper who cares can check the clock against a ledger rather
 * than against us. That is the argument the split bar makes about money, made
 * about time instead.
 *
 * Red, because DESIGN.md rations it to money and urgency and this is both. It
 * is the one thing on a listing allowed to be loud.
 */
export function SaleBanner({
  promotion,
  className,
}: {
  promotion: WirePromotion
  className?: string
}) {
  const left = useCountdown(promotion.endsAt)

  // Over, but the listing has not been re-read yet. The price on screen is
  // about to go back up, so saying nothing is more honest than a dead clock.
  if (left === null) return null

  return (
    <div
      className={cn(
        'rounded-card border-2 border-ink bg-red px-4 py-3 text-paper shadow-hard',
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-wonk text-2xl leading-none">
          {promotion.percentOff}% off
        </span>
        <span className="font-mono tnum text-[13px] text-paper/80 line-through">
          {formatAmount(promotion.basePriceUsd)}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-paper/85">
        Back to {formatAmount(promotion.basePriceUsd)} in{' '}
        <b className="tnum text-paper">{left}</b>.
      </p>
    </div>
  )
}
