import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DepositAddress } from '@/components/money/DepositAddress'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api'
import { ARC_NETWORK_NAME, HAS_TEST_FAUCET } from '@/lib/network'
import { fund, signIn, signOut, useSession } from '@/auth/session'

/**
 * Everything about you, behind one control.
 *
 * The information architecture, so it doesn't drift:
 *
 * - **My games** (`/library`) — keys you hold, plus triggers you've set.
 *   A trigger is a game you're trying to get, so it belongs next to the ones
 *   you got. That's why there's no separate agents page.
 * - **My studio** (`/studio/:id`) — what you made, and who made it with you.
 *   Team and credits live there because they're public facts about the studio,
 *   not private settings.
 * - **My money** (`/money`) — what you earned, and how to take it out. The
 *   third page, and the only one added since this list was written. It is
 *   cross-studio, so a studio page cannot hold it, and it is not about games
 *   you hold, so the library cannot either.
 * - **My agent** (`/agent`) — its balance, what it is trying to buy, and what
 *   it has actually done. A page because it runs for weeks and holds its own
 *   money; the ceiling for one game is still set on that game's listing.
 * - **Publish** (`/publish`) — an action, not a place. A menu item, not a tab.
 * - **Wallet** — balance, top-up, and the address to send to, inline here.
 *   There is nothing else to configure, so a settings page would be an empty
 *   room. Taking money *out* is on `/money` instead: the balance is a fact and
 *   belongs in a menu, but a destination address and an amount are a decision
 *   and need somewhere to stand.
 *
 * The deposit address is the only funding route that always works. The faucet
 * button beside it moves funds out of the operator account, so it is drawn on
 * testnet builds only and answers only when the server was started with
 * `DEV_FAUCET=on`: a convenience for whoever is testing, never the answer for
 * a real wallet. On mainnet the address is the whole of "Add funds" until a
 * card onramp exists.
 */
