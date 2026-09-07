import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Cover } from '@/components/Cover'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink } from '@/components/ui/Button'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import { getProfile, type WireUserProfile } from '@/api/profiles'
import { compactCount, formatDate } from '@/lib/format'
import { useSession } from '@/auth/session'

/**
 * A person, publicly.
 *
 * The section that earns this page is **credits**. Steam names a publisher and
 * itch names an uploader; this names everyone who made a thing and says what
 * each of them is paid, on a page anyone can open. That is the product's whole
 * argument about splits, made about a person instead of about a game.
 *
 * No email, ever, including on your own page. The page is public and the email
 * is not, and the only way that stays true is for the API never to send it.
 */
export function Profile() {
  const { handle = '' } = useParams()
  const session = useSession()
  const [loaded, setLoaded] = useState<{
    handle: string
    profile: WireUserProfile | null
  } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getProfile(handle, controller.signal)
      .then((profile) => setLoaded({ handle, profile }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ handle, profile: null })
      })
    return () => controller.abort()
    // Signing in changes `isSelf` and can reveal a private library.
  }, [handle, session.signedIn])

  const current = loaded?.handle === handle ? loaded : null

  if (current === null) {
    return (
      <Shell>
        <div className="hatch mt-8 h-48 rounded-card border-2 border-ink" />
      </Shell>
    )
  }

  if (!current.profile) {
    return (
      <Shell>
        <div className="mt-8 flex flex-col items-start gap-4 rounded-card border-2 border-ink bg-paper-sunk px-7 py-9">
          <h1 className="text-3xl">Nobody here.</h1>
          <p className="max-w-[46ch] font-body text-ink-soft">
            There is no profile at <span className="font-mono">/u/{handle}</span>.
          </p>
          <ButtonLink to="/" variant="neutral" size="sm">
            Back to catalog
          </ButtonLink>
        </div>
      </Shell>
    )
  }

  const p = current.profile
  const reload = () =>
    void getProfile(handle).then((profile) => setLoaded({ handle, profile }))

  return (
    <Shell>
      <header className="mt-8 flex flex-wrap items-start gap-5">
        <Avatar src={p.avatarUrl} name={p.label} size={84} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(28px,4vw,40px)]">{p.label}</h1>
          <p className="mt-1 font-mono text-[13px] text-ink-soft">
            @{p.handle ?? p.addressShort}
            <span className="mx-2 text-ink-faint">·</span>
            Joined {formatDate(p.joinedAt)}
          </p>
          {p.bio ? (
            <p className="mt-3 max-w-[60ch] font-body leading-relaxed">
              {p.bio}
            </p>
          ) : null}
        </div>
        {p.isSelf ? <ProfileEditor profile={p} onSaved={reload} /> : null}
      </header>

      <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-2 rounded-card border-2 border-ink bg-paper-sunk px-5 py-3.5 font-mono text-[13px]">
        <Stat label="Credited on" value={`${p.stats.gamesCredited}`} />
        <Stat
          label="Owns"
          value={p.stats.gamesOwned === null ? 'private' : `${p.stats.gamesOwned}`}
        />
        <Stat label="Reviews" value={`${p.stats.reviewCount}`} />
        <Stat label="Plays" value={compactCount(p.stats.playCount)} />
      </dl>

      {p.studios.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Studios</h2>
          <ul className="mt-4 flex list-none flex-wrap gap-2.5 p-0">
            {p.studios.map((studio) => (
              <li key={studio.id}>
                <Link
                  to={`/studio/${studio.slug}`}
                  className="flex items-center gap-2 rounded-chip border-2 border-ink bg-paper px-3.5 py-1.5 font-mono text-[13px] no-underline shadow-hard-sm hover:-translate-y-px"
                >
                  {studio.ens ?? studio.name}
                  {studio.role === 'owner' ? (
                    <span className="label-micro text-ink-soft">manager</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.credits.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl">Credited on</h2>
            <span className="font-mono text-[11px] text-ink-soft">
              with the share, because that is the point
            </span>
          </div>
          <ul className="print-rows mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
            {p.credits.map((credit, i) => (
              <li key={credit.gameId} style={{ '--i': i } as CSSProperties}>
                <Link
                  to={`/game/${credit.slug}`}
                  className="flex items-center gap-3.5 rounded-card border-2 border-ink bg-paper px-3.5 py-3 no-underline shadow-hard-sm transition-transform duration-130 ease-out hover:-translate-y-px"
                >
                  <Cover
                    game={{
                      coverUrl: credit.coverUrl,
                      coverSeed: credit.coverSeed,
                      title: credit.title,
                    }}
                    className="h-12 w-16 shrink-0 rounded-chip border-2 border-ink"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-wonk text-[15px]">
                      {credit.title}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-ink-soft">
                      {credit.role} · {credit.studio.name}
                    </span>
                  </span>
                  <span className="tnum shrink-0 font-mono text-[15px] font-bold">
                    {credit.pct}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.reviews.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Reviews</h2>
          <ul className="mt-4 flex list-none flex-col gap-3 p-0">
            {p.reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-card border-2 border-ink bg-paper p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3">
                  {review.game ? (
                    <Link
                      to={`/game/${review.game.slug}`}
                      className="font-wonk text-[15px] no-underline hover:underline"
                    >
                      {review.game.title}
                    </Link>
                  ) : (
                    <span className="font-wonk text-[15px] text-ink-soft">
                      A game that is no longer here
                    </span>
                  )}
                  <span className="tnum font-mono text-[13px] font-bold">
                    {review.rating}.0
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-ink-soft">
                    {formatDate(review.createdAt)}
                  </span>
                </div>
                <p className="mt-2 max-w-[62ch] font-body text-[15px] leading-relaxed">
                  {review.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.library.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl">Library</h2>
            {p.isSelf && !p.libraryPublic ? (
              <span className="label-micro rounded-chip border-2 border-ink bg-yellow px-2 py-0.5 text-ink">
                Only you can see this
              </span>
            ) : null}
          </div>
          <ul className="mt-4 flex list-none flex-wrap gap-2.5 p-0">
            {p.library.map((game) => (
              <li key={game.gameId}>
                <Link
                  to={`/game/${game.slug}`}
                  className="rounded-chip border-2 border-ink bg-paper px-3.5 py-1.5 font-mono text-[13px] no-underline shadow-hard-sm hover:-translate-y-px"
                >
                  {game.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Shell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="label-micro text-ink-soft">{label}</dt>
      <dd className="tnum font-bold">{value}</dd>
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
