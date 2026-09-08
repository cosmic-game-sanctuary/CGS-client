import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Where an invite lives. `/invite/:id` takes a membership row id, because a
 * membership row *is* the invite: it is what a split points at while the person
 * it credits has no wallet yet.
 */
function inviteUrl(memberId: string) {
  return `${window.location.origin}/invite/${memberId}`
}

/**
 * Hand someone their invite link.
 *
 * A control, never a link with the person's address as its text. That read as
 * "email this person" rather than "here is the URL to send them", which is the
 * opposite of what it does.
 *
 * Email is the only channel that reaches somebody with no account, and it is
 * also the one we can least rely on: an unverified sending domain only
 * delivers to our own address, and an invite that bounces is a share nobody can
 * claim. So the link has to be copyable by hand.
 *
 * Revealed as well as copied, because a clipboard write can be refused outright
 * and a button that silently does nothing reads as broken. Selecting the text
 * is the fallback everyone already knows.
 *
 * Returns a fragment: the button, then the URL on its own line. Both callers
 * put it in a `flex-wrap` row, where `basis-full` is what breaks the line.
 */
export function InviteLink({ memberId }: { memberId: string }) {
  const [copied, setCopied] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    setShown(true)
    try {
      await navigator.clipboard.writeText(inviteUrl(memberId))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => void copy()}>
        {copied ? (
          <Check size={13} strokeWidth={3} className="text-green" />
        ) : (
          <Copy size={13} strokeWidth={2.5} />
        )}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      {shown ? (
        <code className="mt-1 basis-full truncate rounded-md border-2 border-ink bg-paper-sunk px-2 py-1 font-mono text-[11px]">
          {inviteUrl(memberId)}
        </code>
      ) : null}
    </>
  )
}
