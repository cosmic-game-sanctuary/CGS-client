import { ArrowLeft, Flag, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CoverArt } from '@/components/CoverArt'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { SplitBar } from '@/components/SplitBar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PriceChip } from '@/components/ui/PriceChip'
import { Sticker } from '@/components/ui/Sticker'
import {
  compactCount,
  displayIdentity,
  formatDate,
  formatPrice,
  timeAgo,
  truncateAddress,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { CheckoutOverlay } from '@/components/checkout/CheckoutOverlay'
import { getGame, getReviews } from '@/mocks/games'
import { useSession } from '@/mocks/session'
import type { Game, Review } from '@/mocks/types'

export function GameListing() {
  const { slug = '' } = useParams()
  const session = useSession()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  // Both results carry the id they were fetched for; anything stale reads as
  // loading during render rather than being cleared inside the effect.
  const [loaded, setLoaded] = useState<{
    slug: string
    game: Game | undefined
  } | null>(null)
  const [loadedReviews, setLoadedReviews] = useState<{
    gameId: string
    reviews: Review[]
  } | null>(null)

  useEffect(() => {
    let live = true
    getGame(slug).then((found) => {
      if (!live) return
      setLoaded({ slug, game: found })
      if (!found) return
      getReviews(found.id).then((reviews) => {
        if (live) setLoadedReviews({ gameId: found.id, reviews })
      })
    })
    return () => {
      live = false
    }
  }, [slug])

  // null = still loading, undefined = no such game
  const game = loaded?.slug === slug ? loaded.game : null

  if (game === null) return <ListingLoading />
  if (game === undefined) return <ListingNotFound />

  const reviews =
    loadedReviews?.gameId === game.id ? loadedReviews.reviews : null

  const owned = session.ownedGameIds.includes(game.id)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-page flex-1 px-6 py-8">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] tracking-wider text-ink-soft uppercase no-underline hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Back to catalog
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          {/* Cover */}
          <div className="overflow-hidden rounded-card border-[3px] border-ink shadow-hard-lg">
            <CoverArt seed={game.coverSeed} title={`${game.title} cover art`} />
          </div>

          {/* Buy panel */}
          <div className="flex flex-col gap-5">
            <div>
              {game.sticker ? (
                <Sticker className="mb-3 -rotate-2">
                  {game.sticker === 'new'
                    ? 'New'
                    : game.sticker === 'jam'
                      ? 'Jam'
                      : 'Updated'}
                </Sticker>
              ) : null}
              <h1 className="text-[clamp(32px,4.4vw,46px)]">{game.title}</h1>
              <p className="mt-2 font-body text-[17px] leading-snug text-ink-soft">
                {game.tagline}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono text-xs text-ink-soft">by</span>
              <Link
                to={`/studio/${game.studio.id}`}
                className="font-mono text-[13px] font-semibold text-ink underline decoration-2 underline-offset-2"
              >
                {displayIdentity({
                  ens: game.studio.ens,
                  name: game.studio.name,
                  address: game.studio.address,
                })}
              </Link>
              <span className="font-mono text-[11px] text-ink-soft">
                {game.studio.memberCount === 1
                  ? '1 person'
                  : `${game.studio.memberCount} people`}
              </span>
            </div>

            <Rating rating={game.rating} count={game.reviewCount} />

            <div className="rounded-card border-2 border-ink bg-paper-sunk p-5 shadow-hard">
              <div className="flex items-center justify-between gap-4">
                <PriceChip usd={game.priceUsd} size="lg" />
                <span className="label-micro text-ink-soft">
                  {game.priceUsd === 0 ? 'Still yours to keep' : 'USDC'}
                </span>
              </div>

              {owned ? (
                <>
                  <ButtonLink
                    to={`/play/${game.slug}`}
                    variant="go"
                    size="lg"
                    className="mt-4 w-full"
                  >
                    Play now
                  </ButtonLink>
                  <p className="mt-3 flex items-center gap-2 font-mono text-[11px] text-green">
                    <Freehand name="lock-key-1" className="h-4 w-4" />
                    You own this. The key is in your wallet.
                  </p>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    className="mt-4 w-full"
                    onClick={() => setCheckoutOpen(true)}
                  >
                    {game.priceUsd === 0
                      ? 'Get it free · play now'
                      : `Buy · ${formatPrice(game.priceUsd)}`}
                  </Button>
                  <p className="mt-3 font-body text-[13px] leading-relaxed text-ink-soft">
                    Starts in this tab. No install. All sales final.
                  </p>
                </>
              )}

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t-2 border-ink pt-3 font-mono text-[11px] text-ink-soft">
                <span>{compactCount(game.plays)} plays</span>
                <span className="tnum">
                  {(game.buildKb / 1024).toFixed(1)} MB
                </span>
                <span>Published {formatDate(game.publishedAt)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {game.tags.map((tag) => (
                <span
                  key={tag}
                  className="label-micro rounded-chip border-2 border-ink bg-paper px-2.5 py-1 text-ink-soft"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* About + splits */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <section>
            <h2 className="text-2xl">About</h2>
            <div className="mt-4 flex max-w-[66ch] flex-col gap-4">
              {game.description.split('\n\n').map((para) => (
                <p key={para.slice(0, 24)} className="font-body leading-relaxed">
                  {para}
                </p>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-2xl">Reviews</h2>
              <p className="mt-2 font-body text-sm text-ink-soft">
                Only people who own this game can post one.
              </p>
              <ReviewList reviews={reviews} />
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            {/* Splits — public, because buyers should see where the money goes */}
            <section className="rounded-card border-2 border-ink bg-paper p-5 shadow-hard">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="label-micro text-ink-soft">
                    Where your money goes
                  </span>
                  <h3 className="mt-1.5 text-xl">
                    {game.splits.length === 1
                      ? 'One person'
                      : `Split ${game.splits.length} ways`}
                  </h3>
                </div>
                <Freehand
                  name="business-deal-handshake"
                  className="h-11 w-11 text-green"
                />
              </div>

              <SplitBar splits={game.splits} className="mt-4" />

              <p className="mt-4 border-t-2 border-ink pt-3 font-mono text-[11px] text-ink-soft">
                {game.splits.length === 1
                  ? 'Paid in full, the minute you buy.'
                  : 'Locked at publish. Every sale divides automatically.'}
              </p>
            </section>

            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 self-start rounded-chip border-2 border-ink bg-paper px-3 py-1.5 font-mono text-[11px] text-ink-soft transition-transform duration-130 hover:-translate-y-px hover:text-pink active:translate-y-px"
            >
              <Flag size={13} strokeWidth={2.5} />
              Report this game
            </button>
          </aside>
        </div>
      </main>

      <SiteFooter />

      {checkoutOpen ? (
        <CheckoutOverlay game={game} onClose={() => setCheckoutOpen(false)} />
      ) : null}
    </div>
  )
}

function Rating({ rating, count }: { rating: number; count: number }) {
  const rounded = Math.round(rating)
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={16}
            strokeWidth={2.5}
            className={cn(n <= rounded ? 'fill-yellow text-ink' : 'text-ink-faint')}
          />
        ))}
      </span>
      <span className="font-mono tnum text-[13px] font-semibold">
        {rating.toFixed(1)}
      </span>
      <span className="font-mono text-[11px] text-ink-soft">
        {count} verified {count === 1 ? 'review' : 'reviews'}
      </span>
    </div>
  )
}

function ReviewList({ reviews }: { reviews: Review[] | null }) {
  if (reviews === null) {
    return (
      <div className="mt-5 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="hatch h-24 rounded-card border-2 border-ink"
          />
        ))}
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <p className="mt-5 rounded-card border-2 border-dashed border-ink-faint px-5 py-6 font-body text-sm text-ink-soft">
        No reviews yet. The first one has to come from someone who owns it.
      </p>
    )
  }

  return (
    <ul className="mt-5 flex list-none flex-col gap-3 p-0">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="rounded-card border-2 border-ink bg-paper p-4"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="font-mono text-[13px] font-semibold"
              title={review.authorIsEns ? undefined : review.author}
            >
              {review.authorIsEns
                ? review.author
                : truncateAddress(review.author)}
            </span>
            <span className="label-micro rounded-chip border-2 border-ink bg-green px-2 py-0.5 text-paper">
              Verified purchase
            </span>
            <span className="ml-auto font-mono text-[11px] text-ink-soft">
              {timeAgo(review.createdAt)}
            </span>
          </div>
          <div className="mt-2 flex gap-0.5" aria-label={`${review.rating} out of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={13}
                strokeWidth={2.5}
                className={cn(
                  n <= review.rating ? 'fill-yellow text-ink' : 'text-ink-faint',
                )}
              />
            ))}
          </div>
          <p className="mt-2.5 max-w-[62ch] font-body text-[15px] leading-relaxed">
            {review.body}
          </p>
        </li>
      ))}
    </ul>
  )
}

function ListingLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="hatch aspect-4/3 rounded-card border-[3px] border-ink" />
          <div className="flex flex-col gap-4">
            <div className="hatch h-12 w-3/4 rounded-card border-2 border-ink" />
            <div className="hatch h-5 w-1/2 rounded-card border-2 border-ink" />
            <div className="hatch h-40 rounded-card border-2 border-ink" />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function ListingNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-16">
        <div className="flex flex-col items-start gap-5 rounded-card border-2 border-ink bg-yellow px-8 py-10 shadow-hard md:flex-row md:items-center md:gap-8">
          <Freehand name="alerts-stop-sign" className="h-20 w-20 text-ink" />
          <div className="flex flex-col items-start gap-3">
            <h1 className="text-3xl">That game isn&rsquo;t here.</h1>
            <p className="max-w-[46ch] font-body leading-relaxed">
              The link may be wrong, or the game was pulled after a report. If
              you bought it, your key still works and the game is in your
              library.
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
