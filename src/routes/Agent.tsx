import { useCallback, useEffect, useState } from 'react'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/Button'
import { AgentSetup } from '@/components/agent/AgentSetup'
import { AgentWants } from '@/components/agent/AgentWants'
import { DecisionFeed } from '@/components/agent/DecisionFeed'
import { FundAgent } from '@/components/agent/FundAgent'
import {
  getAgent,
  getDecisions,
  retireAgent,
  updateAgent,
  type WireAgent,
  type WireDecision,
} from '@/api/agent'
import { getWishlist } from '@/api/wishlist'
import { ApiError, errorMessage } from '@/lib/api'
import { formatAmount, formatDate } from '@/lib/format'
import { signIn, useSession } from '@/auth/session'

/**
 * Your agent.
 *
 * **A page, not a modal.** An agent runs for weeks and holds its own money; it
 * is closer to a wallet than to a purchase. It also does things while nobody is
 * looking, which is exactly why it needs somewhere you can go and find out what
 * it has been doing.
 *
 * Three things, in the order people worry about them: whether it has money,
 * what it is trying to buy, and what it has actually done. An unanswered
 * question jumps above all of it, because a deadline is running.
 */
export function Agent() {
  const session = useSession()
  const [loaded, setLoaded] = useState<{
    userId: string
    agent: WireAgent | null
    error: string | null
  } | null>(null)
  const [decisions, setDecisions] = useState<WireDecision[]>([])
  const [titles, setTitles] = useState(
    new Map<string, { title: string; slug: string }>(),
  )
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const userId = session.userId

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    getAgent(controller.signal)
      .then((agent) => setLoaded({ userId, agent, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // No agent is the normal state for most people, not a failure.
        if (error instanceof ApiError && error.status === 404) {
          setLoaded({ userId, agent: null, error: null })
          return
        }
        setLoaded({ userId, agent: null, error: errorMessage(error) })
      })
    return () => controller.abort()
  }, [userId, tick])

  // The decisions name games by id, and a row that cannot say which game it was
  // about is not worth reading. The wishlist is where those games already are.
  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    Promise.all([
      getDecisions(controller.signal),
      getWishlist(controller.signal).catch(() => ({ items: [] })),
    ])
      .then(([{ decisions }, { items }]) => {
        setDecisions(decisions)
        setTitles(
          new Map(
            items.map((item) => [
              item.game.id,
              { title: item.game.title, slug: item.game.slug },
            ]),
          ),
        )
      })
      .catch(() => {
        // An agent with no decisions 404s on nothing here; a failure just
        // leaves the feed empty, which reads the same as having done nothing.
      })
    return () => controller.abort()
  }, [userId, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])

  const current = loaded?.userId === userId ? loaded : null

  async function close() {
    if (!current?.agent) return
    setBusy(true)
    setProblem(null)
    try {
      const retired = await retireAgent()
      setProblem(
        Number(retired.refundedUnits) > 0
          ? `Closed. ${formatAmount(retired.refundedUsd)} came back to your wallet.`
          : 'Closed. There was nothing left to send back.',
      )
      reload()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function setMode(mode: 'autonomous' | 'ask_first') {
    setBusy(true)
    try {
      await updateAgent({ mode })
      reload()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-page flex-1 px-6 py-9">
        <h1 className="text-[clamp(30px,4.4vw,44px)]">My agent</h1>
        <p className="mt-2 max-w-[54ch] font-body text-ink-soft">
          It watches the prices of games you want and buys them when they drop
          far enough. It spends its own wallet, and the key lands in yours.
        </p>

        {!session.signedIn ? (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-yellow px-7 py-9 shadow-hard md:flex-row md:items-center md:gap-8">
            <Freehand name="share-radar" className="h-20 w-20 text-ink" />
            <div className="flex flex-col items-start gap-3">
              <h2 className="text-2xl">Sign in to set one up.</h2>
              <p className="max-w-[44ch] font-body text-[15px] text-ink">
                It needs a wallet of its own, and that starts with yours.
              </p>
              <Button variant="neutral" size="sm" onClick={() => signIn()}>
                Sign in
              </Button>
            </div>
          </div>
        ) : current === null ? (
          <div className="hatch mt-8 h-48 rounded-card border-2 border-ink" />
        ) : current.error !== null ? (
          <div className="mt-8 rounded-card border-2 border-ink border-l-8 border-l-red bg-paper-sunk px-7 py-8">
            <h2 className="text-2xl">Your agent would not load.</h2>
            <p className="mt-2 max-w-[46ch] font-body text-[15px] text-ink-soft">
              {current.error}
            </p>
          </div>
        ) : current.agent === null || isOver(current.agent) ? (
          <>
            {current.agent && isOver(current.agent) ? (
              <p className="mt-6 rounded-card border-2 border-ink bg-paper-sunk px-5 py-4 font-body text-[15px] text-ink-soft">
                Your last agent {current.agent.status === 'expired' ? 'expired' : 'was closed'}, and
                anything left in it came back to your wallet. Making another one
                starts fresh.
              </p>
            ) : null}
            <AgentSetup onMade={reload} />
          </>
        ) : (
          <Running
            agent={current.agent}
            decisions={decisions}
            titles={titles}
            busy={busy}
            problem={problem}
            onReload={reload}
            onClose={() => void close()}
            onMode={(mode) => void setMode(mode)}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

/** Retired, one way or the other. Nothing to show, and a new one is offered. */
function isOver(agent: WireAgent): boolean {
  return agent.status === 'cancelled' || agent.status === 'expired'
}

function Running({
  agent,
  decisions,
  titles,
  busy,
  problem,
  onReload,
  onClose,
  onMode,
}: {
  agent: WireAgent
  decisions: WireDecision[]
  titles: Map<string, { title: string; slug: string }>
  busy: boolean
  problem: string | null
  onReload: () => void
  onClose: () => void
  onMode: (mode: 'autonomous' | 'ask_first') => void
}) {
  // An unanswered question outranks everything else on this page: a deadline is
  // running and the whole point of ask-first is that it does not run out
  // because somebody failed to notice.
  const open = decisions.filter(
    (d) => d.kind === 'asked' && d.resolvedAt === null,
  )
  // A hold that has not come due. It needs nothing from anyone, but it is the
  // agent visibly choosing to wait rather than spend, which is the part worth
  // seeing before the history of what it already did.
  const waiting = decisions.filter(
    (d) => d.kind === 'held' && d.resolvedAt === null,
  )
  const rest = decisions.filter(
    (d) => !open.includes(d) && !waiting.includes(d),
  )

  const broke = Number(agent.balanceUnits) === 0

  return (
    <>
      {open.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-2xl">It needs an answer</h2>
          <div className="mt-3">
            <DecisionFeed
              decisions={open}
              titles={titles}
              onAnswered={onReload}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-card border-2 border-ink bg-paper px-6 py-5 shadow-hard">
            <span className="label-micro text-ink-soft">It holds</span>
            <p className="mt-1 font-mono tnum text-[clamp(28px,4vw,40px)] leading-none font-bold text-green">
              {formatAmount(agent.balanceUsd)}
            </p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-soft">
              {agent.agentAccountId
                ? `Account ${agent.agentAccountId}`
                : 'No account on Hedera yet. The first money in makes one.'}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-soft">
              {STATUS[agent.status]}
            </p>
            {agent.ensName ? (
              <p className="mt-2 rounded-chip border-2 border-ink bg-paper-sunk px-2.5 py-1 text-center font-mono text-[12px] font-semibold">
                {agent.ensName}
              </p>
            ) : null}
          </div>

          {broke ? (
            <p className="rounded-card border-2 border-ink bg-yellow px-4 py-3 font-body text-[14px] leading-relaxed">
              It cannot buy anything until it has money. A want can only be set
              for an amount the wallet actually covers.
            </p>
          ) : null}

          <FundAgent agent={agent} onFunded={onReload} />

          <div className="rounded-card border-2 border-ink bg-paper-sunk p-5">
            <span className="label-micro block text-ink-soft">
              When it cannot have everything
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={agent.mode === 'autonomous' ? 'neutral' : 'ghost'}
                disabled={busy}
                onClick={() => onMode('autonomous')}
              >
                Decide for me
              </Button>
              <Button
                size="sm"
                variant={agent.mode === 'ask_first' ? 'neutral' : 'ghost'}
                disabled={busy}
                onClick={() => onMode('ask_first')}
              >
                Ask me first
              </Button>
            </div>
            <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-ink-soft">
              {agent.mode === 'ask_first'
                ? `It asks when there is time to ask. When there is not, it ${agent.onTimeout === 'buy' ? 'buys' : 'skips'}.`
                : 'It acts, then tells you what it did.'}
              {agent.expiresAt
                ? ` Ends ${formatDate(agent.expiresAt)}.`
                : ''}
            </p>
          </div>

          <div>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
              {busy ? 'Working…' : 'Close it and take the money back'}
            </Button>
            {problem ? (
              <p className="mt-2 font-body text-sm text-ink-soft">{problem}</p>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-12">
          {waiting.length > 0 ? (
            <div>
              <h2 className="text-2xl">It is waiting on purpose</h2>
              <p className="mt-2 max-w-[56ch] font-body text-[15px] leading-relaxed text-ink-soft">
                Buying now would use money it wants for something else on your
                list. A sale is open until it ends, so it decides at the last
                moment instead, when it can see more of what is on offer.
              </p>
              <div className="mt-3">
                <DecisionFeed
                  decisions={waiting}
                  titles={titles}
                  onAnswered={onReload}
                />
              </div>
            </div>
          ) : null}

          <AgentWants balanceUsd={agent.balanceUsd} onChanged={onReload} />
          <DecisionFeed
            decisions={rest}
            titles={titles}
            onAnswered={onReload}
          />
        </div>
      </div>
    </>
  )
}

/** What each status means in a sentence, since none of them are self-evident. */
const STATUS: Record<WireAgent['status'], string> = {
  draft: 'Waiting for its first money.',
  funded: 'Funded. Getting itself onto the topic.',
  watching: 'Watching prices now.',
  buying: 'Buying something right now.',
  cancelled: 'Closed.',
  expired: 'Expired.',
  failed: 'Something went wrong on its last try.',
}
