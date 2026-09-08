import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { setWant } from '@/api/wishlist'
import { ApiError, errorMessage } from '@/lib/api'
import { formatAmount } from '@/lib/format'
import { useSession } from '@/auth/session'

/**
 * Hand this game to your agent, from the game itself.
 *
 * A want is set here rather than on the agent page for the same reason a price
 * trigger always was: choosing a game and choosing a ceiling for it are one
 * decision, made while looking at the game. The agent page is where you find
 * out what happened, not where you pick.
 *
 * Only offered on a game already saved, because a want *is* a saved game with
 * a ceiling on it. The server says the same thing by refusing otherwise, and
 * the wishlist button is right above this one.
 */
export function WantButton({
  gameId,
  priceUsd,
  saved,
  want,
  onChanged,
}: {
  gameId: string
  priceUsd: number
  /** Wishlisted. A want cannot exist without one. */
  saved: boolean
  /** The ceiling already set, in integer units, or null. */
  want: number | null
  onChanged: () => void
}) {
  const session = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [max, setMax] = useState(() =>
    want !== null ? String(want / 10 ** session.assetDecimals) : '',
  )
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [noAgent, setNoAgent] = useState(false)

  if (!saved) return null

  const typed = Number(max)
  const valid = max.trim() !== '' && Number.isFinite(typed) && typed > 0
  const tooHigh = valid && typed >= priceUsd

  async function save(clear = false) {
    setBusy(true)
    setProblem(null)
    setNoAgent(false)
    try {
      await setWant(gameId, {
        agentMaxUnits: clear
          ? null
          : Math.round(typed * 10 ** session.assetDecimals),
        ...(clear || !note.trim() ? {} : { agentNote: note.trim() }),
      })
      setOpen(false)
      onChanged()
    } catch (error) {
      // The one refusal with somewhere to go rather than something to fix.
      if (error instanceof ApiError && error.code === 'NO_AGENT') {
        setNoAgent(true)
      } else {
        setProblem(errorMessage(error))
      }
    } finally {
      setBusy(false)
    }
  }

  if (want !== null && !open) {
    return (
      <div className="mt-2 rounded-card border-2 border-ink bg-blue px-3.5 py-2.5 text-paper">
        <p className="font-mono text-[11px] leading-relaxed">
          Your agent buys this at{' '}
          <b className="tnum">
            {formatAmount(want / 10 ** session.assetDecimals)}
          </b>{' '}
          or under.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" variant="neutral" onClick={() => setOpen(true)}>
            Change it
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save(true)}>
            <span className="text-paper">{busy ? 'Removing…' : 'Stop'}</span>
          </Button>
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <Button
        variant="neutral"
        size="sm"
        className="mt-2 w-full"
        onClick={() => setOpen(true)}
      >
        Let my agent buy it
      </Button>
    )
  }

  return (
    <div className="mt-2 rounded-card border-2 border-ink bg-paper-sunk px-3.5 py-3">
      <span className="label-micro block text-ink-soft">
        Buy it for me at or under
      </span>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="font-mono text-[15px] text-ink-soft">$</span>
        <input
          value={max}
          inputMode="decimal"
          autoFocus
          placeholder={(priceUsd / 2).toFixed(2)}
          onChange={(event) => setMax(event.target.value)}
          className="w-full rounded-card border-2 border-ink bg-paper px-3 py-2 font-mono text-[15px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
        />
      </div>

      <input
        value={note}
        placeholder="A note to your agent, optional"
        maxLength={280}
        onChange={(event) => setNote(event.target.value)}
        className="mt-2 w-full rounded-card border-2 border-ink bg-paper px-3 py-2 font-body text-[14px] outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
      />

      {tooHigh ? (
        <p className="mt-1.5 font-mono text-[11px] text-red">
          That is the price already. Pick something lower, or just buy it.
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="primary"
          disabled={!valid || tooHigh || busy}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Set it'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      {noAgent ? (
        <div className="mt-2.5 border-t-2 border-ink pt-2.5">
          <p className="font-mono text-[11px] leading-relaxed text-ink-soft">
            You have no agent yet. It takes one press and a little money.
          </p>
          <Button
            size="sm"
            variant="neutral"
            className="mt-1.5"
            onClick={() => navigate('/agent')}
          >
            Set one up
          </Button>
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="mt-2 font-body text-sm text-red">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
