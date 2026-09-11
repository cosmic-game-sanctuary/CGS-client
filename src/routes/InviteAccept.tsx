import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Freehand } from '@/components/icons/Freehand'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Sticker } from '@/components/ui/Sticker'
import { ApiError, errorMessage } from '@/lib/api'
import { formatAmount } from '@/lib/format'
import { acceptInvite, getInvite, type WireInvite } from '@/api/invites'
import { getMyEarnings, type WirePersonalEarnings } from '@/api/earnings'
import { joinStudio, signIn, signOut, useSession } from '@/auth/session'

/**
 * The other end of the splits editor.
 *
 * The one thing this screen has to make true: **the share exists whether or not
 * you accept.** It was locked when the game was published and every sale has
 * been dividing that way since. Accepting names the wallet it lands in, so this
 * is a collection, not an application. Everything on the page is arranged to
 * say that before it asks for anything.
 *
 * Three things the real API does not offer, which the mocked version of this
 * screen did, and which are absences rather than gaps:
 *
 * - **No decline.** Not accepting is the decline, and it stays reversible
 *   forever, so a button whose only effect is to look final would be a lie.
 * - **No editing the handle.** It is already on published splits, and those are
 *   immutable. Offering to change it would be offering something impossible.
 * - **No mention of a specific game.** The invite is to a studio, and a person
 *   can be credited across several of its games at different percentages.
 *
 * What accepting actually does, in order: the membership row gets your user id,
 * every split naming that row gets your address, and anything that sold while
 * you had not claimed it is sent to you. That last part happens after the
 * response, which is why the arrival screen reads the earnings report twice.
 */
