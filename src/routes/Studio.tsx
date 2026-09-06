import { ArrowLeft } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GameCard, GameCardSkeleton } from '@/components/GameCard'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { Sticker } from '@/components/ui/Sticker'
import { compactCount, formatDate, truncateAddress } from '@/lib/format'
import { getStudio, listGamesByStudio } from '@/api/games'
import { studioCredits } from '@/lib/credits'
import { useSession } from '@/auth/session'
import type { Game, Studio as StudioType } from '@/mocks/types'

/**
 * Studio profile — their games, their ENS name, and who's actually in the team.
 *
 * The credits list is derived from the splits across everything they shipped,
 * which is more honest than a members table and is the same data the listing
 * page already shows publicly.
 */
export function Studio() {
  const { id = '' } = useParams()
  const session = useSession()
  const [loaded, setLoaded] = useState<{
    id: string
    studio: StudioType | undefined
    games: Game[]
  } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getStudio(id, controller.signal)
      .then(async (profile) => {
        if (!profile) {
          setLoaded({ id, studio: undefined, games: [] })
          return
        }
        // The studio route answers by slug too, so the id in the URL may not
        // be the one games are filtered by. Use the resolved one.
        const games = await listGamesByStudio(
          profile.studio.id,
          controller.signal,
        )
        setLoaded({ id, studio: profile.studio, games })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setLoaded({ id, studio: undefined, games: [] })
      })
    return () => controller.abort()
  }, [id])

  const ready = loaded?.id === id ? loaded : null

  if (!ready) return <StudioLoading />
  if (!ready.studio) return <StudioNotFound />

  const { studio, games } = ready
  const isMine = session.studioId === studio.id
  const credits = studioCredits(games)
  const plays = games.reduce((sum, game) => sum + game.plays, 0)
  const rated = games.filter((game) => game.reviewCount > 0)
  const rating = rated.length
    ? rated.reduce((sum, game) => sum + game.rating, 0) / rated.length
    : 0
  const since = games.length
    ? games[games.length - 1].publishedAt
    : new Date().toISOString()

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <section className="border-b-2 border-ink bg-paper-sunk">
        <div className="mx-auto max-w-page px-6 py-9">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] tracking-wider text-ink-soft uppercase no-underline hover:text-ink"
          >
            <ArrowLeft size={14} strokeWidth={2.5} />
            Back to catalog
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
            <div className="min-w-0">
              {isMine ? (
                <Sticker className="mb-3 -rotate-2">Your studio</Sticker>
              ) : null}
              <h1 className="text-[clamp(30px,4.6vw,48px)]">{studio.name}</h1>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {studio.ens ? (
                  <span className="rounded-chip border-2 border-ink bg-paper px-3 py-1 font-mono text-[13px] font-semibold">
                    {studio.ens}
                  </span>
                ) : null}
                {studio.address ? (
                  <span
                    className="font-mono text-[11px] text-ink-soft"
                    title={studio.address}
                  >
                    {truncateAddress(studio.address)}
                  </span>
                ) : null}
              </div>

              {studio.bio ? (
                <p className="mt-4 max-w-[54ch] font-body text-[17px] leading-relaxed text-ink-soft">
                  {studio.bio}
                </p>
              ) : null}
            </div>

            <dl className="flex shrink-0 flex-wrap gap-x-8 gap-y-3">
              <Stat label="Games" value={String(games.length)} />
              <Stat label="Plays" value={compactCount(plays)} />
              <Stat
                label="Rating"
                value={rating ? rating.toFixed(1) : 'None'}
              />
              <Stat label="Since" value={formatDate(since)} />
            </dl>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-page flex-1 px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section>
            <h2 className="mb-5 text-2xl">
              {isMine
                ? games.length === 1
                  ? 'Your game'
                  : 'Your games'
                : games.length === 1
                  ? 'Their game'
                  : 'Their games'}
            </h2>

            {games.length === 0 ? (
              <div className="flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-yellow px-7 py-9 shadow-hard md:flex-row md:items-center md:gap-8">
                <Freehand
                  name="video-game-controller"
                  className="h-20 w-20 text-ink"
                />
                <div>
                  <h3 className="text-2xl">Nothing published yet.</h3>
                  <p className="mt-2 max-w-[42ch] font-body text-[15px] text-ink">
                    {isMine
                      ? 'Your name is claimed. Drop a build in and it’s on the shelf in four steps.'
                      : 'This studio has claimed its name but hasn’t shipped anything.'}
                  </p>
                </div>
              </div>
            ) : (
              <Reveal className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-5">
                {games.map((game, i) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    style={{ '--i': i } as CSSProperties}
                  />
                ))}
              </Reveal>
            )}
          </section>

          <aside className="flex flex-col gap-6">
            <section className="rounded-card border-2 border-ink bg-paper p-5 shadow-hard">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="label-micro text-ink-soft">Credits</span>
                  <h3 className="mt-1.5 text-xl">
                    {credits.length === 1
                      ? 'One person'
                      : `${credits.length} people`}
                  </h3>
                </div>
                <Freehand
                  name="business-deal-handshake"
                  className="h-11 w-11 shrink-0 text-green"
                />
              </div>

              <ul className="mt-4 flex list-none flex-col gap-3 p-0">
                {credits.map((person) => (
                  <li key={person.handle} className="min-w-0">
                    <span className="block truncate font-mono text-[13px] font-semibold">
                      {person.handle}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-ink-soft">
                      {person.roles.join(', ')} · {person.games}{' '}
                      {person.games === 1 ? 'game' : 'games'}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 border-t-2 border-ink pt-3 font-mono text-[11px] text-ink-soft">
                Taken from the splits on everything they published.
              </p>
            </section>

            <ButtonLink to="/publish" variant={isMine ? 'primary' : 'neutral'}>
              {isMine ? 'Publish a game' : 'Publish your own'}
            </ButtonLink>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-micro text-ink-soft">{label}</dt>
      <dd className="mt-1 font-mono tnum text-lg font-bold">{value}</dd>
    </div>
  )
}

function StudioLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <section className="border-b-2 border-ink bg-paper-sunk">
        <div className="mx-auto flex max-w-page flex-col gap-3 px-6 py-9">
          <div className="hatch h-11 w-72 rounded-card border-2 border-ink" />
          <div className="hatch h-5 w-96 max-w-full rounded-card border-2 border-ink" />
        </div>
      </section>
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-10">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-5">
          {[0, 1, 2, 3].map((i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function StudioNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-16">
        <div className="flex flex-col items-start gap-5 rounded-card border-2 border-ink bg-yellow px-8 py-10 shadow-hard md:flex-row md:items-center md:gap-8">
          <Freehand name="alerts-stop-sign" className="h-20 w-20 text-ink" />
          <div className="flex flex-col items-start gap-3">
            <h1 className="text-3xl">No studio here.</h1>
            <p className="max-w-[44ch] font-body leading-relaxed">
              The name may have changed hands, or the link is wrong.
            </p>
            <ButtonLink to="/" variant="neutral" size="sm">
              Back to catalog
            </ButtonLink>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
