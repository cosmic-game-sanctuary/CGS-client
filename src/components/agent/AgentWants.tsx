import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ButtonLink } from '@/components/ui/Button'
import { getWishlist, setWant, type WireWishlistItem } from '@/api/wishlist'
import { getLibrary } from '@/api/library'
import { errorMessage } from '@/lib/api'
import { formatAmount } from '@/lib/format'

/**
 * What the agent is trying to buy, and the most it may pay for each.
 *
 * **This is the wishlist with a filter on it**, not a second list. A want is a
 * saved game with a ceiling attached, so un-saving a game takes the want with
 * it and there is only ever one list that can be out of date.
 *
 * Games saved *without* a ceiling are shown underneath rather than hidden.
 * Having an agent and still keeping some games as ordinary saves is a normal
 * thing to want, and the row is one press from becoming a want.
 */
export function AgentWants({
  balanceUsd,
  onChanged,
}: {
  balanceUsd: number
  onChanged: () => void
}) {
  const [items, setItems] = useState<WireWishlistItem[] | null>(null)
  const [tick, setTick] = useState(0)

  /**
   * The library, only to subtract it.
   *
   * A wishlist row survives being bought — nothing clears it, and nothing
   * should, since un-saving is the person's call. The *server* already knows
   * better than to buy something twice (`eligibleWantsFor` drops anything
   * `hasEntitlement` says is owned), but the wishlist itself carries no owned
   * flag, so this list was happily reporting a game as "trying to buy" in the
   * same breath as the feed below said it had bought it.
   */
  const [owned, setOwned] = useState<Set<string>>(new Set())

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      getWishlist(controller.signal),
      getLibrary(controller.signal).catch(() => []),
    ])
      .then(([wishlist, library]) => {
        setItems(wishlist.items)
        setOwned(new Set(library.map((game) => game.id)))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setItems([])
      })
    return () => controller.abort()
  }, [tick])

  function reload() {
    setTick((n) => n + 1)
    onChanged()
  }

  if (items === null) {
    return <div className="hatch h-40 rounded-card border-2 border-ink" />
  }

  const unowned = items.filter((item) => !owned.has(item.game.id))
  const wants = unowned.filter((item) => item.agentMaxUnits !== null)
  const saved = unowned.filter((item) => item.agentMaxUnits === null)

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl">What it is trying to buy</h2>
        <span className="font-mono text-[11px] text-ink-soft">
          {wants.length} {wants.length === 1 ? 'game' : 'games'}
        </span>
      </div>

      {wants.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-card border-2 border-dashed border-ink-faint px-5 py-6">
          <p className="max-w-[52ch] font-body text-[15px] leading-relaxed text-ink-soft">
            Nothing yet. Save a game you want, then say the most you would pay
            for it. The agent does the rest.
          </p>
          <ButtonLink to="/" variant="neutral" size="sm">
            Browse the catalog
          </ButtonLink>
        </div>
      ) : (
        <ul className="print-rows mt-4 flex list-none flex-col gap-2 p-0">
          {wants.map((item, i) => (
            <WantRow
              key={item.game.id}
              item={item}
              balanceUsd={balanceUsd}
              onChanged={reload}
              style={{ '--i': i } as CSSProperties}
            />
          ))}
        </ul>
      )}

      {saved.length > 0 ? (
        <>
          <h3 className="mt-8 text-xl">Saved, but not watched</h3>
          <ul className="mt-3 flex list-none flex-col gap-1.5 p-0 font-mono text-[12px]">
            {saved.map((item) => (
              <li
                key={item.game.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b-2 border-paper-deep pb-1.5"
              >
                <Link
                  to={`/game/${item.game.slug}`}
                  className="min-w-0 truncate text-ink no-underline hover:underline"
                >
                  {item.game.title}
                </Link>
                <span className="tnum shrink-0 text-ink-soft">
                  {formatAmount(item.game.priceUsd)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 font-mono text-[11px] text-ink-soft">
            Set a ceiling on any of these from its listing.
          </p>
        </>
      ) : null}
    </section>
  )
}

function WantRow({
  item,
  balanceUsd,
  onChanged,
  style,
}: {
  item: WireWishlistItem
  balanceUsd: number
  onChanged: () => void
  style?: CSSProperties
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const decimals = 6
  const maxUsd = (item.agentMaxUnits ?? 0) / 10 ** decimals
  // What has to happen for this to fire. The number a person is actually
  // waiting on, said as a gap rather than left to be worked out.
  const gap = item.game.priceUsd - maxUsd
  const reachable = balanceUsd >= maxUsd

  async function clear() {
    setBusy(true)
    setProblem(null)
    try {
      await setWant(item.game.id, { agentMaxUnits: null })
      onChanged()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li
      style={style}
      className="rounded-card border-2 border-ink bg-paper px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="min-w-0 flex-1">
          <Link
            to={`/game/${item.game.slug}`}
            className="block truncate font-wonk text-[15px] text-ink no-underline hover:underline"
          >
            {item.game.title}
          </Link>
          <span className="block truncate font-mono text-[11px] text-ink-soft">
            {item.game.studio.name}
            {item.agentNote ? ` · ${item.agentNote}` : ''}
          </span>
        </span>

        <span className="text-right">
          <span className="label-micro block text-ink-soft">Now</span>
          <span className="tnum block font-mono text-[13px]">
            {formatAmount(item.game.priceUsd)}
          </span>
        </span>

        <span className="w-24 text-right">
          <span className="label-micro block text-ink-soft">Buy at</span>
          <span className="tnum block font-mono text-[15px] font-bold text-blue">
            {formatAmount(maxUsd)}
          </span>
        </span>

        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void clear()}>
          {busy ? 'Removing…' : 'Stop watching'}
        </Button>
      </div>

      <p className="mt-2 border-t-2 border-paper-deep pt-2 font-mono text-[11px] leading-relaxed text-ink-soft">
        {!item.stillForSale
          ? 'This is not for sale any more. The agent will not buy it.'
          : gap <= 0
            ? 'Already at or below your price. It should fire on the next price it sees.'
            : `Fires when it drops ${formatAmount(gap)}.`}
        {reachable ? '' : ' Your agent does not hold enough to cover this.'}
      </p>

      {problem ? (
        <p role="alert" className="mt-2 font-body text-sm text-red">
          {problem}
        </p>
      ) : null}
    </li>
  )
}
