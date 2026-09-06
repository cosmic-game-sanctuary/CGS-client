import { useEffect, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { SplitBar } from '@/components/SplitBar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Sticker } from '@/components/ui/Sticker'
import { cn } from '@/lib/utils'
import { getGame } from '@/mocks/games'
import { acceptInvite, declineInvite, useInvite } from '@/mocks/invites'
import { joinStudio, signIn, useSession } from '@/auth/session'
import type { Game } from '@/mocks/types'

/**
 * The other end of the splits editor.
 *
 * The one thing this screen has to make true: **the share exists whether or
 * not you accept.** It was locked when the game was published and every sale
 * has been dividing that way since. Accepting claims the wallet it lands in,
 * so this is a collection, not an application. Everything on the page is
 * arranged to say that before it asks for anything.
 *
 * Declining is reversible, because nothing is destroyed by it.
 *
 * TODO(integration): GET /api/invites/:token, then POST accept against the
 * Privy wallet the invitee claims here.
 */
export function InviteAccept() {
  const { id } = useParams<{ id: string }>()
  const invite = useInvite(id)
  const session = useSession()

  // Both of these are tagged with what produced them and read during render,
  // rather than pushed in from an effect. Same reason as everywhere else in
  // this app: react-hooks v7 forbids the synchronous setState, and a stale
  // result then reads as "still loading" for free.
  const [loaded, setLoaded] = useState<{ slug: string; game: Game | null }>()
  const [edited, setEdited] = useState<{ id: string; value: string }>()
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)

  const slug = invite?.game?.slug

  useEffect(() => {
    if (!slug) return
    let live = true
    getGame(slug).then((found) => {
      if (live) setLoaded({ slug, game: found ?? null })
    })
    return () => {
      live = false
    }
  }, [slug])

  const game: Game | null | undefined = !slug
    ? null
    : loaded?.slug === slug
      ? loaded.game
      : undefined

  // The suggested handle arrives with the invite. It's theirs to change
  // exactly once, here, before it goes on the splits for good.
  const handle =
    invite && edited?.id === invite.id ? edited.value : (invite?.handle ?? '')

  if (!invite) {
    return (
      <Shell>
        <div className="rounded-card border-2 border-ink bg-paper-sunk px-7 py-9">
          <h1 className="text-[clamp(26px,4vw,38px)]">
            That invite is not here.
          </h1>
          <p className="mt-3 max-w-[46ch] font-body text-[17px] leading-relaxed text-ink-soft">
            The link may be wrong, or it was opened on a different account. Ask
            whoever sent it to send it again.
          </p>
          <div className="mt-5">
            <ButtonLink to="/" variant="neutral">
              Browse the catalog
            </ButtonLink>
          </div>
        </div>
      </Shell>
    )
  }

  const studioName = invite.studioEns ?? invite.studioName
  const elsewhere =
    session.studioId !== null && session.studioId !== invite.studioId

  if (invite.status === 'accepted') {
    return (
      <Shell>
        <div className="flex flex-col items-start gap-5 rounded-card border-2 border-ink bg-green px-8 py-10 text-paper shadow-hard">
          <Sticker tone="paper" className="-rotate-2">
            You&rsquo;re in
          </Sticker>
          <h1 className="text-[clamp(28px,4.4vw,44px)]">
            {handle}, of {invite.studioName}.
          </h1>
          <p className="max-w-[48ch] font-body text-[17px] leading-relaxed">
            Your share of every sale lands in your wallet on settlement. Nobody
            has to remember to pay you.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              to={`/studio/${invite.studioId}`}
              variant="neutral"
              size="lg"
            >
              Your studio
            </ButtonLink>
            <ButtonLink to="/library" variant="ghost" size="lg">
              <span className="text-paper">Your games</span>
            </ButtonLink>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <Sticker tone="pink" className="-rotate-2">
            {invite.status === 'declined' ? 'Declined' : 'Invitation'}
          </Sticker>
          <h1 className="mt-3 max-w-[18ch] text-[clamp(28px,4.4vw,44px)]">
            {invite.fromHandle} put you on {invite.game?.title ?? studioName}.
          </h1>
          <p className="mt-3 max-w-[52ch] font-body text-[17px] leading-relaxed text-ink-soft">
            {invite.game
              ? `${invite.game.pct}% of every sale is already yours, credited as ${invite.game.role}. It has been dividing that way since the game went up.`
              : `You are on the roster at ${studioName}.`}
          </p>
        </div>
        <Freehand
          name="business-deal-handshake"
          className="hidden h-28 w-28 shrink-0 text-green sm:block"
        />
      </div>

      {/* The split as buyers see it, with their row named. Proof, then ask. */}
      {invite.game ? (
        <section className="mt-9 rounded-card border-2 border-ink bg-paper-sunk p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="label-micro text-ink-soft">
              {invite.game.title}, locked at publish
            </span>
            <span className="font-mono text-[11px] text-ink-soft">
              Nobody can change this, including us
            </span>
          </div>

          {game === undefined ? (
            <div className="hatch mt-4 h-9 rounded-chip border-2 border-ink" />
          ) : game ? (
            <>
              <SplitBar splits={game.splits} className="mt-4" />
              <ul className="print-rows mt-5 flex list-none flex-col gap-1 border-t-2 border-ink p-0 pt-3 font-mono text-[13px]">
                {game.splits.map((member, i) => {
                  const yours =
                    member.role === invite.game?.role &&
                    member.pct === invite.game?.pct
                  return (
                    <li
                      key={member.handle}
                      style={{ '--i': i } as CSSProperties}
                      className={cn(
                        'flex justify-between gap-4 rounded-md px-2 py-1',
                        yours && 'bg-yellow font-bold',
                      )}
                    >
                      <span className="min-w-0 truncate">
                        {yours ? 'You' : member.handle}
                        <span className="font-normal text-ink-soft">
                          {' '}
                          · {member.role}
                        </span>
                      </span>
                      <span className="tnum shrink-0 font-bold">
                        {member.pct}%
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {/* The ask */}
      <section className="mt-8 flex flex-col gap-5 border-t-2 border-ink pt-7">
        {!session.signedIn ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border-2 border-ink bg-yellow px-5 py-4">
            <p className="max-w-[40ch] font-body text-[15px] leading-relaxed text-ink">
              Sign in as {invite.email} to claim the wallet your share pays
              into.
            </p>
            {/* TODO(integration): Privy login, prefilled with the invited address. */}
            <Button variant="primary" onClick={() => signIn()}>
              Sign in
            </Button>
          </div>
        ) : (
          <>
            <div>
              <span className="label-micro block text-ink-soft">
                Your handle
              </span>
              <span className="mt-0.5 block font-body text-[13px] text-ink-soft">
                What buyers see beside your share. Last chance to change it.
              </span>
              <input
                value={handle}
                onChange={(event) =>
                  setEdited({ id: invite.id, value: event.target.value })
                }
                aria-label="Your handle"
                className="mt-2 w-full max-w-80 rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-mono text-[15px] outline-none focus:shadow-hard-sm"
              />
            </div>

            {elsewhere ? (
              // TODO(integration): real accounts can be in several studios. The
              // mock session holds one, so say what will happen rather than
              // letting it happen quietly.
              <p className="font-mono text-[11px] text-ink-soft">
                You publish as another studio right now. Accepting moves you to{' '}
                {invite.studioName}.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
              <Button
                variant="go"
                size="lg"
                disabled={busy !== null || handle.trim() === ''}
                onClick={() => {
                  setBusy('accept')
                  acceptInvite(invite.id, handle)
                    .then((accepted) => {
                      if (accepted) {
                        joinStudio()
                      }
                    })
                    .finally(() => setBusy(null))
                }}
              >
                {busy === 'accept' ? 'Claiming…' : 'Accept and claim'}
              </Button>

              {invite.status === 'pending' ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setBusy('decline')
                    declineInvite(invite.id).finally(() => setBusy(null))
                  }}
                  className="cursor-pointer border-0 bg-transparent font-mono text-[12px] text-ink-soft underline underline-offset-2 disabled:opacity-45"
                >
                  Not now
                </button>
              ) : (
                <span className="font-mono text-[12px] text-ink-soft">
                  You declined this. The share is still there if you change your
                  mind.
                </span>
              )}
            </div>
          </>
        )}
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-190 flex-1 px-6 py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
