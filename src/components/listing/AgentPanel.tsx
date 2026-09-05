import { useState, type CSSProperties } from 'react'
import { Freehand } from '@/components/icons/Freehand'
import { Button } from '@/components/ui/Button'
import { formatPrice, timeAgo, truncateAddress } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  clearAgent,
  createAgent,
  fundAgent,
  simulatePriceDrop,
  stopAgent,
  useAgentFor,
} from '@/mocks/agent'
import type { Game } from '@/mocks/types'

/**
 * The wishlist agent, on the listing where the decision actually happens.
 *
 * Buying and setting a trigger are the same choice made two ways, so they
 * belong on the same screen rather than behind a separate page nobody visits.
 *
 * Blue throughout: nothing a human clicks is blue, so a glance at the page
 * separates "you spending money" from "software spending money" (DESIGN.md §1).
 */
export function AgentPanel({ game }: { game: Game }) {
  const agent = useAgentFor(game.id)
  return agent ? <Watching game={game} /> : <Setup game={game} />
}

// ── setup ─────────────────────────────────────────────────────────────────

function Setup({ game }: { game: Game }) {
  const [open, setOpen] = useState(false)
  const suggested = Math.max(0.5, Math.round((game.priceUsd * 0.6) * 2) / 2)
  const [trigger, setTrigger] = useState(suggested.toFixed(2))
  const [fundAmount, setFundAmount] = useState('10')

  const triggerUsd = Math.max(0, Number(trigger) || 0)
  const fundUsd = Math.max(0, Number(fundAmount) || 0)
  const underfunded = fundUsd < triggerUsd
  const ready = triggerUsd > 0 && !underfunded

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-card border-2 border-ink bg-paper px-4 py-3 text-left transition-[transform,box-shadow] duration-130 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5"
      >
        <Freehand name="share-radar" className="h-9 w-9 shrink-0 text-blue" />
        <span className="min-w-0">
          <span className="block font-wonk text-[15px]">
            Or wait for it to get cheaper
          </span>
          <span className="block font-body text-[13px] text-ink-soft">
            Set a price and let an agent buy it for you.
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-card border-2 border-ink bg-blue p-5 text-paper shadow-hard">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="label-micro text-paper/70">Price trigger</span>
          <h3 className="mt-1 text-xl text-paper">Buy it without you</h3>
        </div>
        <Freehand name="share-radar" className="h-10 w-10 shrink-0 text-paper" />
      </div>

      <label className="label-micro mt-4 block text-paper/70">
        Buy when it drops below
      </label>
      <div className="mt-1.5 flex items-center gap-1 rounded-card border-2 border-paper/55 bg-paper/15 px-3 py-2">
        <span className="font-mono text-sm text-paper/70">$</span>
        <input
          type="number"
          min={0}
          step="0.5"
          value={trigger}
          onChange={(event) => setTrigger(event.target.value)}
          aria-label="Trigger price"
          className="w-20 bg-transparent font-mono tnum text-sm font-bold text-paper outline-none"
        />
        <span className="ml-auto font-mono text-[11px] text-paper/70">
          now {formatPrice(game.priceUsd)}
        </span>
      </div>

      <label className="label-micro mt-4 block text-paper/70">
        Fund its wallet
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {[5, 10, 20].map((amount) => (
          <button
            key={amount}
            type="button"
            aria-pressed={fundAmount === String(amount)}
            onClick={() => setFundAmount(String(amount))}
            className={cn(
              'cursor-pointer rounded-chip border-2 px-3.5 py-1.5 font-mono tnum text-[13px] font-bold transition-transform duration-130 hover:-translate-y-px active:translate-y-px',
              fundAmount === String(amount)
                ? 'border-paper bg-paper text-blue'
                : 'border-paper/55 bg-transparent text-paper',
            )}
          >
            ${amount}
          </button>
        ))}
        <div className="flex items-center gap-1 rounded-card border-2 border-paper/55 bg-paper/15 px-2.5 py-1.5">
          <span className="font-mono text-[13px] text-paper/70">$</span>
          <input
            type="number"
            min={0}
            value={fundAmount}
            onChange={(event) => setFundAmount(event.target.value)}
            aria-label="Amount to fund"
            className="w-14 bg-transparent font-mono tnum text-[13px] font-bold text-paper outline-none"
          />
        </div>
      </div>

      <p className="mt-3 font-body text-[13px] leading-relaxed text-paper/85">
        This is its own wallet, not yours, and the balance is the only spending
        limit. It cannot buy what it cannot afford.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="neutral"
          onClick={() => createAgent({ gameId: game.id, triggerUsd, fundUsd })}
          disabled={!ready}
        >
          Start watching
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cursor-pointer border-0 bg-transparent font-mono text-[11px] text-paper/80 underline underline-offset-2"
        >
          Cancel
        </button>
      </div>

      {underfunded ? (
        <p className="mt-2.5 font-mono text-[11px] text-paper">
          Fund it with at least {formatPrice(triggerUsd)} or it can never buy.
        </p>
      ) : null}
    </div>
  )
}

// ── watching ──────────────────────────────────────────────────────────────

