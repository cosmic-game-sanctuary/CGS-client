import { useState } from 'react'
import { Freehand } from '@/components/icons/Freehand'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { submitReport } from '@/mocks/games'

const REASONS = [
  'Stolen or reuploaded work',
  'Illegal content',
  'Malware or a broken build',
  'Misleading listing',
  'Something else',
]

/**
 * Reports pull a game from the catalog immediately, and the 24 hour commitment
 * is honest about being two people rather than a fake real-time promise.
 */
export function ReportDialog({
  gameId,
  gameTitle,
  onClose,
}: {
  gameId: string
  gameTitle: string
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  function send() {
    setSending(true)
    submitReport({ gameId, reason, detail: detail.trim() })
      .then(() => setDone(true))
      .finally(() => setSending(false))
  }

  return (
    <Modal eyebrow={gameTitle} title={done ? 'Report filed' : 'Report this game'} onClose={onClose}>
      {done ? (
        <div className="flex items-start gap-4">
          <Freehand name="security-shield-wall" className="h-14 w-14 shrink-0 text-pink" />
          <div>
            <p className="font-body text-[15px] leading-relaxed">
              It is out of the catalog already. A human looks at it within 24
              hours, and there are two of us, so that is a real number.
            </p>
            <Button variant="neutral" className="mt-4" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <>
          <span className="label-micro block text-ink-soft">What is wrong</span>
          <div className="mt-2.5 flex flex-col gap-2">
            {REASONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={reason === option}
                onClick={() => setReason(option)}
                className={cn(
                  'cursor-pointer rounded-card border-2 border-ink px-3.5 py-2.5 text-left font-body text-[15px] transition-transform duration-130 hover:-translate-y-px active:translate-y-px',
                  reason === option ? 'bg-pink text-paper' : 'bg-paper text-ink',
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            rows={3}
            maxLength={800}
            placeholder="Anything that helps us check it quickly."
            aria-label="Details"
            className="mt-4 w-full resize-y rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-[15px] leading-relaxed outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={!reason || sending} onClick={send}>
              {sending ? 'Sending…' : 'Send report'}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-soft">
            Reported games come out of the catalog straight away, before anyone
            reads this.
          </p>
        </>
      )}
    </Modal>
  )
}
