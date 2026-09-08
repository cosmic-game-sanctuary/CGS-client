import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { withdraw, type WithdrawalSent } from '@/api/withdraw'
import { useWalletSigner } from '@/auth/useWalletSigner'
import { ApiError, errorMessage } from '@/lib/api'
import { formatAmount, formatAsset } from '@/lib/format'
import { cn } from '@/lib/utils'
import { refreshSession, useSession } from '@/auth/session'

/**
 * Getting money out of the wallet Privy made for you.
 *
 * The wallet is an ordinary EVM address on Hedera, and the money in it is
 * ordinary USDC, so the honest version of this feature is a transfer to any
 * address the person names. No withdrawal queue, no minimum, no review, and
 * nothing here can refuse to send somebody their own money.
 *
 * Folded away behind a control rather than sitting open, for the same reason a
 * bank does it: the whole balance is one field and one press away, and a form
 * that can empty an account should take a decision to open.
 *
 * **No HBAR is needed.** The operator pays the network fee, so a wallet holding
 * only USDC can still be emptied. That is worth knowing before reading the
 * asset switch below, which exists only because HBAR turns up in these wallets
 * as the thing that opened the account.
 */

/** Hedera's own id for HBAR in an asset field. Not a token, hence the zeroes. */
const HBAR = '0.0.0'
const HBAR_DECIMALS = 8

