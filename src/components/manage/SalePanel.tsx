import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useCountdown } from '@/lib/countdown'
import {
  endSale,
  extendSale,
  getPromotions,
  startSale,
  type WirePromotion,
} from '@/api/promotions'
import { ApiError, errorMessage } from '@/lib/api'
import { formatAmount, formatDate } from '@/lib/format'
import type { WireManageView } from '@/api/manage'

/**
 * Running a sale on a game you made.
 *
 * The panel sits beside the price editor because it is the other way to change
 * a price, and it has to be visible there: while a sale runs the price field
 * is refused, so a developer who cannot see the sale cannot tell why.
 *
 * Two rules the server enforces and the copy has to make sense of, since both
 * look like arbitrary refusals otherwise:
 *
 * - **One at a time.** Overlapping sales have no coherent price to return to,
 *   because each captures the price it found when it started.
 * - **Extending moves the end later, never earlier.** A deadline that has been
 *   published, on a public topic, is a promise to whoever read it. Ending early
 *   is a separate and announced act, not a quiet edit.
 */
export function SalePanel({
  view,
  onChanged,
}: {
  view: WireManageView
  onChanged: () => void
}) {
  const { game } = view
  const [loaded, setLoaded] = useState<{
    gameId: string
    active: WirePromotion | null
    history: WirePromotion[]
  } | null>(null)
  const [tick, setTick] = useState(0)

  /**
   * Re-read the sale, and tell the parent to re-read the game.
   *
   * The tick is not redundant with `game.priceUnits`. Starting a sale *now*
   * moves the price, so the parent's reload would have been enough; scheduling
   * one for next week moves nothing, and without this the panel would keep
   * offering to start the sale it had just scheduled.
   */
  function refresh() {
    setTick((n) => n + 1)
    onChanged()
  }

  useEffect(() => {
    const controller = new AbortController()
    getPromotions(game.id, controller.signal)
      .then(({ active, history }) =>
        setLoaded({ gameId: game.id, active, history }),
      )
      .catch(() => {
        if (controller.signal.aborted) return
        setLoaded({ gameId: game.id, active: null, history: [] })
      })
    return () => controller.abort()
  }, [game.id, game.priceUnits, tick])

  const current = loaded?.gameId === game.id ? loaded : null

  return (
    <section className="mt-10">
      <h2 className="text-2xl">Sales</h2>
      <p className="mt-2 max-w-[58ch] font-body text-[15px] leading-relaxed text-ink-soft">
        A sale is a price with an end date. It starts, it runs, and it puts the
        old price back by itself.
      </p>

      {current === null ? (
        <div className="hatch mt-5 h-28 rounded-card border-2 border-ink" />
      ) : current.active ? (
        <RunningSale
          gameId={game.id}
          promotion={current.active}
          onChanged={refresh}
        />
      ) : (
        <StartSale view={view} onStarted={refresh} />
      )}

      {current && current.history.length > 0 ? (
        <History rows={current.history} activeId={current.active?.id} />
      ) : null}
    </section>
  )
}