export function InviteAccept() {
  const { id = '' } = useParams()
  const session = useSession()

  // Tagged with the id it was fetched for and read during render, rather than
  // cleared inside an effect. Same rule as everywhere else here: react-hooks v7
  // forbids the synchronous setState, and a stale result reads as loading.
  const [loaded, setLoaded] = useState<{
    id: string
    invite: WireInvite | null
  } | null>(null)
  const [claimed, setClaimed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // A refused accept and a *wrong account* are different problems with
  // different exits: one is "try again", the other is "you are the wrong
  // person". Only the second gets a sign-out button.
  const [wrongAccount, setWrongAccount] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getInvite(id, controller.signal)
      .then((invite) => setLoaded({ id, invite }))
      .catch(() => {
        if (controller.signal.aborted) return
        setLoaded({ id, invite: null })
      })
    return () => controller.abort()
  }, [id])

  const current = loaded?.id === id ? loaded : null

  if (current === null) {
    return (
      <Shell>
        <div className="hatch h-48 rounded-card border-2 border-ink" />
      </Shell>
    )
  }

  const invite = current.invite

  if (invite === null) {
    return (
      <Shell>
        <div className="rounded-card border-2 border-ink bg-paper-sunk px-7 py-9">
          <h1 className="text-[clamp(26px,4vw,38px)]">
            That invite is not here.
          </h1>
          <p className="mt-3 max-w-[46ch] font-body text-[17px] leading-relaxed text-ink-soft">
            The link may be wrong, or it may have been cut short by the mail
            client that delivered it. Ask whoever sent it to send it again.
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

  // Both of these read the local claim as well as the fetched invite, because
  // the fetched copy is from before the accept and nothing re-reads it. Without
  // the first, pressing accept leaves you on the accept screen; without the
  // second, you land on a screen saying somebody else got there first.
  const accepted = invite.accepted || claimed === id
  const mine =
    claimed === id ||
    session.studios.some((studio) => studio.id === invite.studio.id)

  if (accepted && mine) {
    return (
      <Shell>
        <div className="flex flex-col items-start gap-5 rounded-card border-2 border-ink bg-green px-8 py-10 text-paper shadow-hard">
          <Sticker tone="paper" className="-rotate-2">
            You&rsquo;re in
          </Sticker>
          <h1 className="text-[clamp(28px,4.4vw,44px)]">
            {invite.handle}, of {invite.studio.name}.
          </h1>
          <p className="max-w-[48ch] font-body text-[17px] leading-relaxed">
            Your share of every sale lands in your wallet on settlement. Nobody
            has to remember to pay you.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              to={`/studio/${invite.studio.id}`}
              variant="neutral"
              size="lg"
            >
              {invite.studio.name}
            </ButtonLink>
            <ButtonLink to="/money" variant="ghost" size="lg">
              <span className="text-paper">See what you made</span>
            </ButtonLink>
          </div>
        </div>

        <WhatWasWaiting />
      </Shell>
    )
  }

  if (accepted) {
    return (
      <Shell>
        <div className="rounded-card border-2 border-ink bg-paper-sunk px-7 py-9">
          <h1 className="text-[clamp(26px,4vw,38px)]">
            This one has already been claimed.
          </h1>
          <p className="mt-3 max-w-[48ch] font-body text-[17px] leading-relaxed text-ink-soft">
            {invite.handle} is on the credits at {invite.studio.name}, and the
            share is already paying into a wallet. If that was you, sign in on
            that account and you will find it under My money.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink to={`/studio/${invite.studio.id}`} variant="neutral">
              {invite.studio.name}
            </ButtonLink>
            {!session.signedIn ? (
              <Button variant="ghost" onClick={() => signIn()}>
                Sign in
              </Button>
            ) : null}
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
            Invitation
          </Sticker>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(28px,4.4vw,44px)]">
            {invite.studio.name} put you on the credits.
          </h1>
          <p className="mt-3 max-w-[52ch] font-body text-[17px] leading-relaxed text-ink-soft">
            You are credited as {invite.handle}. That was locked when each game
            went up, and every sale since has been dividing that way. Accepting
            says which wallet your share pays into.
          </p>
        </div>
        <Freehand
          name="business-deal-handshake"
          className="hidden h-28 w-28 shrink-0 text-green sm:block"
        />
      </div>

      <section className="mt-9 rounded-card border-2 border-ink bg-paper-sunk p-5">
        <span className="label-micro text-ink-soft">
          What is already true
        </span>
        <dl className="mt-3 flex flex-col gap-2.5 border-t-2 border-ink pt-3 font-mono text-[13px]">
          <Fact label="On the credits as" value={invite.handle} />
          <Fact
            label="At"
            value={invite.studio.name}
          />
          <Fact
            label="Role"
            value={invite.role === 'owner' ? 'manager' : 'member'}
          />
          <Fact label="Sent to" value={invite.email} />
        </dl>
        <p className="mt-4 border-t-2 border-ink pt-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          Nobody can change any of that, including us. Splits are fixed at
          publish.
        </p>
      </section>

      <section className="mt-8 flex flex-col gap-5 border-t-2 border-ink pt-7">
        {!session.signedIn ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border-2 border-ink bg-yellow px-5 py-4">
            <p className="max-w-[42ch] font-body text-[15px] leading-relaxed text-ink">
              Sign in to claim the wallet your share pays into. It is made for
              you, and there is nothing to install.
            </p>
            <Button variant="primary" onClick={() => signIn()}>
              Sign in
            </Button>
          </div>
        ) : (
          <>
            {/* The account in the tab is the one that gets paid, and it need
                not be the address this link was emailed to. Saying which is
                cheaper than a wrong wallet holding somebody's money. */}
            <p className="font-body text-[15px] leading-relaxed text-ink-soft">
              Accepting points this share at{' '}
              <b className="font-mono text-[13px] text-ink">
                {session.label ?? session.email}
              </b>
              . That is the wallet it will pay into, from the next sale and for
              everything it already owes you. It has to be the account this
              invite was sent to, {invite.email}, or the claim is refused.
            </p>

            <div className="flex flex-wrap items-center gap-5">
              {/* Accepting is a write, and every write fails while Privy is
                  still creating this account's wallet. Pressing it in that
                  window used to return "sign out, then sign in again", which
                  is our race described as the person's chore. Waiting is the
                  fix, so the button waits. */}
              <Button
                variant="go"
                size="lg"
                disabled={busy || session.walletPending}
                onClick={() => {
                  setBusy(true)
                  setProblem(null)
                  setWrongAccount(false)
                  acceptInvite(id)
                    .then(() => {
                      setClaimed(id)
                      // The membership is a server fact now, so there is
                      // nothing to set locally, only something to re-read.
                      joinStudio()
                    })
                    .catch((error: unknown) => {
                      setWrongAccount(
                        error instanceof ApiError &&
                          error.code === 'INVITE_EMAIL_MISMATCH',
                      )
                      setProblem(errorMessage(error))
                    })
                    .finally(() => setBusy(false))
                }}
              >
                {busy
                  ? 'Claiming…'
                  : session.walletPending
                    ? 'One moment…'
                    : 'Accept and claim'}
              </Button>

              <span className="max-w-[34ch] font-mono text-[11px] leading-relaxed text-ink-soft">
                {session.walletPending
                  ? 'Setting up your wallet. This takes a few seconds.'
                  : 'Nothing expires. The share is yours whether you open this today or in a year.'}
              </span>
            </div>

            {problem ? (
              <div className="flex flex-wrap items-center gap-4">
                <p role="alert" className="font-body text-sm text-red">
                  {problem}
                </p>
                {wrongAccount ? (
                  <Button variant="neutral" size="sm" onClick={() => signOut()}>
                    Sign in as someone else
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
    </Shell>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 truncate font-semibold">{value}</dd>
    </div>
  )
}

/**
 * What accepting released.
 *
 * The transfers go out after the accept responds, so the first read of the
 * earnings report usually still counts the money as held. Read twice: once now
 * for whatever was already settled, once after the transfers have had time to
 * land.
 *
 * Held money needs no button and shouldn't get one. A share is now paid to the
 * collaborator's EVM alias directly, and under HIP-542 that payment creates
 * their Hedera account as a side effect, so "held" means exactly one thing:
 * the invite had not been accepted. Accepting is what you just did, which is
 * why anything still held here is in flight rather than stuck.
 */
function WhatWasWaiting() {
  const [report, setReport] = useState<WirePersonalEarnings | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    function read() {
      getMyEarnings(controller.signal)
        .then(setReport)
        .catch(() => {
          // A number that will not load is not worth an error box on the one
          // screen whose job is to say welcome.
        })
    }
    read()
    const settle = window.setTimeout(read, 8000)
    return () => {
      controller.abort()
      window.clearTimeout(settle)
    }
  }, [])

  if (report === null) return null

  const earned = report.totals.earned.display
  const held = report.totals.held.display

  return (
    <section className="mt-8 rounded-card border-2 border-ink bg-paper p-5 shadow-hard">
      <span className="label-micro text-ink-soft">What was waiting</span>

      {earned === 0 && held === 0 ? (
        <p className="mt-2 max-w-[48ch] font-body text-[15px] leading-relaxed">
          Nothing has sold yet. When it does, your share arrives without anyone
          having to send it.
        </p>
      ) : (
        <>
          <p className="mt-1.5 font-mono tnum text-3xl font-bold text-green">
            {formatAmount(earned)}
          </p>
          <p className="mt-1 max-w-[48ch] font-body text-[15px] leading-relaxed text-ink-soft">
            earned across everything you are credited on.
          </p>
        </>
      )}

      {held > 0 ? (
        <p className="mt-4 border-t-2 border-ink pt-3 font-body text-[15px] leading-relaxed">
          <b className="font-mono tnum">{formatAmount(held)}</b> of that is on
          its way now. It was held while the invite was unclaimed, and accepting
          released it. There is nothing to claim.
        </p>
      ) : null}

      <div className="mt-4">
        <ButtonLink to="/money" variant="neutral" size="sm">
          My money
        </ButtonLink>
      </div>
    </section>
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
