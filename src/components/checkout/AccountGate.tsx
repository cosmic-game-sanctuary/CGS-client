import { useEffect, useRef, type ReactNode } from 'react'
import { Freehand } from '@/components/icons/Freehand'
import { Button } from '@/components/ui/Button'
import { PriceChip } from '@/components/ui/PriceChip'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { suggestedTopUp } from '@/lib/gate'

/**
 * The two steps before any money can move: having an account, and having
 * something in it.
 *
 * Checkout and the paid trial both need them, in that order, and should say
 * the same words. They used to live inline in `CheckoutOverlay`, which is
 * exactly why the trial had neither: pressing "Try it" signed out dropped
 * straight into Privy's own modal with nothing of ours in front of it, and
 * pressing it with an empty wallet started a session whose first charge could
 * only fail. The only thing that differs between the two is the amount, so
 * that is the parameter.
 */

/**
 * The paper panel every step of this ladder appears in: flat ink scrim, no
 * blur anywhere in this language (DESIGN.md §9).
 *
 * `hidden` rather than unmounted, because checkout keeps this alive behind the
 * lights-down wipe and a remount would restart the sequence it is covering.
 */
export function GateShell({
  title,
  step,
  priceUsd,
  hidden = false,
  dismissable = true,
  problem,
  onClose,
  children,
}: {
  /** The dialog's accessible name. */
  title: string
  /** The `Step 1 of 3` line, left of the price. */
  step: string
  priceUsd: number
  hidden?: boolean
  dismissable?: boolean
  problem?: string | null
  onClose: () => void
  children: ReactNode
}) {
  // Focus lands on the panel, not wherever it was on the page behind. Owned
  // here so both callers get it rather than one remembering to.
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  return (
    <>
      <button
        type="button"
        aria-label={`Close ${title}`}
        tabIndex={dismissable ? 0 : -1}
        onClick={() => dismissable && onClose()}
        className={cn(
          'absolute inset-0 h-full w-full border-0 bg-ink/45',
          dismissable ? 'cursor-pointer' : 'cursor-default',
          // Hidden once the night layer covers it, so the wipe back up reveals
          // the page rather than a scrim.
          hidden && 'invisible',
        )}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cn(
            'animate-stamp pointer-events-auto w-full max-w-[440px] rounded-card border-[3px] border-ink bg-paper shadow-hard-lg outline-none',
            hidden && 'invisible',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper-sunk px-5 py-3">
            <span className="label-micro text-ink-soft">{step}</span>
            <PriceChip usd={priceUsd} size="sm" />
          </div>

          <div className="px-5 py-5">
            {children}

            {problem ? (
              <p
                role="alert"
                className="mt-4 rounded-card border-2 border-red bg-paper-sunk px-3.5 py-2.5 font-body text-sm leading-relaxed text-ink"
              >
                {problem}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Step one.
 *
 * Privy owns the whole login flow, including which methods are offered, so
 * there is nothing to collect here first. Whatever renders this moves on by
 * itself when the session changes.
 */
export function SignInBody({
  heading,
  onSignIn,
}: {
  heading: string
  onSignIn: () => void
}) {
  return (
    <>
      <h2 className="text-2xl">{heading}</h2>
      <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
        Email only. We make the wallet for you, so there&rsquo;s no extension to
        install and no phrase to write down.
      </p>
      <Button
        variant="primary"
        size="lg"
        className="mt-5 w-full"
        onClick={onSignIn}
      >
        Continue with email
      </Button>
    </>
  )
}

/**
 * Step two.
 *
 * `lines` is whatever the caller wants itemised above the button. Checkout
 * shows the game and any trial credit; the trial shows one chunk and the
 * ceiling it can never pass.
 */
export function FundingBody({
  shortfallUsd,
  lines,
  busy,
  onFund,
}: {
  shortfallUsd: number
  lines: { label: string; value: string; tone?: 'green' }[]
  busy: boolean
  onFund: (amount: number) => void
}) {
  const topUp = suggestedTopUp(shortfallUsd)

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl">Add funds</h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">
            Your wallet is {formatPrice(shortfallUsd)} short. Top it up once and
            the rest of your buys are one tap.
          </p>
        </div>
        <Freehand
          name="money-wallet"
          className="h-11 w-11 shrink-0 text-ink"
        />
      </div>

      <dl className="mt-5 flex flex-col gap-1.5 rounded-card border-2 border-ink bg-paper-sunk px-4 py-3 font-mono text-[13px]">
        {lines.map((line) => (
          <div
            key={line.label}
            className={cn(
              'flex justify-between',
              line.tone === 'green' && 'text-green',
            )}
          >
            <dt className={line.tone === 'green' ? undefined : 'text-ink-soft'}>
              {line.label}
            </dt>
            <dd className="tnum">{line.value}</dd>
          </div>
        ))}
      </dl>

      <Button
        variant="go"
        size="lg"
        className="mt-4 w-full"
        disabled={busy}
        onClick={() => onFund(topUp)}
      >
        {busy ? 'Adding…' : `Add ${formatPrice(topUp)}`}
      </Button>
      <p className="mt-3 font-mono text-[11px] text-ink-soft">
        Card or bank, handled by our payments partner.
      </p>
    </>
  )
}
