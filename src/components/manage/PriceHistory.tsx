import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/format'
import type { WirePricePoint } from '@/api/manage'

/**
 * Every price change this game has had, and the transaction that announced it.
 *
 * A row is a change, not a price: `fromUnits` to `toUnits`. That is both what
 * the server stores and the more useful thing to read — "three dollars to one
 * fifty" says something "one fifty" alone does not.
 *
 * The transaction id is what makes this different from a price history on any
 * other storefront. There it is a number a shop chooses to show you; here every
 * row names a message on a public topic that a visitor can read on the Mirror
 * Node without trusting us at all.
 */
export function PriceHistory({
  history,
  decimals,
}: {
  history: WirePricePoint[]
  /** Of the price asset. The rows carry integer units only. */
  decimals: number
}) {
  if (history.length === 0) return null

  const usd = (units: number) => units / 10 ** decimals

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl">Price history</h2>
        <span className="font-mono text-[11px] text-ink-soft">
          every change is on the public record
        </span>
      </div>

      <ul className="print-rows mt-4 flex list-none flex-col gap-2 p-0">
        {history.map((point, i) => {
          const cheaper = point.toUnits < point.fromUnits
          return (
            <li
              key={`${point.at}-${point.toUnits}-${i}`}
              style={{ '--i': i } as CSSProperties}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-card border-2 border-ink bg-paper px-4 py-2.5"
            >
              <span className="tnum font-mono text-[13px] text-ink-soft line-through">
                {formatPrice(usd(point.fromUnits))}
              </span>
              <ArrowRight size={12} strokeWidth={3} className="text-ink-faint" />
              <span
                className={`tnum font-mono text-[15px] font-bold ${cheaper ? 'text-green' : ''}`}
              >
                {formatPrice(usd(point.toUnits))}
              </span>
              <span className="font-mono text-[11px] text-ink-soft">
                {formatDate(point.at)}
              </span>
              {point.hcsTxId ? (
                <span
                  className="ml-auto min-w-0 truncate font-mono text-[11px] text-ink-faint"
                  title={point.hcsTxId}
                >
                  {point.hcsTxId}
                </span>
              ) : (
                <span className="ml-auto font-mono text-[11px] text-ink-faint">
                  not announced
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