/** A sale that is running now, or one that is waiting to start. */
function RunningSale({
  gameId,
  promotion,
  onChanged,
}: {
  gameId: string
  promotion: WirePromotion
  onChanged: () => void
}) {
  const [until, setUntil] = useState(toLocalInput(promotion.endsAt))
  const [busy, setBusy] = useState<'extend' | 'end' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const scheduled = promotion.status === 'scheduled'
  const left = useCountdown(promotion.endsAt)

  async function run(kind: 'extend' | 'end', work: () => Promise<unknown>) {
    setBusy(kind)
    setProblem(null)
    try {
      await work()
      onChanged()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-5 rounded-card border-2 border-ink bg-paper-sunk p-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-wonk text-2xl">
          {promotion.percentOff}% off
        </span>
        <span className="font-mono tnum text-[15px]">
          {formatAmount(promotion.salePriceUsd)}
          <span className="ml-2 text-ink-soft line-through">
            {formatAmount(promotion.basePriceUsd)}
          </span>
        </span>
        <span className="label-micro ml-auto text-ink-soft">
          {scheduled ? 'Scheduled' : 'Running'}
        </span>
      </div>

      <p className="mt-2 font-mono text-[12px] leading-relaxed text-ink-soft">
        {scheduled
          ? `Starts ${formatDate(promotion.startsAt)}, ends ${formatDate(promotion.endsAt)}.`
          : left !== null
            ? `Ends in ${left}, on ${formatDate(promotion.endsAt)}.`
            : 'Ending now. The price goes back on the server, in its own time.'}
      </p>

      {/* The public record of the sale opening. Worth surfacing here and
          nowhere a shopper looks: it is the evidence a developer would point
          at, not something a buyer wants in their way. */}
      {promotion.hcsStartTxId ? (
        <p className="mt-1 font-mono text-[11px] break-all text-ink-faint">
          Announced as {promotion.hcsStartTxId}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t-2 border-ink pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="label-micro text-ink-soft">
            End it later
          </span>
          <input
            type="datetime-local"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            className={input}
          />
        </label>
        <Button
          size="sm"
          variant="neutral"
          disabled={busy !== null || !until}
          onClick={() =>
            void run('extend', () =>
              extendSale(gameId, promotion.id, new Date(until).toISOString()),
            )
          }
        >
          {busy === 'extend' ? 'Moving…' : 'Extend'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => void run('end', () => endSale(gameId, promotion.id))}
        >
          {busy === 'end'
            ? 'Ending…'
            : scheduled
              ? 'Cancel it'
              : 'End it now'}
        </Button>
      </div>

      {/* Only the scheduled case says anything. A running sale's controls
          explain themselves, and a second sentence under them was telling the
          reader something they had not asked about. */}
      {scheduled ? (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          Nothing has been announced yet. Cancelling now leaves no trace.
        </p>
      ) : null}

      {problem ? (
        <p role="alert" className="mt-3 font-body text-sm text-red">
          {problem}
        </p>
      ) : null}
    </div>
  )
}

/** No sale on this game. The form that starts one. */
function StartSale({
  view,
  onStarted,
}: {
  view: WireManageView
  onStarted: () => void
}) {
  const { game } = view
  const [price, setPrice] = useState('')
  const [ends, setEnds] = useState(() => toLocalInput(inDays(7)))
  const [starts, setStarts] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const decimals = game.priceAssetDecimals || 6
  const typed = Number(price)
  const valid = price.trim() !== '' && Number.isFinite(typed) && typed >= 0
  const units = valid ? Math.round(typed * 10 ** decimals) : null
  const tooHigh = units !== null && units >= game.priceUnits
  const percentOff =
    units !== null && !tooHigh && game.priceUnits > 0
      ? Math.round(((game.priceUnits - units) / game.priceUnits) * 100)
      : null

  const endsAt = ends ? new Date(ends) : null
  // Checked against when the form opened rather than against a clock read
  // during render, which React's purity rule refuses and is right to. Leaving
  // the form open for an hour could let a stale date through; the server
  // checks it properly and says so, which is where that check belongs anyway.
  const [openedAt] = useState(() => Date.now())
  const endsValid = endsAt !== null && endsAt.getTime() > openedAt

  // A free game has no room for a discount, and the server refuses it. Saying
  // so is better than a form that can only fail.
  if (game.priceUnits === 0) {
    return (
      <p className="mt-5 rounded-card border-2 border-dashed border-ink-faint px-5 py-5 font-body text-[15px] text-ink-soft">
        This game is free, so there is nothing to discount.
      </p>
    )
  }

  async function start() {
    if (units === null || !endsAt) return
    setBusy(true)
    setProblem(null)
    try {
      await startSale(game.id, {
        salePriceUnits: units,
        endsAt: endsAt.toISOString(),
        ...(starts ? { startsAt: new Date(starts).toISOString() } : {}),
      })
      onStarted()
    } catch (error) {
      // The one refusal a developer can act on directly, and the message is
      // about a sale they may have forgotten they scheduled.
      setProblem(
        error instanceof ApiError && error.code === 'PROMOTION_EXISTS'
          ? 'This game already has a sale scheduled. End that one first.'
          : errorMessage(error),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-4 rounded-card border-2 border-ink bg-paper-sunk p-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="label-micro text-ink-soft">
            Sale price
            <span className="ml-2 normal-case">
              now {formatAmount(game.priceUsd)}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[15px] text-ink-soft">$</span>
            <input
              value={price}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(event) => setPrice(event.target.value)}
              className={`${input} max-w-32 font-mono`}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label-micro text-ink-soft">Ends</span>
          <input
            type="datetime-local"
            value={ends}
            onChange={(event) => setEnds(event.target.value)}
            className={input}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label-micro text-ink-soft">Starts</span>
          <input
            type="datetime-local"
            value={starts}
            onChange={(event) => setStarts(event.target.value)}
            className={input}
          />
        </label>
      </div>

      {tooHigh ? (
        <p className="font-mono text-[11px] text-red">
          A sale price has to be below {formatAmount(game.priceUsd)}.
        </p>
      ) : percentOff !== null ? (
        <p className="font-mono text-[12px] text-green">
          {percentOff}% off. Everyone with this on their wishlist is told.
        </p>
      ) : null}

      {ends && !endsValid ? (
        <p className="font-mono text-[11px] text-red">
          That end date has already passed.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-4">
        <Button
          variant="primary"
          disabled={busy || units === null || tooHigh || !endsValid}
          onClick={() => void start()}
        >
          {busy ? 'Starting…' : starts ? 'Schedule it' : 'Start the sale'}
        </Button>
        <span className="max-w-[42ch] font-mono text-[11px] leading-relaxed text-ink-soft">
          The old price comes back on its own. You do not have to remember.
        </span>
      </div>

      {problem ? (
        <p role="alert" className="font-body text-sm text-red">
          {problem}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Every sale this game has run. Public on the server, and shown here because
 * the developer is the person most likely to want to repeat one.
 */
function History({
  rows,
  activeId,
}: {
  rows: WirePromotion[]
  activeId?: string
}) {
  const past = rows.filter((row) => row.id !== activeId)
  if (past.length === 0) return null

  return (
    <>
      <h3 className="mt-8 text-xl">Sales it has run</h3>
      <ul className="mt-3 flex list-none flex-col gap-1.5 p-0 font-mono text-[12px]">
        {past.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b-2 border-paper-deep pb-1.5"
          >
            <span>
              <b className="tnum">{row.percentOff}% off</b>
              <span className="ml-2 text-ink-soft">
                {formatAmount(row.salePriceUsd)} from{' '}
                {formatAmount(row.basePriceUsd)}
              </span>
            </span>
            <span className="text-ink-soft">
              {formatDate(row.startsAt)} to {formatDate(row.endsAt)}
              {row.status === 'cancelled' ? ' · ended early' : ''}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

const input =
  'rounded-card border-2 border-ink bg-paper px-3 py-2 font-body text-[14px] outline-none focus:shadow-hard-sm'

/**
 * An ISO instant as `datetime-local` wants it: local wall time, no zone, to the
 * minute. `toISOString` would hand back UTC and silently shift the field.
 */
function toLocalInput(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

function inDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
