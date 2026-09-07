import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PriceChip } from '@/components/ui/PriceChip'
import { EditListing } from '@/components/manage/EditListing'
import { ShipBuild } from '@/components/manage/ShipBuild'
import { PriceHistory } from '@/components/manage/PriceHistory'
import { MediaManager } from '@/components/manage/MediaManager'
import {
  getManageView,
  relistGame,
  unpublishGame,
  type WireManageView,
} from '@/api/manage'
import { errorMessage } from '@/lib/api'
import { compactCount, formatPrice } from '@/lib/format'
import { useSession } from '@/auth/session'

/**
 * The developer's side of their own listing.
 *
 * A published game used to be frozen: no price change, no typo fix, no new
 * build, no way to take your own work down. This is all of that, on one screen,
 * because they are the same job — looking after a thing you shipped.
 *
 * Not part of the information architecture behind the profile menu. You reach
 * it from the listing you are looking at, because managing a game is something
 * you do to a specific game rather than a place you go.
 */
export function ManageGame() {
  const { slug = '' } = useParams()
  const session = useSession()
  const [loaded, setLoaded] = useState<{
    slug: string
    view: WireManageView | null
    error: string | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const reloadRef = useRef(0)

  useEffect(() => {
    if (!session.ready) return
    const controller = new AbortController()
    getManageView(slug, controller.signal)
      .then((view) => setLoaded({ slug, view, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({ slug, view: null, error: errorMessage(error) })
      })
    return () => controller.abort()
  }, [slug, session.ready, session.signedIn])

  function reload() {
    reloadRef.current += 1
    void getManageView(slug)
      .then((view) => setLoaded({ slug, view, error: null }))
      .catch(() => {})
  }

  const current = loaded?.slug === slug ? loaded : null

  if (current === null) {
    return (
      <Shell>
        <div className="hatch mt-8 h-64 rounded-card border-2 border-ink" />
      </Shell>
    )
  }

  if (!current.view) {
    return (
      <Shell>
        <div className="mt-8 flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-paper-sunk px-7 py-9">
          <h1 className="text-3xl">Not yours to manage.</h1>
          <p className="max-w-[48ch] font-body text-ink-soft">
            {current.error ??
              'Only the studio behind a game can change its listing.'}
          </p>
          <ButtonLink to={`/game/${slug}`} variant="neutral" size="sm">
            Back to the listing
          </ButtonLink>
        </div>
      </Shell>
    )
  }

  const { game, stats, builds, priceHistory, media } = current.view
  const live = game.status === 'published'

  async function setListed(next: boolean) {
    setBusy(true)
    setProblem(null)
    try {
      if (next) await relistGame(game.id)
      else await unpublishGame(game.id)
      reload()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="label-micro text-ink-soft">Managing</span>
          <h1 className="text-[clamp(28px,4vw,40px)]">{game.title}</h1>
          <p className="mt-1 font-mono text-[13px] text-ink-soft">
            <Link to={`/game/${game.slug}`} className="no-underline hover:underline">
              /game/{game.slug}
            </Link>
            <span className="mx-2 text-ink-faint">·</span>
            {live ? 'Live in the catalog' : 'Not listed'}
            {game.buildVersion ? (
              <>
                <span className="mx-2 text-ink-faint">·</span>v{game.buildVersion}
              </>
            ) : null}
          </p>
        </div>
        <PriceChip usd={game.priceUsd} size="lg" />
      </div>

      {/* The numbers a developer actually checks, and one they would rather
          not have to: money that never reached the people on the splits. */}
      <dl className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Sales" value={`${stats.sales}`} />
        <Stat label="Earned" value={formatPrice(stats.grossUsd)} mono />
        <Stat label="Owners" value={`${stats.owners}`} />
        <Stat label="Plays" value={compactCount(stats.plays)} />
        <Stat label="Rating" value={stats.rating ? stats.rating.toFixed(1) : '—'} />
        <Stat
          label="Waiting"
          value={`${stats.wishlisted ?? 0}`}
          hint="on the wishlist"
        />
      </dl>

      {stats.unsettledSplits > 0 ? (
        <p className="mt-4 rounded-card border-2 border-ink bg-yellow px-4 py-3 font-body text-[15px] text-ink shadow-hard-sm">
          <b>
            {stats.unsettledSplits} sale
            {stats.unsettledSplits === 1 ? '' : 's'} still owe someone.
          </b>{' '}
          Their share is held until they open the site and their wallet gets an
          account. Nothing is lost, and nobody has to chase it.
        </p>
      ) : null}

      <EditListing view={current.view} onSaved={reload} />

      <MediaManager game={game} media={media} onChanged={reload} />

      <ShipBuild game={game} builds={builds} onShipped={reload} />

      <PriceHistory
        history={priceHistory}
        decimals={game.priceAssetDecimals}
      />

      <section className="mt-10">
        <h2 className="text-2xl">{live ? 'Take it down' : 'Put it back'}</h2>
        <p className="mt-2 max-w-[58ch] font-body text-[15px] leading-relaxed text-ink-soft">
          {live
            ? 'Unlisting removes it from the catalog. Everyone who already bought it keeps their key and can still play, which is the whole point of the key.'
            : 'Relisting puts it back in the catalog at its current price.'}
        </p>
        <Button
          variant={live ? 'neutral' : 'go'}
          className="mt-4"
          disabled={busy}
          onClick={() => void setListed(!live)}
        >
          {busy ? 'Working…' : live ? 'Unlist this game' : 'Relist it'}
        </Button>
        {problem ? (
          <p role="alert" className="mt-3 font-body text-sm text-red">
            {problem}
          </p>
        ) : null}
      </section>

      <p className="mt-10 font-mono text-[11px] text-ink-soft">
        Splits are locked at publish and are not editable here, on purpose.
      </p>
    </Shell>
  )
}

function Stat({
  label,
  value,
  hint,
  mono,
}: {
  label: string
  value: string
  hint?: string
  mono?: boolean
}) {
  return (
    <div className="rounded-card border-2 border-ink bg-paper px-4 py-3 shadow-hard-sm">
      <dt className="label-micro text-ink-soft">{label}</dt>
      <dd className={mono ? 'tnum font-mono text-xl font-bold' : 'text-xl font-bold'}>
        {value}
      </dd>
      {hint ? (
        <span className="font-mono text-[10px] text-ink-faint">{hint}</span>
      ) : null}
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