export function WithdrawPanel() {
  const session = useSession()
  const signer = useWalletSigner()

  const [open, setOpen] = useState(false)
  const [asset, setAsset] = useState<'settlement' | 'hbar'>('settlement')
  const [to, setTo] = useState('')
  const [whole, setWhole] = useState(true)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [stage, setStage] = useState<'idle' | 'preparing' | 'signing'>('idle')
  const [sent, setSent] = useState<WithdrawalSent | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const isHbar = asset === 'hbar'
  const available = isHbar ? session.hbar : session.balanceUsd
  const decimals = isHbar ? HBAR_DECIMALS : session.assetDecimals
  // Left off entirely for the settlement asset: the server defaults to it, and
  // naming it here would mean this file has an opinion about which token the
  // store settles in.
  const assetId = isHbar ? HBAR : undefined
  const show = (value: number) =>
    isHbar ? formatAsset(value, HBAR) : formatAmount(value)

  const typed = Number(amount)
  const amountOk =
    whole || (amount.trim() !== '' && Number.isFinite(typed) && typed > 0)
  const overdrawn = !whole && amountOk && typed > available
  const busy = stage !== 'idle'
  const canSend =
    to.trim() !== '' &&
    amountOk &&
    !overdrawn &&
    available > 0 &&
    // Privy restores the embedded wallet a moment after the page does, and the
    // signature is the one step of this the server cannot take.
    signer.ready &&
    !busy

  async function send() {
    setStage('preparing')
    setProblem(null)
    setSent(null)
    try {
      const result = await withdraw(
        {
          to: to.trim(),
          ...(assetId ? { asset: assetId } : {}),
          // Omitted for "everything", which is the case that matters: the
          // server reads the live balance and sends exactly that, so nothing
          // here has to do arithmetic on money it only knows as a float.
          ...(whole
            ? {}
            : { amountUnits: String(Math.round(typed * 10 ** decimals)) }),
          ...(memo.trim() ? { memo: memo.trim() } : {}),
        },
        signer.signHashes,
        () => setStage('signing'),
      )
      setSent(result)
      setTo('')
      setAmount('')
      setMemo('')
      setWhole(true)
      // The balance in the header is now wrong by exactly what just left.
      refreshSession()
    } catch (error) {
      setProblem(withdrawalMessage(error))
    } finally {
      setStage('idle')
    }
  }

  return (
    <section className="mt-12">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 rounded-card border-2 border-ink bg-paper-sunk px-5 py-3.5 text-left shadow-hard-sm transition-transform duration-130 ease-out hover:-translate-y-px"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-2xl leading-tight font-wonk">
            Take it out
          </span>
          <span className="block font-body text-sm text-ink-soft">
            Send what is in your wallet anywhere you like.
          </span>
        </span>
        <span className="label-micro shrink-0 text-ink-soft">
          {open ? 'Hide' : 'Show'}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2.5}
          className={cn(
            'shrink-0 transition-transform duration-130',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div className="mt-4 flex flex-col gap-4 rounded-card border-2 border-ink bg-paper-sunk p-5">
          {/* HBAR only appears when there is some, because for almost everyone
              there never is: the facilitator pays the fee on a purchase and the
              operator pays it here, so HBAR is only ever what opened the
              account. A permanent switch would imply a decision nobody has. */}
          {session.hbar > 0 ? (
            <Field label="What to send">
              <div className="flex flex-wrap gap-2">
                <Choice
                  on={!isHbar}
                  onClick={() => setAsset('settlement')}
                  label={`USDC · ${formatAmount(session.balanceUsd)}`}
                />
                <Choice
                  on={isHbar}
                  onClick={() => setAsset('hbar')}
                  label={formatAsset(session.hbar, HBAR)}
                />
              </div>
            </Field>
          ) : null}

          <Field
            label="Send to"
            hint="A Hedera account id, or a wallet address."
          >
            <input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="0.0.512345 or 0x…"
              spellCheck={false}
              autoComplete="off"
              className={`${input} font-mono text-[14px]`}
            />
          </Field>

          <Field label="How much">
            <div className="flex flex-wrap items-center gap-2">
              <Choice
                on={whole}
                onClick={() => setWhole(true)}
                label={`Everything · ${show(available)}`}
              />
              <Choice
                on={!whole}
                onClick={() => setWhole(false)}
                label="Some of it"
              />
            </div>
            {!whole ? (
              <div className="mt-2.5 flex items-center gap-2">
                {!isHbar ? (
                  <span className="font-mono text-[15px] text-ink-soft">$</span>
                ) : null}
                <input
                  value={amount}
                  inputMode="decimal"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className={`${input} max-w-40 font-mono`}
                />
                {isHbar ? (
                  <span className="font-mono text-[13px] text-ink-soft">
                    HBAR
                  </span>
                ) : null}
              </div>
            ) : null}
            {overdrawn ? (
              <p className="mt-1.5 font-mono text-[11px] text-red">
                That is more than this wallet holds.
              </p>
            ) : null}
          </Field>

          {/* Exchange deposit addresses are pooled accounts that identify the
              depositor by memo. Sending to one without it is the classic way to
              lose a withdrawal, which is why the field is on screen rather than
              behind an "advanced" fold. */}
          <Field
            label="Memo"
            hint="Exchanges need this. Your own wallet does not."
          >
            <input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              maxLength={100}
              placeholder="Optional"
              className={`${input} font-mono text-[14px]`}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-4">
            <Button
              variant="go"
              disabled={!canSend}
              onClick={() => void send()}
            >
              {stage === 'preparing'
                ? 'Building it…'
                : stage === 'signing'
                  ? 'Signing…'
                  : 'Send it'}
            </Button>
            <span className="max-w-[38ch] font-mono text-[11px] leading-relaxed text-ink-soft">
              {available === 0
                ? 'This wallet is empty.'
                : 'You pay no fee. Nothing is held back.'}
            </span>
          </div>

          {sent ? (
            <div className="rounded-card border-2 border-ink bg-green px-4 py-3 text-paper">
              <p className="font-body text-[15px] leading-relaxed">
                Sent to <b className="font-mono text-[13px]">{sent.to}</b>.
              </p>
              {/* The transaction id is the whole point of settling on a public
                  ledger: the person can check this themselves, now and later,
                  without believing anything we said. */}
              <p className="mt-1.5 font-mono text-[11px] break-all text-paper/80">
                {sent.transactionId}
              </p>
            </div>
          ) : null}

          {problem ? (
            <p role="alert" className="font-body text-sm text-red">
              {problem}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Two failures a person can act on, and the server names both by field.
 *
 * `to` covers a destination with no Hedera account and one that cannot receive
 * the token yet; the server's own wording is better than anything written here,
 * so it is passed through. `intentId` is the frozen transfer aging out, which
 * is not a failure at all and should not read as one.
 */
function withdrawalMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const first = error.firstFieldError
    if (first) return first
  }
  return errorMessage(error)
}

const input =
  'w-full rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-[15px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="label-micro block text-ink-soft">
        {label}
        {hint ? <span className="ml-2 normal-case">{hint}</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function Choice({
  on,
  label,
  onClick,
}: {
  on: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-chip border-2 border-ink px-3 py-1.5 font-mono text-[12px] transition-transform duration-130 hover:-translate-y-px active:translate-y-px',
        on ? 'bg-ink text-paper' : 'bg-paper text-ink-soft',
      )}
    >
      {label}
    </button>
  )
}
