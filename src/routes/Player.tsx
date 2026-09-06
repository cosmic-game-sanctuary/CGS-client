import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PLAY_BEATS } from '@/components/play/beats'
import { LightsDown } from '@/components/play/LightsDown'
import { ButtonLink } from '@/components/ui/Button'
import { getGame } from '@/api/games'
import { getDownload, mountGrant, type AccessGrant } from '@/api/purchase'
import { useSession } from '@/auth/session'
import type { Game } from '@/mocks/types'

/**
 * Permalink for a game you already own. The purchase itself never comes
 * through here — that plays out in the checkout overlay without a navigation,
 * which is the whole point (see CheckoutOverlay).
 *
 * Ownership is decided by the server, not by anything this tab remembers. The
 * download call is ownership-checked and returns nothing to play when you
 * aren't entitled, so it answers "do you own this" and "where is the build" in
 * one question, and it still answers correctly after a reload.
 */
export function Player() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const session = useSession()

  const [loaded, setLoaded] = useState<{
    slug: string
    signedIn: boolean
    game: Game | undefined
    grant: AccessGrant | null
  } | null>(null)

  useEffect(() => {
    // Nothing is knowable until Privy has restored the session: asking now
    // would ask anonymously and gate someone out of their own game.
    if (!session.ready) return

    let live = true
    const signedIn = session.signedIn

    void (async () => {
      const game = await getGame(slug)
      const grant = game ? await getDownload(game.id).catch(() => null) : null
      if (live) setLoaded({ slug, signedIn, game, grant })
    })()

    return () => {
      live = false
    }
  }, [slug, session.ready, session.signedIn])

  const current =
    loaded?.slug === slug && loaded.signedIn === session.signedIn ? loaded : null

  if (!current) return <div className="min-h-screen bg-night" />

  const { game, grant } = current

  if (!game) {
    return <Gate title="That game isn’t here." to="/" cta="Back to catalog" />
  }

  if (!grant) {
    return (
      <Gate
        title={
          session.signedIn
            ? 'You don’t own this one yet.'
            : 'Sign in to play what you own.'
        }
        to={`/game/${game.slug}`}
        cta={`Open ${game.title}`}
      />
    )
  }

  return (
    <Stage game={game} grant={grant} onExit={() => navigate(`/game/${game.slug}`)} />
  )
}

/**
 * Already dark, so the wipe is invisible here. The beats still run, so a
 * permalink boots the same way a click from the store does. The work is already
 * done by the time they start, which leaves them running on their floors.
 */
function Stage({
  game,
  grant,
  onExit,
}: {
  game: Game
  grant: AccessGrant
  onExit: () => void
}) {
  const [playUrl, setPlayUrl] = useState<string | null>(null)

  const beats = useMemo(
    () =>
      PLAY_BEATS({
        boot: async (report) => setPlayUrl(await mountGrant(grant, report)),
      }),
    [grant],
  )

  return (
    <div className="relative h-screen bg-night">
      <LightsDown game={game} beats={beats} playUrl={playUrl} onExit={onExit} />
    </div>
  )
}

function Gate({ title, to, cta }: { title: string; to: string; cta: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-night px-6 text-paper">
      <h1 className="text-3xl text-paper">{title}</h1>
      <ButtonLink to={to} variant="neutral" size="md">
        {cta}
      </ButtonLink>
    </div>
  )
}
