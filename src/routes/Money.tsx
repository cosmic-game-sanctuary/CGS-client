import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { WithdrawPanel } from '@/components/money/WithdrawPanel'
import {
  getMyEarnings,
  type WireOwedRow,
  type WirePersonalEarnings,
} from '@/api/earnings'
import { errorMessage } from '@/lib/api'
import { formatAmount, formatDate } from '@/lib/format'
import { signIn, useSession } from '@/auth/session'

/**
 * What you made, and the way out.
 *
 * The third page behind the profile control, and the first addition to that
 * menu since it was written. It earns the slot by being about something neither
 * of the other two can hold: `/library` is games you hold a key for, and a
 * studio page is one team. Money you are owed is cross-studio by design, since
 * being added to a split by email is exactly what puts one person on games from
 * several teams.
 *
 * Two facts sit side by side at the top and they are not the same number.
 * **Earned** is the sum of your share of every sale ever. **In your wallet** is
 * what is there right now, which is that minus anything you have spent or taken
 * out, and minus anything still held. Showing one and calling it the other is
 * the mistake this layout exists to avoid.
 *
 * Held money has no claim button and shouldn't get one: it goes out on its own
 * the moment the wallet it belongs to has a Hedera account.
 */
export function Money() {
  const session = useSession()
  const [loaded, setLoaded] = useState<{
    userId: string
    report: WirePersonalEarnings | null
    error: string | null
  } | null>(null)

  const userId = session.userId

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    getMyEarnings(controller.signal)
      .then((report) => setLoaded({ userId, report, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({ userId, report: null, error: errorMessage(error) })
      })
    return () => controller.abort()
    // `balanceUnits` moves when a payout lands, which is the cheapest signal
    // that these figures are out of date.
  }, [userId, session.balanceUnits])

  const current = loaded?.userId === userId ? loaded : null

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-page flex-1 px-6 py-9">
        <h1 className="text-[clamp(30px,4.4vw,44px)]">My money</h1>
        <p className="mt-2 max-w-[54ch] font-body text-ink-soft">
          Your share of every sale reaches your wallet as the sale settles.
          Nobody has to approve it, and nothing is held back.
        </p>

        {!session.signedIn ? (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-yellow px-7 py-9 shadow-hard md:flex-row md:items-center md:gap-8">
            <Freehand name="lock-key-1" className="h-20 w-20 text-ink" />
            <div className="flex flex-col items-start gap-3">
              <h2 className="text-2xl">Sign in to see it.</h2>
              <p className="max-w-[44ch] font-body text-[15px] text-ink">
                The money is in your own wallet, so we have to know which wallet
                is yours.
              </p>
              <Button variant="neutral" size="sm" onClick={() => signIn()}>
                Sign in
              </Button>
            </div>
          </div>
        ) : session.error !== null ? (
          // Signed into Privy, but the server will not say who that is. Without
          // this the page sits on a skeleton forever, since every figure below
          // is keyed to a user id that never arrives.
          <div className="mt-8 rounded-card border-2 border-ink border-l-8 border-l-red bg-paper-sunk px-7 py-8">
            <h2 className="text-2xl">We cannot read your account.</h2>
            <p className="mt-2 max-w-[46ch] font-body text-[15px] text-ink-soft">
              {session.error}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <Headline
                label="Earned"
                value={
                  current?.report
                    ? formatAmount(current.report.totals.earned.display)
                    : null
                }
                note={
                  current?.report
                    ? `across ${current.report.totals.games} ${
                        current.report.totals.games === 1 ? 'game' : 'games'
                      }, ${current.report.totals.sales} ${
                        current.report.totals.sales === 1 ? 'sale' : 'sales'
                      }`
                    : 'everything you are credited on'
                }
              />
              <Headline
                label="In your wallet"
                value={formatAmount(session.balanceUsd)}
                note={
                  session.hederaAccountId
                    ? `account ${session.hederaAccountId}`
                    : 'no account on Hedera yet'
                }
                tone="wallet"
              />
            </div>

            {current === null ? (
              <div className="hatch mt-6 h-40 rounded-card border-2 border-ink" />
            ) : current.error !== null ? (
              <div className="mt-6 rounded-card border-2 border-ink border-l-8 border-l-red bg-paper-sunk px-6 py-6">
                <h2 className="text-2xl">Your earnings would not load.</h2>
                <p className="mt-2 max-w-[46ch] font-body text-[15px] text-ink-soft">
                  {current.error}
                </p>
              </div>
            ) : current.report === null ? null : (
              <Report report={current.report} />
            )}

            <WithdrawPanel />
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

function Report({ report }: { report: WirePersonalEarnings }) {
  const { totals, games, held, failed } = report

  return (
    <>
      {held.length > 0 ? (
        <Owed
          rows={held}
          total={totals.held.display}
          title="On its way to you"
          // "Held" now means one thing only: an invite that had not been
          // accepted. A share is paid to the EVM alias directly and HIP-542
          // makes that payment create the account, so nothing waits on a wallet
          // having been used before. Nothing to press, and nothing to explain.
          note="This settles by itself, without anyone pressing anything."
          tone="yellow"
        />
      ) : null}

      {failed.length > 0 ? (
        <Owed
          rows={failed}
          total={totals.failed.display}
          title="Did not go through"
          // Never "try again": there is nothing on this screen a person could
          // press that would help, and pretending otherwise wastes their time.
          note="Still owed, and still recorded. Someone on our side has to send it by hand."
          tone="red"
        />
      ) : null}

      {games.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-paper-sunk px-7 py-9 md:flex-row md:items-center md:gap-8">
          <Freehand
            name="video-game-controller"
            className="h-20 w-20 shrink-0 text-ink"
          />
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-2xl">Nothing credited to you yet.</h2>
            <p className="max-w-[46ch] font-body text-[15px] text-ink-soft">
              Publish something, or get put on the splits of a game somebody
              else is making. Either way the share is yours from the first sale.
            </p>
            <ButtonLink to="/publish" variant="neutral" size="sm">
              Publish a game
            </ButtonLink>
          </div>
        </div>
      ) : (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-2xl">Game by game</h2>
            <span className="font-mono text-[11px] text-ink-soft">
              {formatAmount(totals.gross.display)} taken in altogether
            </span>
          </div>

          <ul className="print-rows mt-4 flex list-none flex-col gap-2 p-0">
            {games.map((game, i) => (
              <li
                key={game.gameId}
                style={{ '--i': i } as CSSProperties}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border-2 border-ink bg-paper px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <Link
                    to={`/game/${game.slug}`}
                    className="block truncate font-wonk text-[15px] text-ink no-underline hover:underline"
                  >
                    {game.title}
                    {game.status !== 'published' ? (
                      <span className="label-micro ml-2 rounded-chip border-2 border-ink bg-paper-sunk px-1.5 py-0.5 text-ink-soft">
                        {game.status === 'draft' ? 'draft' : 'unlisted'}
                      </span>
                    ) : null}
                  </Link>
                  <span className="block truncate font-mono text-[11px] text-ink-soft">
                    {game.yours
                      ? `${game.yours.pct}% as ${game.yours.role}`
                      : game.studio.name}
                    {' · '}
                    {game.sales} {game.sales === 1 ? 'sale' : 'sales'}
                  </span>
                </span>

                <span className="text-right">
                  <span className="label-micro block text-ink-soft">Gross</span>
                  <span className="tnum block font-mono text-[13px]">
                    {formatAmount(game.gross.display)}
                  </span>
                </span>

                <span className="w-24 text-right">
                  <span className="label-micro block text-ink-soft">Yours</span>
                  <span className="tnum block font-mono text-[15px] font-bold text-green">
                    {formatAmount(game.yours?.earned.display ?? 0)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/**
 * Money that is owed and is not in the wallet.
 *
 * Held and failed are different situations with the same shape, so they share a
 * component and differ only in the sentence, which is the part that actually
 * tells them apart.
 */
function Owed({
  rows,
  total,
  title,
  note,
  tone,
}: {
  rows: WireOwedRow[]
  total: number
  title: string
  note: string
  tone: 'yellow' | 'red'
}) {
  return (
    <section
      className={`mt-6 rounded-card border-2 border-ink px-5 py-4 ${
        tone === 'yellow' ? 'bg-yellow' : 'border-l-8 border-l-red bg-paper-sunk'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xl">{title}</h2>
        <span className="tnum font-mono text-lg font-bold">
          {formatAmount(total)}
        </span>
      </div>
      <p className="mt-1.5 max-w-[54ch] font-body text-[14px] leading-relaxed text-ink-soft">
        {note}
      </p>
      <ul className="mt-3 flex list-none flex-col gap-1 border-t-2 border-ink p-0 pt-2.5 font-mono text-[12px]">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap justify-between gap-x-4">
            <span className="min-w-0 truncate">
              {row.gameSlug ? (
                <Link
                  to={`/game/${row.gameSlug}`}
                  className="text-ink no-underline hover:underline"
                >
                  {row.gameTitle ?? 'A game'}
                </Link>
              ) : (
                (row.gameTitle ?? 'A game')
              )}
              <span className="text-ink-soft"> · since {formatDate(row.since)}</span>
            </span>
            <span className="tnum shrink-0 font-bold">
              {formatAmount(row.amount.display)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Headline({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string | null
  note: string
  tone?: 'wallet'
}) {
  return (
    <div
      className={`rounded-card border-2 border-ink px-6 py-5 shadow-hard ${
        tone === 'wallet' ? 'bg-paper' : 'bg-paper-sunk'
      }`}
    >
      <span className="label-micro text-ink-soft">{label}</span>
      {value === null ? (
        <div className="hatch mt-2 h-10 w-40 rounded-card border-2 border-ink" />
      ) : (
        <p
          className={`mt-1 font-mono tnum text-[clamp(28px,4vw,40px)] leading-none font-bold ${
            tone === 'wallet' ? 'text-ink' : 'text-green'
          }`}
        >
          {value}
        </p>
      )}
      <p className="mt-2 font-mono text-[11px] text-ink-soft">{note}</p>
    </div>
  )
}
