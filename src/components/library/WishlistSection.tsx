import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Cover } from '@/components/Cover'
import { PriceChip } from '@/components/ui/PriceChip'
import { getWishlist, type WireWishlistItem } from '@/api/wishlist'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Games you saved, and what has happened to their price since.
 *
 * Lives in the library rather than on a page of its own, for the same reason
 * the agents do: a saved game is a game you are trying to get, so it belongs
 * beside the ones you got. See CLAUDE.md §2.
 *
 * The comparison the list exists to make is price now against price when you
 * saved it, not price against some invented RRP. The server does that
 * arithmetic and sends `percentOff`, so nothing here can quietly disagree
 * with the number in the price-drop notification.
 */
export function WishlistSection({ signedIn }: { signedIn: boolean }) {
  const [items, setItems] = useState<WireWishlistItem[] | null>(null)
  const [onSale, setOnSale] = useState(0)

  useEffect(() => {
    if (!signedIn) return
    const controller = new AbortController()
    getWishlist(controller.signal)
      .then((list) => {
        setItems(list.items)
        setOnSale(list.onSale)
      })
      .catch(() => {
        // A wishlist that will not load is not worth an error state next to
        // the keys someone actually owns. It simply does not appear.
        if (!controller.signal.aborted) setItems([])
      })
    return () => controller.abort()
  }, [signedIn])

  if (!items || items.length === 0) return null

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl">Saved for later</h2>
        <span className="font-mono text-[11px] text-ink-soft">
          {onSale > 0
            ? `${onSale} cheaper than when you saved ${onSale === 1 ? 'it' : 'them'}`
            : `${items.length} game${items.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <ul className="print-rows mt-4 flex list-none flex-col gap-2.5 p-0">
        {items.map((item, i) => (
          <li key={item.game.id} style={{ '--i': i } as CSSProperties}>
            <Link
              to={`/game/${item.game.slug}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border-2 border-ink bg-paper px-4 py-3 no-underline shadow-hard-sm transition-transform duration-130 ease-out hover:-translate-y-px"
            >
              <Cover
                game={{
                  coverUrl: item.game.coverUrl ?? undefined,
                  coverSeed: item.game.coverSeed,
                  title: item.game.title,
                }}
                className="h-11 w-16 shrink-0 rounded-chip border-2 border-ink"
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate font-wonk text-[15px]">
                  {item.game.title}
                </span>
                <span className="block truncate font-mono text-[11px] text-ink-soft">
                  {!item.stillForSale
                    ? 'No longer for sale'
                    : item.percentOff > 0
                      ? `${item.percentOff}% off since you saved it, at ${formatPrice(item.savedAtUsd)}`
                      : item.agent
                        ? `An agent is watching this for you`
                        : `Saved at ${formatPrice(item.savedAtUsd)}`}
                </span>
              </span>

              {item.percentOff > 0 ? (
                <span className="label-micro rounded-chip border-2 border-ink bg-red px-2 py-0.5 text-paper">
                  −{item.percentOff}%
                </span>
              ) : null}

              <PriceChip
                usd={item.game.priceUsd}
                size="sm"
                className={cn(!item.stillForSale && 'opacity-50')}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
