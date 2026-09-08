import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Cover } from '@/components/Cover'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { PlayOverlay } from '@/components/play/LightsDown'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { WishlistSection } from '@/components/library/WishlistSection'
import { Receipts } from '@/components/library/Receipts'
import { getGame } from '@/api/games'
import { getLibrary, type WireLibraryGame } from '@/api/library'
import { getAgent } from '@/api/agent'
import { errorMessage } from '@/lib/api'
import { signIn, useSession } from '@/auth/session'
import type { Game } from '@/mocks/types'

/**
 * Games you hold a key for. Presented as ticket stubs rather than store cards,
 * because that is what they are now: something you keep, not something on sale.
 *
 * The list is the server's, checked against the chain rather than against
 * anything this app remembers — so a key that reached this wallet without
 * passing through the store still shows up, which is the ownership claim
 * being true rather than asserted.
 */
export function Library() {
  const session = useSession()
  const [playing, setPlaying] = useState<Game | null>(null)
  const [loaded, setLoaded] = useState<{
    games: WireLibraryGame[]
    error: string | null
  } | null>(null)

  const signedIn = session.signedIn

  useEffect(() => {
    if (!signedIn) return
    const controller = new AbortController()
    getLibrary(controller.signal)
      .then((games) => setLoaded({ games, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({ games: [], error: errorMessage(error) })
      })
    return () => controller.abort()
    // `balanceUnits` moves when a purchase settles, which is the cheapest
    // signal that this list is now out of date.
  }, [signedIn, session.balanceUnits])

  // The stub carries what it needs to identify a game; the play surface wants
  // the whole thing. Fetched on the click rather than up front, so opening
  // this page is one request instead of one per game you own.
  const [opening, setOpening] = useState<string | null>(null)

  function open(game: WireLibraryGame) {
    setOpening(game.id)
    getGame(game.slug)
      .then((full) => {
        if (full) setPlaying(full)
      })
      .finally(() => setOpening(null))
  }

  const owned = loaded?.games

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-page flex-1 px-6 py-9">
        <h1 className="text-[clamp(30px,4.4vw,44px)]">My games</h1>
        <p className="mt-2 max-w-[52ch] font-body text-ink-soft">
          Every key here is in your own wallet. They work whether or not this
          site is still around.
        </p>

        {!signedIn ? (
          // Signed out this page cannot say anything true. An empty grid would
          // read as "you own nothing", which is a claim about a wallet we have
          // not been shown.
          <div className="mt-8 flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-yellow px-7 py-9 shadow-hard md:flex-row md:items-center md:gap-8">
            <Freehand name="lock-key-1" className="h-20 w-20 text-ink" />
            <div className="flex flex-col items-start gap-3">
              <h2 className="text-2xl">Sign in to see your keys.</h2>
              <p className="max-w-[44ch] font-body text-[15px] text-ink">
                They live in your wallet, so we have to know which wallet is
                yours.
              </p>
              <Button variant="neutral" size="sm" onClick={() => signIn()}>
                Sign in
              </Button>
            </div>
          </div>
        ) : loaded?.error ? (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-card border-2 border-ink border-l-8 border-l-red bg-paper-sunk px-7 py-9 shadow-hard md:flex-row md:items-center md:gap-8">
            <Freehand
              name="alerts-stop-sign"
              className="h-20 w-20 shrink-0 text-red"
            />
            <div className="flex flex-col items-start gap-3">
              <h2 className="text-2xl">Your keys would not load.</h2>
              <p className="max-w-[44ch] font-body text-[15px] text-ink">
                {loaded.error}
              </p>
            </div>
          </div>
        ) : owned === undefined ? (
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
                busy={opening === game.id}
                onPlay={() => open(game)}
                style={{ '--i': i } as CSSProperties}
              />
            ))}
          </Reveal>
        )}
        <WishlistSection signedIn={session.signedIn} />

        {/* Wants used to be listed here, back when an agent was one game and a
            trigger. One agent with a shared budget is a thing with its own
            page, and duplicating its list here would give two answers to
            "what is it buying". A pointer, not a copy. */}
        <AgentNote signedIn={session.signedIn} />

        <Receipts signedIn={session.signedIn} />
      </main>

      <SiteFooter />

      {playing ? (
        <PlayOverlay game={playing} onClose={() => setPlaying(null)} />
      ) : null}
    </div>
  )
}

/**
 * A line to the agent page, for anyone who has one.
 *
 * Deliberately small. Games you are *trying* to get still belong beside the
 * ones you got, but the list itself lives with the budget it spends, and two
 * copies of it would be two things to keep in step.
 */
function AgentNote({ signedIn }: { signedIn: boolean }) {
  const [has, setHas] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    const controller = new AbortController()
    getAgent(controller.signal)
      .then(() => setHas(true))
      .catch(() => {
        // A 404 is the normal state: most people have no agent.
      })
    return () => controller.abort()
  }, [signedIn])

  if (!has) return null

  return (
    <section className="mt-12">
      <Link
        to="/agent"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border-2 border-ink bg-blue px-5 py-4 text-paper no-underline shadow-hard transition-transform duration-130 ease-out hover:-translate-y-px"
      >
        <Freehand name="share-radar" className="h-9 w-9 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-wonk text-[17px]">
            Your agent is watching prices for you
          </span>
          <span className="block font-mono text-[11px] text-paper/75">
            What it is trying to buy, and what it has done
          </span>
        </span>
      </Link>
    </section>
  )
}

/** `5400` → `"1h 30m"`. Playtime, never money, so no tabular alignment needed. */
function formatPlaytime(seconds: number): string {
  if (seconds < 60) return 'under a minute'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** The GameKey as a ticket stub, per DESIGN.md §8. */
function KeyStub({
  game,
  busy,
  onPlay,
  style,
}: {
  game: WireLibraryGame
  busy: boolean
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
        {/* Your own hours on this game, not a global counter. Only shown once
            there is something to show; "0 plays" on a game you just bought is
            noise rather than information. */}
        {game.myPlayCount > 0 ? (
          <span className="mt-1 block truncate font-mono text-[11px] text-ink-soft">
            {game.myPlayCount} {game.myPlayCount === 1 ? 'play' : 'plays'}
            {game.myPlaytimeSeconds > 0
              ? ` · ${formatPlaytime(game.myPlaytimeSeconds)}`
              : ''}
          </span>
        ) : null}
        <Button
          variant="go"
          size="sm"
          className="mt-3"
          disabled={busy}
          onClick={onPlay}
        >
          {busy ? 'Opening…' : 'Play'}
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
        {/* The serial is the concrete form of the claim above it: not "we say
            you own this" but "this exact token, number N". */}
        {game.serial !== null ? (
          <span className="font-mono tnum text-[10px] text-paper/75">
            #{game.serial}
          </span>
        ) : null}
      </div>
    </article>
  )
}
