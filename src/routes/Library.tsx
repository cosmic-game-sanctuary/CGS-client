import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Cover } from '@/components/Cover'
import { Freehand } from '@/components/icons/Freehand'
import { PriceChip } from '@/components/ui/PriceChip'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { PlayOverlay } from '@/components/play/LightsDown'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { useAgents } from '@/mocks/agent'
import { listGames } from '@/mocks/games'
import { formatPrice } from '@/lib/format'
import { useSession } from '@/auth/session'
import type { Game } from '@/mocks/types'

/**
 * Games you hold a key for. Presented as ticket stubs rather than store cards,
 * because that is what they are now: something you keep, not something on sale.
 */
export function Library() {
  const session = useSession()
  const [playing, setPlaying] = useState<Game | null>(null)
  const [all, setAll] = useState<Game[] | null>(null)
  const agents = useAgents()

  useEffect(() => {
    let live = true
    listGames().then((games) => {
      if (live) setAll(games)
    })
    return () => {
      live = false
    }
  }, [])

  const owned = all?.filter((game) => session.ownedGameIds.includes(game.id))
  // A trigger is a game you're trying to get, so it belongs beside the ones
  // you got. This is why there is no separate agents page.
  const watching = agents
    .filter((agent) => agent.status === 'watching')
    .map((agent) => ({
      agent,
      game: all?.find((game) => game.id === agent.gameId),
    }))
    .filter((row) => row.game !== undefined)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-page flex-1 px-6 py-9">
        <h1 className="text-[clamp(30px,4.4vw,44px)]">Your games</h1>
        <p className="mt-2 max-w-[52ch] font-body text-ink-soft">
          Every key here is in your own wallet. They work whether or not this
          site is still around.
        </p>

        {owned === undefined ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="hatch h-36 rounded-card border-2 border-ink"
              />
            ))}
          </div>
        ) : owned.length === 0 ? (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-yellow px-7 py-9 shadow-hard md:flex-row md:items-center md:gap-8">
            <Freehand name="lock-key-1" className="h-20 w-20 text-ink" />
            <div className="flex flex-col items-start gap-3">
              <h2 className="text-2xl">No keys yet.</h2>
              <p className="max-w-[44ch] font-body text-[15px] text-ink">
                Buy anything, free games included, and it turns up here.
              </p>
              <ButtonLink to="/" variant="neutral" size="sm">
                Browse the catalog
              </ButtonLink>
            </div>
          </div>
        ) : (
          <Reveal className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map((game, i) => (
              <KeyStub
                key={game.id}
                game={game}
                onPlay={() => setPlaying(game)}
                style={{ '--i': i } as CSSProperties}
              />
            ))}
          </Reveal>
        )}
        {watching.length > 0 ? (
          <section className="mt-12">
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl">Waiting on a price</h2>
              <span className="font-mono text-[11px] text-ink-soft">
                {watching.length} agent{watching.length === 1 ? '' : 's'} watching
              </span>
            </div>
            <ul className="mt-4 flex list-none flex-col gap-2.5 p-0">
              {watching.map(({ agent, game }) => (
                <li key={agent.id}>
                  <Link
                    to={`/game/${game!.slug}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border-2 border-ink bg-blue px-4 py-3 text-paper no-underline transition-transform duration-130 ease-out hover:-translate-y-px"
                  >
                    <Freehand name="share-radar" className="h-8 w-8 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-wonk text-[15px]">
                        {game!.title}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-paper/75">
                        buys below {formatPrice(agent.triggerUsd)}, holds{' '}
                        {formatPrice(agent.balanceUsd)}
                      </span>
                    </span>
                    <PriceChip usd={game!.priceUsd} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <SiteFooter />

      {playing ? (
        <PlayOverlay game={playing} onClose={() => setPlaying(null)} />
      ) : null}
    </div>
  )
}

/** The GameKey as a ticket stub, per DESIGN.md §8. */
function KeyStub({
  game,
  onPlay,
  style,
}: {
  game: Game
  onPlay: () => void
  style?: CSSProperties
}) {
  return (
    <article
      style={style}
      className="group relative grid grid-cols-[1fr_84px] overflow-hidden rounded-card border-2 border-ink bg-paper shadow-hard transition-[transform,box-shadow] duration-220 ease-land hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg"
    >
      <span className="absolute -top-2 right-[77px] h-3.5 w-3.5 rounded-full border-2 border-ink bg-paper-sunk" />
      <span className="absolute -bottom-2 right-[77px] h-3.5 w-3.5 rounded-full border-2 border-ink bg-paper-sunk" />

      <div className="min-w-0 p-4">
        <div className="h-16 w-24 overflow-hidden rounded-md border-2 border-ink">
          <Cover game={game} className="h-full" />
        </div>
        <Link
          to={`/game/${game.slug}`}
          className="mt-2.5 block truncate font-wonk text-lg text-ink no-underline"
        >
          {game.title}
        </Link>
        <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-soft">
          {game.studio.ens ?? game.studio.name}
        </span>
        <Button variant="go" size="sm" className="mt-3" onClick={onPlay}>
          Play
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 border-l-2 border-dashed border-ink bg-green p-2 text-paper">
        <Freehand
          name="lock-key-1"
          className="h-9 w-9 transition-transform duration-500 ease-pop group-hover:-rotate-[32deg]"
        />
        <span className="label-micro text-center leading-tight">
          Yours
          <br />
          on-chain
        </span>
      </div>
    </article>
  )
}
