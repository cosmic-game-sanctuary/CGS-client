import { Check, ChevronDown, Copy, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { formatPrice, truncateAddress } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApiError, errorMessage } from '@/lib/api'
import { fund, signIn, signOut, useSession } from '@/auth/session'

/**
 * Everything about you, behind one control.
 *
 * The information architecture, so it doesn't drift:
 *
 * - **Your games** (`/library`) — keys you hold, plus triggers you've set.
 *   A trigger is a game you're trying to get, so it belongs next to the ones
 *   you got. That's why there's no separate agents page.
 * - **Your studio** (`/studio/:id`) — what you made, and who made it with you.
 *   Team and credits live there because they're public facts about the studio,
 *   not private settings.
 * - **Publish** (`/publish`) — an action, not a place. A menu item, not a tab.
 * - **Wallet** — balance, top-up, and the address to send to, inline here.
 *   There is nothing else to configure, so a settings page would be an empty
 *   room.
 *
 * The deposit address is the only funding route that always works. The faucet
 * button beside it moves funds out of the operator account and only exists
 * when the server was started with `DEV_FAUCET=on`, so it is a convenience for
 * whoever is running this locally, never the answer for a real wallet.
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
      // The faucet route is not mounted unless the server was started with
      // DEV_FAUCET=on, so a 404 here is a configuration answer rather than a
      // failure. Saying "no route for POST /api/dev/faucet" to someone who
      // just wants funds is the wrong sentence, and the address below is the
      // right one either way.
      setFundError(
        error instanceof ApiError && error.status === 404
          ? 'The test faucet is off. Send funds to the address below instead.'
          : errorMessage(error),
      )
    } finally {
      setFunding(false)
    }
  }

  const initial = (session.email ?? '?').charAt(0).toUpperCase()
  const owned = session.ownedGameIds.length

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
              {session.email}
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
              <button
                type="button"
                onClick={addFunds}
                disabled={funding}
                className="flex cursor-pointer items-center gap-1 rounded-chip border-2 border-ink bg-paper px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase transition-transform duration-130 hover:-translate-y-px active:translate-y-px disabled:cursor-default disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <Plus size={11} strokeWidth={3.5} />
                {funding ? 'Adding…' : 'Add funds'}
              </button>
            </div>
            {/* The first top-up also creates the Hedera account behind the
                wallet, which takes a few seconds longer than the rest. */}
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
            ) : null}

            {session.address ? (
              <DepositAddress
                address={session.address}
                accountId={session.hederaAccountId}
              />
            ) : null}
          </div>

          <nav className="flex flex-col p-1.5">
            <Item to="/library" label="Your games" hint={owned ? `${owned}` : 'none yet'} onGo={() => setOpen(false)} />
            <Item
              to={session.studioId ? `/studio/${session.studioId}` : '/studio/new'}
              label={session.studioId ? 'Your studio' : 'Set up a studio'}
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

/**
 * Where to send funds from a wallet you already have.
 *
 * This is the path that does not spend anything of ours. A Privy embedded
 * wallet is an ordinary EVM address, and HashPack and friends can send
 * straight to one, so a person with their own testnet funds never needs the
 * faucet.
 *
 * The order genuinely matters and is the reason the hint is here rather than
 * in a doc nobody reads: the Hedera account behind this address does not exist
 * until value first lands on it, and HBAR is what creates it. A token sent
 * first has nowhere to go. Once the account exists its id appears below, which
 * doubles as confirmation that the first transfer worked.
 */
function DepositAddress({
  address,
  accountId,
}: {
  address: string
  accountId: string | null
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
    } catch {
      // Clipboard access can be refused outright, and a silent no-op reads as
      // a broken button. Selecting the text is the fallback everyone knows.
      setCopied(false)
    }
  }

  return (
    <div className="mt-3 border-t-2 border-dashed border-ink-faint pt-2.5">
      <span className="label-micro text-ink-soft">Or send from another wallet</span>
      <div className="mt-1.5 flex items-center gap-1.5">
        <code
          title={address}
          className="min-w-0 flex-1 truncate rounded-md border-2 border-ink bg-paper px-2 py-1 font-mono text-[11px]"
        >
          {truncateAddress(address, 10, 6)}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy your wallet address"
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-chip border-2 border-ink bg-paper px-2 py-1 font-mono text-[10px] font-bold tracking-wider uppercase transition-transform duration-130 hover:-translate-y-px active:translate-y-px"
        >
          {copied ? (
            <Check size={11} strokeWidth={3.5} className="text-green" />
          ) : (
            <Copy size={11} strokeWidth={3} />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink-soft">
        Send HBAR first. That is what opens the account. Then send USDC.
      </p>
      <p className="mt-1 font-mono text-[10px] text-ink-faint">
        {accountId ? `Account ${accountId}` : 'No account yet'}
      </p>
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
