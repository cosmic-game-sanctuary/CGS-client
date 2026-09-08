import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { getStudioEarnings, type WireStudioEarnings } from '@/api/earnings'
import { formatAmount } from '@/lib/format'

/**
 * What the studio took in, and who it went to.
 *
 * Visible to the whole team, not just the founder. A collaborator credited on
 * the games has more reason to look than anyone, and a team that cannot see its
 * own takings is not a team. Nobody outside the studio sees any of it, which
 * the server enforces; this component is simply not rendered for them.
 *
 * The people list is the part that earns its place. Everywhere else in the app
 * a split is a percentage; here it is an amount, next to whether that person
 * has claimed the invite it is waiting behind. That is what turns "someone
 * hasn't accepted yet" from a status into a number somebody will chase.
 *
 * Handles, not names, because a handle is the identity on a split and the only
 * one a collaborator without an account has at all.
 */
export function StudioEarnings({ studioId }: { studioId: string }) {
  const [loaded, setLoaded] = useState<{
    studioId: string
    report: WireStudioEarnings | null
  } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getStudioEarnings(studioId, controller.signal)
      .then((report) => setLoaded({ studioId, report }))
      .catch(() => {
        if (controller.signal.aborted) return
        // Being refused here is a real answer: someone left the team, or is
        // looking at a studio they only thought they were on. Either way the
        // section belongs to people it loads for.
        setLoaded({ studioId, report: null })
      })
    return () => controller.abort()
  }, [studioId])

  const current = loaded?.studioId === studioId ? loaded : null

  if (current === null) {
    return <div className="hatch h-40 rounded-card border-2 border-ink" />
  }
  if (current.report === null) return null

  const { totals, people, games } = current.report
  const unclaimed = people.filter((person) => !person.claimed)

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl">What this studio has made</h2>
        <span className="font-mono text-[11px] text-ink-soft">
          only the team sees this
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Figure label="Taken in" value={formatAmount(totals.gross.display)} big />
        <Figure label="Sales" value={String(totals.sales)} />
        <Figure
          label="Published"
          value={`${totals.published} of ${totals.games}`}
        />
      </div>

      {totals.held.units > 0 ? (
        <p className="mt-4 rounded-card border-2 border-ink bg-yellow px-4 py-3 font-body text-[15px] leading-relaxed">
          <b className="font-mono tnum">{formatAmount(totals.held.display)}</b>{' '}
          is waiting on{' '}
          {unclaimed.length === 1
            ? `${unclaimed[0]?.handle ?? 'someone'} claiming their invite`
            : 'people who have not claimed their invites'}
          . It goes out the moment they do.
        </p>
      ) : null}

      {totals.failed.units > 0 ? (
        <p className="mt-4 rounded-card border-2 border-l-8 border-ink border-l-red bg-paper-sunk px-4 py-3 font-body text-[15px] leading-relaxed">
          <b className="font-mono tnum">{formatAmount(totals.failed.display)}</b>{' '}
          of a payout did not go through. It is still owed and still recorded.
        </p>
      ) : null}

      <h3 className="mt-8 text-xl">Who earned what</h3>
      <ul className="print-rows mt-3 flex list-none flex-col gap-2 p-0">
        {people.map((person, i) => (
          <li
            key={person.handle}
            style={{ '--i': i } as CSSProperties}
            className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-card border-2 border-ink bg-paper px-4 py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[13px] font-semibold">
                {person.handle}
              </span>
              <span className="block truncate font-mono text-[11px] text-ink-soft">
                {person.role} · {person.games}{' '}
                {person.games === 1 ? 'game' : 'games'}
                {person.claimed ? '' : ' · has not claimed their invite'}
              </span>
            </span>
            <span className="tnum shrink-0 font-mono text-[15px] font-bold">
              {formatAmount(person.earned.display)}
            </span>
          </li>
        ))}
      </ul>

      {games.length > 0 ? (
        <>
          <h3 className="mt-8 text-xl">Game by game</h3>
          <ul className="mt-3 flex list-none flex-col gap-1.5 p-0 font-mono text-[12px]">
            {games.map((game) => (
              <li
                key={game.gameId}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b-2 border-paper-deep pb-1.5"
              >
                <Link
                  to={`/game/${game.slug}`}
                  className="min-w-0 truncate text-ink no-underline hover:underline"
                >
                  {game.title}
                </Link>
                <span className="shrink-0 text-ink-soft">
                  {game.sales} {game.sales === 1 ? 'sale' : 'sales'} ·{' '}
                  {game.plays} {game.plays === 1 ? 'play' : 'plays'}
                  <b className="tnum ml-3 text-ink">
                    {formatAmount(game.gross.display)}
                  </b>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="mt-5 font-mono text-[11px] leading-relaxed text-ink-soft">
        Worked out from the sales and the splits, every time you open this.
      </p>
    </section>
  )
}

function Figure({
  label,
  value,
  big,
}: {
  label: string
  value: string
  big?: boolean
}) {
  return (
    <div className="rounded-card border-2 border-ink bg-paper-sunk px-4 py-3">
      <span className="label-micro text-ink-soft">{label}</span>
      <p
        className={`mt-1 font-mono tnum font-bold ${
          big ? 'text-2xl text-green' : 'text-xl'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
