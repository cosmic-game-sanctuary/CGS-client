import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { updateAgent, type WireAgent } from '@/api/agent'
import { checkEnsName } from '@/api/studios'
import { errorMessage } from '@/lib/api'
import { useDebounced } from '@/lib/useDebounced'

/**
 * The agent's own name on ENS.
 *
 * **Here rather than in `AgentSetup`, on purpose.** A name is not a decision
 * anyone should be asked for before their agent exists, and claiming one is a
 * slow Sepolia write that has no business sitting in the middle of setup. The
 * server has accepted `ensLabel` on create since the agent shipped and nothing
 * ever sent it, so in practice no agent could get a name at all. This is the
 * field that was missing, at the point in the story where it makes sense: the
 * thing exists, it is holding money and buying games, and now it can be called
 * something other than an address.
 *
 * What the name is *for* is the same thing a studio subname is for. An agent
 * spends real money in public under an identity anyone can resolve, and
 * `lottie.cgs-sanctuary.eth` is checkable by anyone with a Sepolia node while
 * `0x9f3c…` is a string to compare by eye.
 *
 * Write-once, and the copy says so before the button rather than after. The
 * name is a position in a registry, so a rename would mint a second one and
 * leave the first pointing at the same wallet.
 */
export function AgentName({
  agent,
  onNamed,
}: {
  agent: WireAgent
  onNamed: () => void
}) {
  if (agent.ensName) {
    return (
      <p className="mt-2 rounded-chip border-2 border-ink bg-paper-sunk px-2.5 py-1 text-center font-mono text-[12px] font-semibold">
        {agent.ensName}
      </p>
    )
  }
  return <ClaimName onNamed={onNamed} />
}

function ClaimName({ onNamed }: { onNamed: () => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const clean = label.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')

  // Every check is a live call against the subregistry on Sepolia, so it waits
  // for typing to stop. Results carry the label they were fetched for, which is
  // what stops a slow answer for "lot" landing under "lottie". Same shape as
  // `StudioSetup`, because it is the same namespace and the same question.
  const settled = useDebounced(clean, 400)
  const [checked, setChecked] = useState<{
    label: string
    available: boolean
    fullName: string | null
  } | null>(null)
  const [parent, setParent] = useState<string | null>(null)

  useEffect(() => {
    if (!settled) return
    const controller = new AbortController()
    checkEnsName(settled, controller.signal)
      .then((result) => {
        setChecked({
          label: settled,
          available: result.available,
          fullName: result.fullName,
        })
        if (result.fullName) {
          setParent(result.fullName.slice(settled.length + 1))
        }
      })
      .catch(() => {
        // Unreachable is not the same as taken. Leave it unanswered rather
        // than telling someone a free name is gone.
      })
    return () => controller.abort()
  }, [settled])

  const current = checked?.label === clean ? checked : null
  const checking = clean.length > 0 && current === null
  const taken = current?.available === false
  const ready = clean.length > 0 && !checking && !taken && !busy

  function claim() {
    setBusy(true)
    setProblem(null)
    updateAgent({ ensLabel: clean })
      .then(() => onNamed())
      .catch((error: unknown) => setProblem(errorMessage(error)))
      .finally(() => setBusy(false))
  }

  if (!open) {
    return (
      <div className="mt-2">
        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => setOpen(true)}
        >
          Give it a name
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-card border-2 border-ink bg-paper-sunk px-3 py-2.5">
      <span className="label-micro block text-ink-soft">Name it</span>

      <div className="mt-1.5 flex items-baseline gap-1">
        <input
          type="text"
          value={label}
          autoFocus
          maxLength={63}
          placeholder="lottie"
          aria-label="A name for your agent"
          onChange={(event) => setLabel(event.target.value)}
          className="min-w-0 flex-1 rounded-chip border-2 border-ink bg-paper px-2 py-1 font-mono text-[12px] outline-none"
        />
        <span className="shrink-0 font-mono text-[11px] text-ink-soft">
          .{parent ?? 'cgs-sanctuary.eth'}
        </span>
      </div>

      <p className="mt-1.5 font-mono text-[10px] leading-snug text-ink-soft">
        {clean.length === 0
          ? 'Anyone can resolve it. It cannot be changed once it is claimed.'
          : checking
            ? 'Checking on chain…'
            : taken
              ? 'That one is taken. Try another.'
              : `${clean}.${parent ?? 'cgs-sanctuary.eth'} is free.`}
      </p>

      {problem ? (
        <p role="alert" className="mt-1.5 font-mono text-[10px] text-red">
          {problem}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="neutral" disabled={!ready} onClick={claim}>
          {busy ? 'Claiming…' : 'Claim it'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Not now
        </Button>
      </div>

      <p className="mt-1.5 font-mono text-[10px] leading-snug text-ink-soft">
        This writes to Sepolia and takes a few seconds.
      </p>
    </div>
  )
}
