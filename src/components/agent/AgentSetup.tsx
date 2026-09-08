import { useState } from 'react'
import { Freehand } from '@/components/icons/Freehand'
import { Button } from '@/components/ui/Button'
import { createAgent, type WireAgent } from '@/api/agent'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * The first visit, when there is no agent yet.
 *
 * One screen, one button, and the pitch stated once: pick games and a ceiling,
 * and stop watching sale timers. The temptation here is to explain the whole
 * mechanism, which is the wrong thing to read before you have decided whether
 * you want one at all.
 *
 * The one real choice is **mode**, because it is the only thing that changes
 * what happens while nobody is looking. ENS is skipped: it is genuinely
 * optional server-side, it costs a slow Sepolia write, and a name is not a
 * decision anyone should be asked for before their agent exists.
 */
export function AgentSetup({ onMade }: { onMade: (agent: WireAgent) => void }) {
  const [mode, setMode] = useState<'autonomous' | 'ask_first'>('autonomous')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function make() {
    setBusy(true)
    setProblem(null)
    try {
      onMade(await createAgent({ mode }))
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col items-start gap-5 rounded-card border-2 border-ink bg-blue px-7 py-9 text-paper shadow-hard md:flex-row md:items-center md:gap-8">
        <Freehand name="share-radar" className="h-24 w-24 shrink-0" />
        <div>
          <h2 className="text-[clamp(24px,3.4vw,34px)] text-paper">
            Give it a budget. It does the waiting.
          </h2>
          <p className="mt-2.5 max-w-[52ch] font-body text-[16px] leading-relaxed text-paper/85">
            Save the games you want, say the most you would pay for each, and
            put some money in. When a price drops far enough it buys, and the
            key lands in your library. You never watch a sale timer again.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-card border-2 border-ink bg-paper-sunk p-5">
        <span className="label-micro block text-ink-soft">
          When it cannot have everything
        </span>
        <p className="mt-1.5 max-w-[56ch] font-body text-[14px] leading-relaxed text-ink-soft">
          Two games it wants both go on sale and the money covers one. That is
          the only moment this choice matters.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Choice
            on={mode === 'autonomous'}
            onClick={() => setMode('autonomous')}
            title="Decide for me"
            body="It picks, buys, and tells you what it did and why."
          />
          <Choice
            on={mode === 'ask_first'}
            onClick={() => setMode('ask_first')}
            title="Ask me first"
            body="It asks, with a deadline, when there is time to ask. When there isn't, it acts."
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t-2 border-ink pt-4">
          <Button variant="primary" disabled={busy} onClick={() => void make()}>
            {busy ? 'Making it…' : 'Make my agent'}
          </Button>
          <span className="max-w-[40ch] font-mono text-[11px] leading-relaxed text-ink-soft">
            You can change this later, and close it any time. Whatever is left
            comes back.
          </span>
        </div>

        {problem ? (
          <p role="alert" className="mt-3 font-body text-sm text-red">
            {problem}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Choice({
  on,
  title,
  body,
  onClick,
}: {
  on: boolean
  title: string
  body: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-card border-2 border-ink px-4 py-3 text-left transition-transform duration-130 hover:-translate-y-px',
        on ? 'bg-ink text-paper shadow-hard' : 'bg-paper text-ink',
      )}
    >
      <span className="block font-wonk text-[17px]">{title}</span>
      <span
        className={cn(
          'mt-1 block font-body text-[13px] leading-relaxed',
          on ? 'text-paper/80' : 'text-ink-soft',
        )}
      >
        {body}
      </span>
    </button>
  )
}
