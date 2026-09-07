import { useEffect, useState, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getPurchases, type WirePurchase } from '@/api/profiles'
import { formatDate, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * What you paid, and the transaction that proves it.
 *
 * The settlement id is the point. Every other storefront's order history is a
 * row in a database you have to take on faith; this one names a transaction
 * anyone can look up on the Mirror Node, including after we are gone. That is
 * the difference the whole product is arguing for, made concrete on the one
 * screen where a buyer would go looking for it.
 *
 * Collapsed by default. It is a reference, not something to read.
 */
export function Receipts({ signedIn }: { signedIn: boolean }) {
  const [rows, setRows] = useState<WirePurchase[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!signedIn || !open || rows !== null) return
    const controller = new AbortController()
    getPurchases(controller.signal)
      .then(setRows)
      .catch(() => {
        if (!controller.signal.aborted) setRows([])
      })
    return () => controller.abort()
  }, [signedIn, open, rows])

  if (!signedIn) return null

  return (
    <section className="mt-12">
      {/* A heading that happens to be clickable reads as a heading. This is a
          control that looks like one: a border, a chevron, and a hit area the
          whole width of the row. */}
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 rounded-card border-2 border-ink bg-paper-sunk px-5 py-3.5 text-left shadow-hard-sm transition-transform duration-130 ease-out hover:-translate-y-px"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-2xl leading-tight font-wonk">Receipts</span>
          <span className="block font-body text-sm text-ink-soft">
            Every purchase, with the transaction that settled it.
          </span>
        </span>
        <span className="label-micro shrink-0 text-ink-soft">
          {open ? 'Hide' : 'Show'}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2.5}
          className={cn(
            'shrink-0 transition-transform duration-130',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        rows === null ? (
          <div className="hatch mt-4 h-20 rounded-card border-2 border-ink" />
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-card border-2 border-dashed border-ink-faint px-5 py-6 font-body text-sm text-ink-soft">
            Nothing bought yet.
          </p>
        ) : (
          <ul className="print-rows mt-4 flex list-none flex-col gap-2 p-0">
            {rows.map((row, i) => (
              <li
                key={row.id}
                style={{ '--i': i } as CSSProperties}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card border-2 border-ink bg-paper px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  {row.game ? (
                    <Link
                      to={`/game/${row.game.slug}`}
                      className="block truncate font-wonk text-[15px] no-underline hover:underline"
                    >
                      {row.game.title}
                    </Link>
                  ) : (
                    <span className="block truncate font-wonk text-[15px] text-ink-soft">
                      A game that has since been removed
                    </span>
                  )}
                  <span className="block truncate font-mono text-[11px] text-ink-faint">
                    {row.settlementTxId}
                  </span>
                </span>

                {row.key?.serial ? (
                  <span className="label-micro rounded-chip border-2 border-ink bg-paper-sunk px-2 py-0.5 text-ink-soft">
                    key #{row.key.serial}
                  </span>
                ) : null}

                <span className="font-mono text-[11px] text-ink-soft">
                  {formatDate(row.at)}
                </span>
                <span className="tnum font-mono text-[15px] font-bold">
                  {formatPrice(row.priceUsd)}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  )
}