function Watching({ game }: { game: Game }) {
  const agent = useAgentFor(game.id)
  const [drop, setDrop] = useState(() =>
    Math.max(0, game.priceUsd - 1).toFixed(2),
  )
  const [note, setNote] = useState<string | null>(null)

  if (!agent) return null

  function runDrop() {
    const outcome = simulatePriceDrop(game.id, Math.max(0, Number(drop) || 0))
    setNote(
      outcome === 'fired'
        ? 'It bought. The key is in your wallet.'
        : outcome === 'broke'
          ? 'Trigger hit, but its wallet is short. Top it up and drop again.'
          : 'Still above the trigger. Nothing happened.',
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-card border-2 border-ink bg-blue p-5 text-paper shadow-hard">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="label-micro text-paper/70">
              {agent.status === 'watching'
                ? 'Watching the public listings feed'
                : agent.status === 'fired'
                  ? 'Trigger fired'
                  : 'Stopped'}
            </span>
            <h3 className="mt-1 text-xl text-paper">
              {agent.status === 'watching'
                ? 'Waiting for your price'
                : agent.status === 'fired'
                  ? 'It bought this for you'
                  : 'Not watching any more'}
            </h3>
          </div>
          {agent.status === 'watching' ? <Radar /> : null}
        </div>

        <p className="mt-3.5 rounded-card border-2 border-paper/55 bg-paper/15 px-3.5 py-2.5 font-body text-[14px] leading-relaxed">
          Buy <b>{game.title}</b> the moment it drops below{' '}
          <span className="font-mono tnum">{formatPrice(agent.triggerUsd)}</span>.
          Reading the public listings feed, not our database.
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="font-mono tnum">
            <span className="block text-2xl font-bold">
              {formatPrice(agent.balanceUsd)}
            </span>
            <span className="label-micro text-paper/70">
              Left to spend. This is the cap.
            </span>
          </div>
          <span
            className="font-mono text-[11px] text-paper/70"
            title={agent.walletAddress}
          >
            {truncateAddress(agent.walletAddress)}
          </span>
        </div>

        {/* Print (DESIGN.md §4): the agent's log is a ledger, so it arrives
            like one. Keyed on the newest event so a new line reprints the run
            rather than appearing out of nowhere. */}
        <ul
          key={agent.events[0]?.id}
          className="print-rows mt-4 flex list-none flex-col border-t-2 border-paper/30 p-0 pt-2 font-mono text-[11px]"
        >
          {agent.events.slice(0, 4).map((entry, i) => (
            <li
              key={entry.id}
              style={{ '--i': i } as CSSProperties}
              className="flex justify-between gap-3 py-1"
            >
              <span
                className={cn('min-w-0 truncate', entry.kind === 'fired' && 'font-bold')}
              >
                {entry.text}
              </span>
              <span className="shrink-0 text-paper/70">
                {entry.amountUsd !== undefined
                  ? formatPrice(entry.amountUsd)
                  : timeAgo(entry.at)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {agent.status === 'watching' ? (
            <>
              <button
                type="button"
                onClick={() => fundAgent(game.id, 5)}
                className="cursor-pointer rounded-chip border-2 border-paper bg-transparent px-3 py-1 font-mono text-[11px] font-bold text-paper transition-transform duration-130 hover:-translate-y-px active:translate-y-px"
              >
                Add $5
              </button>
              <button
                type="button"
                onClick={() => stopAgent(game.id)}
                className="cursor-pointer border-0 bg-transparent font-mono text-[11px] text-paper/80 underline underline-offset-2"
              >
                Stop watching
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => clearAgent(game.id)}
              className="cursor-pointer border-0 bg-transparent font-mono text-[11px] text-paper/80 underline underline-offset-2"
            >
              Set another trigger
            </button>
          )}
        </div>
      </div>

      {/* TODO(integration): delete. The real trigger is a price change on the
          HCS listings topic, seen through the Mirror Node. */}
      <div className="rounded-card border-2 border-dashed border-ink-faint bg-paper-sunk p-3.5">
        <span className="label-micro text-ink-soft">
          Demo control, not shipping
        </span>
        <p className="mt-1.5 font-body text-[13px] leading-relaxed text-ink-soft">
          Stands in for the dev dropping the price live.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-card border-2 border-ink bg-paper px-2.5 py-1.5">
            <span className="font-mono text-[13px] text-ink-soft">$</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={drop}
              onChange={(event) => setDrop(event.target.value)}
              aria-label="New price"
              className="w-14 bg-transparent font-mono tnum text-[13px] font-bold outline-none"
            />
          </div>
          <Button size="sm" variant="neutral" onClick={runDrop}>
            Drop the price
          </Button>
        </div>
        {note ? (
          <p className="mt-2.5 font-mono text-[11px] text-ink">{note}</p>
        ) : null}
      </div>
    </div>
  )
}

/** Watch: the only ambient loop in the product, and the agent owns it. §4 */
function Radar() {
  return (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center">
      <span className="animate-ping-ring absolute inset-0 rounded-full border-2 border-paper" />
      <span
        className="animate-ping-ring absolute inset-0 rounded-full border-2 border-paper"
        style={{ animationDelay: '1.3s' }}
      />
      <span className="absolute inset-1.5 overflow-hidden rounded-full opacity-50">
        <span className="animate-sweep block h-full w-full bg-[conic-gradient(from_0deg,rgba(251,243,226,.65),rgba(251,243,226,0)_70deg)]" />
      </span>
      <Freehand name="share-radar" className="relative h-7 w-7 text-paper" />
    </span>
  )
}
