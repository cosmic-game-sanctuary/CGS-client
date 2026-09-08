import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { editGame, type WireManageView } from '@/api/manage'
import { errorMessage } from '@/lib/api'
import { formatAmount } from '@/lib/format'

/**
 * Letting people try the game in paid chunks before they buy it.
 *
 * The number that matters is the **worst case**, `chunkPrice × maxChunks`, and
 * it is shown live as the developer types. A meter with no visible ceiling is
 * the thing buyers are actually afraid of, and the server refuses a config
 * where the ceiling exceeds the game's own price, so the reassurance is
 * structural rather than a promise.
 *
 * The two fields are set and cleared together, which the server enforces and
 * this form mirrors: a chunk price with no cap is an open meter, and a cap with
 * no price is nothing at all.
 */
export function TrialConfig({
  view,
  onSaved,
}: {
  view: WireManageView
  onSaved: () => void
}) {
  const { game } = view
  const decimals = game.priceAssetDecimals || 6

  const enabled =
    game.trialChunkPriceUnits != null && game.trialMaxChunks != null

  const [chunkPrice, setChunkPrice] = useState(() =>
    game.trialChunkPriceUnits != null
      ? String(game.trialChunkPriceUnits / 10 ** decimals)
      : '',
  )
  const [minutes, setMinutes] = useState(() =>
    String(game.trialChunkMinutes ?? 5),
  )
  const [maxChunks, setMaxChunks] = useState(() =>
    game.trialMaxChunks != null ? String(game.trialMaxChunks) : '',
  )
  const [saving, setSaving] = useState<'on' | 'off' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const typedPrice = Number(chunkPrice)
  const typedMax = Number(maxChunks)
  const typedMinutes = Number(minutes)

  const priceOk = chunkPrice.trim() !== '' && Number.isFinite(typedPrice) && typedPrice > 0
  const maxOk = Number.isInteger(typedMax) && typedMax > 0 && typedMax <= 100
  const minutesOk = Number.isInteger(typedMinutes) && typedMinutes > 0 && typedMinutes <= 60

  const chunkUnits = priceOk ? Math.round(typedPrice * 10 ** decimals) : null
  const worstCaseUnits = chunkUnits !== null && maxOk ? chunkUnits * typedMax : null
  const overPrice =
    worstCaseUnits !== null && worstCaseUnits > game.priceUnits

  const ready = priceOk && maxOk && minutesOk && !overPrice

  async function save(next: 'on' | 'off') {
    setSaving(next)
    setProblem(null)
    try {
      await editGame(
        game.id,
        next === 'off'
          ? { trialChunkPriceUnits: null, trialMaxChunks: null }
          : {
              trialChunkPriceUnits: chunkUnits!,
              trialMaxChunks: typedMax,
              trialChunkMinutes: typedMinutes,
            },
      )
      onSaved()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setSaving(null)
    }
  }

  // A free game has nothing to charge for and nothing to credit back.
  if (game.priceUnits === 0) {
    return (
      <section className="mt-10">
        <h2 className="text-2xl">Paid trial</h2>
        <p className="mt-3 rounded-card border-2 border-dashed border-ink-faint px-5 py-5 font-body text-[15px] text-ink-soft">
          This game is free, so there is nothing to try before buying.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl">Paid trial</h2>
        <span className="label-micro text-ink-soft">
          {enabled ? 'On' : 'Off'}
        </span>
      </div>
      <p className="mt-2 max-w-[58ch] font-body text-[15px] leading-relaxed text-ink-soft">
        People pay for a few minutes at a time, and every cent of it comes off
        the price if they buy. It never expires and it is not a rental.
      </p>

      <div className="mt-5 flex flex-col gap-4 rounded-card border-2 border-ink bg-paper-sunk p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label-micro text-ink-soft">Per chunk</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[15px] text-ink-soft">$</span>
              <input
                value={chunkPrice}
                inputMode="decimal"
                placeholder="0.03"
                onChange={(event) => setChunkPrice(event.target.value)}
                className={`${input} max-w-28 font-mono`}
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-micro text-ink-soft">Minutes each</span>
            <input
              value={minutes}
              inputMode="numeric"
              onChange={(event) => setMinutes(event.target.value)}
              className={`${input} max-w-24 font-mono`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-micro text-ink-soft">Most they can buy</span>
            <input
              value={maxChunks}
              inputMode="numeric"
              placeholder="10"
              onChange={(event) => setMaxChunks(event.target.value)}
              className={`${input} max-w-24 font-mono`}
            />
          </label>
        </div>

        {/* The whole point of the form, computed as they type. The server
            enforces the same rule, so this is so nobody discovers it by being
            refused rather than by reading. */}
        {worstCaseUnits !== null ? (
          <p
            className={`font-mono text-[12px] ${overPrice ? 'text-red' : 'text-green'}`}
          >
            Worst case {formatAmount(worstCaseUnits / 10 ** decimals)} for{' '}
            {typedMax * typedMinutes} minutes
            {overPrice
              ? `, which is more than the game costs (${formatAmount(game.priceUsd)}).`
              : `, against a price of ${formatAmount(game.priceUsd)}.`}
          </p>
        ) : null}

        {!minutesOk && minutes.trim() !== '' ? (
          <p className="font-mono text-[11px] text-red">
            Minutes has to be a whole number, up to 60.
          </p>
        ) : null}
        {!maxOk && maxChunks.trim() !== '' ? (
          <p className="font-mono text-[11px] text-red">
            Most they can buy has to be a whole number, up to 100.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-4">
          <Button
            variant="primary"
            disabled={!ready || saving !== null}
            onClick={() => void save('on')}
          >
            {saving === 'on'
              ? 'Saving…'
              : enabled
                ? 'Update the trial'
                : 'Turn the trial on'}
          </Button>
          {enabled ? (
            <Button
              variant="ghost"
              disabled={saving !== null}
              onClick={() => void save('off')}
            >
              {saving === 'off' ? 'Turning off…' : 'Turn it off'}
            </Button>
          ) : null}
        </div>

        {problem ? (
          <p role="alert" className="font-body text-sm text-red">
            {problem}
          </p>
        ) : null}
      </div>

    </section>
  )
}

const input =
  'rounded-card border-2 border-ink bg-paper px-3 py-2 font-body text-[15px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm'