export function ProfileMenu() {
  const session = useSession()
  const [open, setOpen] = useState(false)
  const [funding, setFunding] = useState(false)
  const [fundError, setFundError] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Privy is restoring a session it may already have. Holding the control's
  // shape stops the header flickering from Sign in to signed-in on every load.
  if (!session.ready) {
    return <span className="h-8 w-24 rounded-chip border-2 border-ink-faint" />
  }

  if (!session.signedIn) {
    return (
      // Buying signs you in on the way through, so this is a convenience and
      // never a gate on browsing.
      <Button size="sm" variant="neutral" onClick={() => signIn()}>
        Sign in
      </Button>
    )
  }

  async function addFunds() {
    setFunding(true)
    setFundError(null)
    try {
      await fund()
    } catch (error) {
      // `fund()` already turns a faucet that is switched off into a sentence
      // pointing at the address below.
      setFundError(errorMessage(error))
    } finally {
      setFunding(false)
    }
  }

  // `label` is the server's answer to "what do we call this person" — display
  // name, else handle, else email. Deriving it here as well is how the two end
  // up disagreeing on the one screen that shows your own name back to you.
  const name = session.label ?? session.email
  const initial = (name ?? '?').charAt(0).toUpperCase()

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-chip border-2 border-ink py-1 pr-2.5 pl-1 transition-[transform,box-shadow] duration-130 ease-out',
          open ? 'bg-ink text-paper' : 'bg-paper text-ink hover:-translate-y-px',
        )}
      >
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full border-2 font-wonk text-sm',
            open ? 'border-paper bg-paper text-ink' : 'border-ink bg-yellow text-ink',
          )}
        >
          {initial}
        </span>
        <span className="font-mono tnum text-[11px] font-bold">
          {formatPrice(session.balanceUsd)}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={3}
          className={cn('transition-transform duration-130', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-stamp absolute top-[calc(100%+8px)] right-0 z-40 w-64 overflow-hidden rounded-card border-2 border-ink bg-paper shadow-hard-lg"
        >
          <div className="border-b-2 border-ink bg-paper-sunk px-4 py-3">
            <span
              className="block truncate font-mono text-[12px] font-semibold"
              title={session.email ?? undefined}
            >
              {name}
            </span>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span
                className={cn(
                  'font-mono tnum text-lg font-bold',
                  session.error ? 'text-ink-faint' : 'text-green',
                )}
              >
                {session.error ? '—' : formatPrice(session.balanceUsd)}
              </span>
              {HAS_TEST_FAUCET ? (
                <button
                  type="button"
                  onClick={addFunds}
                  disabled={funding}
                  className="flex cursor-pointer items-center gap-1 rounded-chip border-2 border-ink bg-paper px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase transition-transform duration-130 hover:-translate-y-px active:translate-y-px disabled:cursor-default disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <Plus size={11} strokeWidth={3.5} />
                  {funding ? 'Adding…' : 'Add funds'}
                </button>
              ) : null}
            </div>
            {/* A transfer plus the balance re-read behind it, which is a beat
                slower than the button press suggests. */}
            {funding ? (
              <p className="mt-2 font-mono text-[10px] text-ink-soft">
                Moving real testnet funds. This takes a moment.
              </p>
            ) : null}
            {fundError ? (
              <p className="mt-2 font-mono text-[10px] text-red">{fundError}</p>
            ) : null}
            {/* Signed in with Privy, but the server won't say who that is.
                Without this the balance just reads zero, which looks like a
                new wallet rather than a broken one. */}
            {session.error ? (
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-red">
                {session.error}
              </p>
            ) : session.walletPending ? (
              // Not an error, and never phrased as one. Privy is creating the
              // wallet right now and the app is waiting for it, which is the
              // whole of what anyone needs to know.
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-soft">
                Setting up your wallet. This takes a few seconds.
              </p>
            ) : null}

            {session.address ? (
              <div className="mt-3 border-t-2 border-dashed border-ink-faint pt-2.5">
                <DepositAddress
                  address={session.address}
                  label={
                    HAS_TEST_FAUCET ? 'Or send from another wallet' : 'Add funds'
                  }
                  note={`Send USDC on ${ARC_NETWORK_NAME} here. Nothing else is needed, not even gas.`}
                />
              </div>
            ) : null}
          </div>

          <nav className="flex flex-col p-1.5">
            {/* No count. `ownedGameIds` is this tab's optimism about what was
                just bought, not the library, so it is empty after a reload and
                told people with games that they had none. The real number
                needs a fetch this menu has no reason to make. */}
            <Item to="/library" label="My games" onGo={() => setOpen(false)} />
            {/* A public page, like a studio's, not a settings screen. It goes
                here because this is where you look for anything about you,
                and nowhere else in the app knows your handle. */}
            {session.userHandle ? (
              <Item
                to={`/u/${session.userHandle}`}
                label="My profile"
                hint={`@${session.userHandle}`}
                onGo={() => setOpen(false)}
              />
            ) : null}
            <Item to="/money" label="My money" onGo={() => setOpen(false)} />
            <Item to="/agent" label="My agent" onGo={() => setOpen(false)} />
            <Item
              to={session.studioId ? `/studio/${session.studioId}` : '/studio/new'}
              label={session.studioId ? 'My studio' : 'Set up a studio'}
              hint={session.studioName ?? 'to publish'}
              onGo={() => setOpen(false)}
            />
            <Item to="/publish" label="Publish a game" onGo={() => setOpen(false)} />
          </nav>

          <div className="border-t-2 border-ink p-1.5">
            <button
              type="button"
              onClick={() => {
                signOut()
                setOpen(false)
              }}
              className="w-full cursor-pointer rounded-md border-0 bg-transparent px-2.5 py-2 text-left font-mono text-[12px] text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Item({
  to,
  label,
  hint,
  onGo,
}: {
  to: string
  label: string
  hint?: string
  onGo: () => void
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onGo}
      className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-ink no-underline transition-colors hover:bg-paper-sunk"
    >
      <span className="font-wonk text-[15px]">{label}</span>
      {hint ? (
        <span className="max-w-[9ch] truncate font-mono text-[11px] text-ink-soft">
          {hint}
        </span>
      ) : null}
    </Link>
  )
}
