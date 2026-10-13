import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import {
  GAS_RESERVE_UNITS,
  MintNotSent,
  sendMint,
  withdrawFromGateway,
  type GatewayWithdrawStage,
} from '@/api/trials'
import { errorMessage } from '@/lib/api'
import { formatAmount } from '@/lib/format'
import { useWalletSigner } from '@/auth/useWalletSigner'

/**
 * Money a trial deposit put into Circle Gateway and nobody played, and the way
 * to take it back.
 *
 * It lives inside the "In your wallet" card rather than as a figure of its own,
 * because it is the same person's money one step removed, and for most people
 * it is nothing at all. So everything here is conditional, and the component
 * draws its own divider: an empty slot would otherwise leave a dashed rule
 * under the wallet for no reason.
 *
 * **Two numbers, and they differ on purpose.** What is set aside is what is
 * there; what can come back is less, because Circle takes its fee on top of a
 * withdrawal from the same balance. Both come from the server. Offering the
 * whole balance was the original bug: Circle refused it every time.
 *
 * **The last step is the one that can strand money**, so it is the one kept
 * hold of. Once Circle has released the funds, the transaction that lands them
 * in the wallet exists only in this component; a failure there keeps it and
 * offers to finish sending, rather than showing an error and forgetting the
 * only copy.
 */
export function SetAside({
  availableUnits,
  withdrawableUnits,
  walletUnits,
  decimals,
  onChanged,
}: {
  availableUnits: number
  withdrawableUnits: number
  walletUnits: number
  decimals: number
  /** Money moved; re-read the wallet and this figure. */
  onChanged: () => void
}) {
  const wallet = useWalletSigner()
  const [stage, setStage] = useState<GatewayWithdrawStage | null>(null)
  const [pending, setPending] = useState<MintNotSent | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // What came back, held after success. The figure behind it lags Circle by a
  // few seconds, and a line still saying "$0.24 set aside" with its button
  // beside a withdrawal that just finished would invite a second press.
  const [sentUnits, setSentUnits] = useState<number | null>(null)

  const toUsd = (units: number) => units / 10 ** decimals
  // We show money to the cent. Less than one rounds to a figure that is not
  // true, and dust that small can neither come out nor buy a minute of play.
  const cent = 10 ** (decimals - 2)
  // Only the rare fallback needs the wallet's own gas: the server normally
  // sends the mint itself, so taking money back works from an empty wallet.
  // "Finish sending" is that fallback and keeps the guard.
  const canPayGas = walletUnits >= GAS_RESERVE_UNITS
  const busy = stage !== null

  async function run(action: () => Promise<number>) {
    setProblem(null)
    try {
      const units = await action()
      setPending(null)
      setSentUnits(units)
      onChanged()
    } catch (error) {
      if (error instanceof MintNotSent) setPending(error)
      else setProblem(errorMessage(error))
    } finally {
      setStage(null)
    }
  }

  const takeBack = () =>
    run(async () =>
      Number((await withdrawFromGateway(wallet, setStage)).amountUnits),
    )

  const finishSending = (stuck: MintNotSent) =>
    run(async () => {
      await sendMint(stuck.mint, stuck.amountUnits, wallet, setStage)
      return Number(stuck.amountUnits)
    })

  if (sentUnits !== null) {
    return (
      <Line>
        Sent <Amount usd={toUsd(sentUnits)} /> back to your wallet.
      </Line>
    )
  }

  if (pending) {
    return (
      <Line>
        <Amount usd={toUsd(Number(pending.amountUnits))} /> is released, but
        sending it to your wallet did not finish.
        <Action>
          <Button
            variant="neutral"
            size="sm"
            disabled={busy || !canPayGas}
            onClick={() => void finishSending(pending)}
          >
            {busy ? STAGE_LABEL[stage] : 'Finish sending'}
          </Button>
        </Action>
        {!canPayGas ? <Hint>{NEEDS_GAS}</Hint> : null}
      </Line>
    )
  }

  if (availableUnits < cent) return null

  return (
    <Line>
      Plus <Amount usd={toUsd(availableUnits)} /> set aside for trials. Your
      next one uses it first, on any game.
      {withdrawableUnits >= cent ? (
        <>
          <Action>
            <Button
              variant="neutral"
              size="sm"
              disabled={busy}
              onClick={() => void takeBack()}
            >
              {busy
                ? STAGE_LABEL[stage]
                : `Take ${formatAmount(toUsd(withdrawableUnits))} back`}
            </Button>
          </Action>
          <Hint>A fee of under a cent comes out of it.</Hint>
        </>
      ) : null}
      {problem ? (
        <span role="alert" className="mt-1.5 block text-red">
          {problem}
        </span>
      ) : null}
    </Line>
  )
}

const STAGE_LABEL: Record<GatewayWithdrawStage, string> = {
  signing: 'Signing…',
  releasing: 'Releasing…',
  sending: 'Sending to your wallet…',
}

const NEEDS_GAS = 'Your wallet needs a cent to cover sending it.'

function Line({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 border-t-2 border-dashed border-ink-faint pt-1.5 font-mono text-[11px] leading-relaxed text-ink-soft">
      {children}
    </div>
  )
}

function Amount({ usd }: { usd: number }) {
  return <b className="tnum text-ink">{formatAmount(usd)}</b>
}

function Action({ children }: { children: ReactNode }) {
  return <span className="mt-2 block">{children}</span>
}

function Hint({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-[10px] text-ink-faint">{children}</span>
}
