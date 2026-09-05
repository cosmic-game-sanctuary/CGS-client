import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PLAY_BEATS } from '@/components/play/beats'
import { LightsDown } from '@/components/play/LightsDown'
import { ButtonLink } from '@/components/ui/Button'
import { getGame } from '@/mocks/games'
import { useSession } from '@/mocks/session'
import type { Game } from '@/mocks/types'

/**
 * Permalink for a game you already own. The purchase itself never comes
 * through here — that plays out in the checkout overlay without a navigation,
 * which is the whole point (see CheckoutOverlay).
 */
export function Player() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const [loaded, setLoaded] = useState<{
    slug: string
    game: Game | undefined
  } | null>(null)

  useEffect(() => {
    let live = true
    getGame(slug).then((game) => {
      if (live) setLoaded({ slug, game })
    })
    return () => {
      live = false
    }
  }, [slug])

  const game = loaded?.slug === slug ? loaded.game : null

  if (game === null) {
    return <div className="min-h-screen bg-night" />
  }

  if (game === undefined) {
    return <Gate title="That game isn’t here." to="/" cta="Back to catalog" />
  }

  if (!session.ownedGameIds.includes(game.id)) {
    return (
      <Gate
        title="You don’t own this one yet."
        to={`/game/${game.slug}`}
        cta={`Open ${game.title}`}
      />
    )
  }

  // Already dark, so the wipe is invisible here. The beats still run, so a
  // permalink boots the same way a click from the store does.
  return (
    <div className="relative h-screen bg-night">
      <LightsDown
        game={game}
        beats={PLAY_BEATS}
        onExit={() => navigate(`/game/${game.slug}`)}
      />
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
