import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { withdraw } from '@/api/withdraw'
import { useWalletSigner } from '@/auth/useWalletSigner'
import { ApiError, errorMessage } from '@/lib/api'
import { formatAmount } from '@/lib/format'
import { refreshSession, useSession } from '@/auth/session'
import type { WireAgent } from '@/api/agent'

/**
 * Putting money in the agent's wallet.
 *
 * There is no funding route, and there does not need to be one: the agent's
 * address is an ordinary address, so this is an ordinary withdrawal from your
 * own wallet pointed at it. The same prepare, sign, submit that `/money`
 * already does, with the destination filled in.
 *
 * That is worth knowing rather than hiding. The agent holds *its own* money in
 * *its own* wallet, which is why it can spend while you are asleep and why
 * closing it hands the remainder back rather than settling an account.
 */
export function FundAgent({
  agent,
  onFunded,
}: {
  agent: WireAgent
  onFunded: () => void
}) {
  const session = useSession()
  const signer = useWalletSigner()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [landing, setLanding] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  /**
   * Both balances read the Mirror Node, and the Mirror Node lags the
   * transaction by a few seconds.
   *
   * So a single re-read the instant the transfer returns is guaranteed to show
   * the old number, which looks exactly like the money not having arrived. The
   * transfer is already final on the ledger at that point; this is only waiting
   * for the thing we ask about it to catch up. Four reads over ten seconds,
   * then it stops on its own rather than polling forever.
   */
  useEffect(() => {
    if (!sent) return
    let live = true
    const timers = [1200, 3000, 6000, 10_000].map((ms) =>
      window.setTimeout(() => {
        if (!live) return
        refreshSession()
        onFunded()
        if (ms === 10_000) setLanding(false)
      }, ms),
    )
    return () => {
      live = false
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [sent, onFunded])

  const typed = Number(amount)
  const valid = amount.trim() !== '' && Number.isFinite(typed) && typed > 0
  const tooMuch = valid && typed > session.balanceUsd
  const canSend = valid && !tooMuch && signer.ready && !busy

  async function send() {
    setBusy(true)
    setProblem(null)
    setSent(null)
    try {
      const result = await withdraw(
        {
          to: agent.fundAddress,
          amountUnits: String(
            Math.round(typed * 10 ** session.assetDecimals),
          ),
        },
        signer.signHashes,
      )
      setSent(result.transactionId)
      setLanding(true)
      setAmount('')
      // Both wallets moved: yours down, the agent's up. Neither number will
      // say so yet — see the effect above.
      refreshSession()
      onFunded()
    } catch (error) {
      // The useful sentence is almost always on a field. "That request doesn't
      // look right" is the shape of the failure, never the reason for it.
      setProblem(
        (error instanceof ApiError ? error.firstFieldError : undefined) ??
          errorMessage(error),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-card border-2 border-ink bg-paper-sunk p-5">
      <span className="label-micro block text-ink-soft">
        Put money in
        <span className="ml-2 normal-case">
          you have {formatAmount(session.balanceUsd)}
        </span>
      </span>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[15px] text-ink-soft">$</span>
        <input
          value={amount}
          inputMode="decimal"
          placeholder="1.00"
          onChange={(event) => setAmount(event.target.value)}
          className="max-w-32 rounded-card border-2 border-ink bg-paper px-3 py-2 font-mono text-[15px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
        />
        <Button variant="go" disabled={!canSend} onClick={() => void send()}>
          {busy ? 'Sending…' : 'Send it'}
        </Button>
      </div>

      {tooMuch ? (
        <p className="mt-2 font-mono text-[11px] text-red">
          That is more than your wallet holds.
        </p>
      ) : (
        <p className="mt-2 max-w-[52ch] font-mono text-[11px] leading-relaxed text-ink-soft">
          This is a transfer from your wallet to the agent's, signed by you.
          Whatever it has not spent comes back when you close it.
        </p>
      )}

      {sent ? (
        <div className="mt-2.5 rounded-card border-2 border-ink bg-green px-3 py-2 text-paper">
          <p className="font-mono text-[11px]">
            {landing
              ? 'Sent. Both balances catch up in a few seconds.'
              : 'Sent.'}
          </p>
          <p className="mt-1 font-mono text-[10px] break-all text-paper/80">
            {sent}
          </p>
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="mt-2.5 font-body text-sm text-red">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
