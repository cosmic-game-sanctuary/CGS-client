import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useCountdown } from '@/lib/countdown'
import { respondToDecision, type WireDecision } from '@/api/agent'
import { ApiError, errorMessage } from '@/lib/api'
import { formatAmount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * What the agent did, and what it was thinking.
 *
 * The most important screen in the product, and the reason it is a page rather
 * than a status chip. Every other storefront's automation is a black box that
 * emails you a receipt. This says what was considered, what was chosen, and,
 * when the choice was genuinely contested, the model's own words for why.
 *
 * `reasoning` is null on a deterministic buy and that is correct rather than
 * missing: one game, under its ceiling, affordable, nothing to deliberate. A
 * sentence manufactured for those rows would make the real ones worth less.
 */
export function DecisionFeed({
  decisions,
  titles,
  onAnswered,
}: {
  decisions: WireDecision[]
  /** Game id to title and slug, so a decision can name what it was about. */
  titles: Map<string, { title: string; slug: string }>
  onAnswered: () => void
}) {
  if (decisions.length === 0) {
    return (
      <section>
        <h2 className="text-2xl">What it has done</h2>
        <p className="mt-3 rounded-card border-2 border-dashed border-ink-faint px-5 py-6 font-body text-[15px] leading-relaxed text-ink-soft">
          Nothing yet. It only acts when a price it is watching actually moves,
          so an empty list here means no game on your list has changed price.
        </p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-2xl">What it has done</h2>
      <ul className="print-rows mt-4 flex list-none flex-col gap-2.5 p-0">
        {decisions.map((decision, i) => (
          <DecisionRow
            key={decision.id}
            decision={decision}
            titles={titles}
            onAnswered={onAnswered}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
      </ul>
    </section>
  )
}

const KIND: Record<
  WireDecision['kind'],
  { label: string; tone: string; said: (n: number) => string }
> = {
  bought: {
    label: 'Bought',
    tone: 'bg-green text-paper',
    said: (n) => (n === 1 ? 'Bought it.' : `Bought ${n} of them.`),
  },
  held: {
    label: 'Waiting',
    tone: 'bg-yellow text-ink',
    // The deferral is the decision, not the absence of one. Spending now would
    // have cost something else on the list, and the sale is open until it
    // isn't, so waiting is free until the wire.
    said: () => 'Holding the money rather than spending it on the first thing.',
  },
  declined: {
    label: 'Passed',
    tone: 'bg-paper-deep text-ink',
    said: () => 'Decided against it.',
  },
  asked: {
    label: 'Asked you',
    tone: 'bg-blue text-paper',
    said: () => 'Wants you to decide.',
  },
}

function DecisionRow({
  decision,
  titles,
  onAnswered,
  style,
}: {
  decision: WireDecision
  titles: Map<string, { title: string; slug: string }>
  onAnswered: () => void
  style?: CSSProperties
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const left = useCountdown(decision.decideBy ?? '')

  const kind = KIND[decision.kind]
  const considered = decision.consideredGameIds
  /**
   * `chosenGameIds` means "the games this decision is about", not "the games it
   * took" — a `declined` row lists what it passed on in exactly the same field.
   * Colouring by that alone painted a rejected game green, which said the
   * opposite of what happened.
   */
  const named = new Set(decision.chosenGameIds)
  const took = decision.kind === 'bought'
  // Live only while nothing has resolved it. A question whose deadline passed
  // was answered by the deadline, which is an outcome and not a loose end.
  const open = decision.resolvedAt === null && decision.kind === 'asked'
  // A hold that has not come due yet: the agent has decided to decide later,
  // and the clock is the interesting part. Nothing to press — it resolves
  // itself, which is the whole point of having handed it the budget.
  const waiting = decision.resolvedAt === null && decision.kind === 'held'

  async function answer(action: 'buy' | 'skip' | 'remove' | 'keep') {
    setBusy(action)
    setProblem(null)
    try {
      await respondToDecision(decision.id, action)
      onAnswered()
    } catch (error) {
      // Not a failure: the deadline fired, or a fresh price event replaced the
      // question. Saying "that didn't work" would be wrong about both.
      setProblem(
        error instanceof ApiError && error.code === 'ALREADY_RESOLVED'
          ? 'This one resolved itself before you got to it. Its outcome is below.'
          : errorMessage(error),
      )
      onAnswered()
    } finally {
      setBusy(null)
    }
  }

  return (
    <li
      style={style}
      className={cn(
        'rounded-card border-2 border-ink bg-paper px-4 py-3.5',
        open && 'border-l-8 border-l-blue shadow-hard',
        waiting && 'border-l-8 border-l-yellow',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={cn('label-micro rounded-chip border-2 border-ink px-2 py-0.5', kind.tone)}>
          {kind.label}
        </span>
        <span className="font-body text-[15px]">
          {kind.said(decision.chosenGameIds.length)}
        </span>
        <span className="ml-auto font-mono text-[11px] text-ink-soft">
          {timeAgo(decision.createdAt)}
        </span>
      </div>

      {/* What was on the table, and what it took. The pair is the whole point:
          "bought one" means nothing without knowing it chose from three. */}
      {considered.length > 0 ? (
        <ul className="mt-2.5 flex list-none flex-wrap gap-1.5 p-0">
          {considered.map((id) => {
            const game = titles.get(id)
            return (
              <li key={id}>
                {game ? (
                  <Link
                    to={`/game/${game.slug}`}
                    className={cn(
                      'block rounded-chip border-2 border-ink px-2.5 py-0.5 font-mono text-[11px] no-underline',
                      !named.has(id)
                        ? // Considered in this round, and not what it acted on.
                          'bg-paper-sunk text-ink-soft line-through'
                        : took
                          ? 'bg-green text-paper'
                          : decision.kind === 'held'
                            ? 'bg-yellow text-ink'
                            : // Declined: named, and named to say no to.
                              'bg-paper-sunk text-ink-soft line-through',
                    )}
                  >
                    {game.title}
                  </Link>
                ) : (
                  <span className="block rounded-chip border-2 border-ink-faint px-2.5 py-0.5 font-mono text-[11px] text-ink-faint">
                    a game
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      {decision.reasoning ? (
        <p className="mt-3 border-l-2 border-ink-faint pl-3 font-body text-[14px] leading-relaxed text-ink-soft italic">
          {decision.reasoning}
        </p>
      ) : null}

      {waiting ? (
        <p className="mt-3 border-t-2 border-ink pt-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          {left
            ? `Decides in ${left}, shortly before the sale ends. Nothing for you to do.`
            : 'Deciding now.'}
        </p>
      ) : null}

      {open ? (
        <div className="mt-3 border-t-2 border-ink pt-3">
          <p className="font-mono text-[11px] text-ink-soft">
            {left
              ? `Answer within ${left}, or it decides on its own.`
              : 'Deciding on its own now.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="go" disabled={busy !== null} onClick={() => void answer('buy')}>
              {busy === 'buy' ? 'Buying…' : 'Buy it'}
            </Button>
            <Button size="sm" variant="neutral" disabled={busy !== null} onClick={() => void answer('skip')}>
              Not this time
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void answer('remove')}>
              Stop watching it
            </Button>
          </div>
        </div>
      ) : null}

      {/* Money spent on thinking rather than on games, kept separate because
          it is the one cost that buys nothing you can play. */}
      {decision.inferenceCostUnits ? (
        <p className="mt-2.5 font-mono text-[10px] text-ink-faint">
          Thinking cost {formatAmount(decision.inferenceCostUnits / 10 ** 6)},
          paid over x402 like everything else.
        </p>
      ) : null}

      {problem ? (
        <p role="alert" className="mt-2 font-body text-sm text-ink-soft">
          {problem}
        </p>
      ) : null}
    </li>
  )
}
