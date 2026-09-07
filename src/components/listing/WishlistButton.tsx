import { useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { addToWishlist, removeFromWishlist } from '@/api/wishlist'
import { signIn, useSession } from '@/auth/session'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { compactCount } from '@/lib/format'

/**
 * Save a game for later, and see how many other people did.
 *
 * Add and remove rather than a toggle. A toggle undoes itself on a double
 * click, and losing something you meant to keep is a worse failure here than
 * pressing save twice — which the server treats as a no-op anyway.
 *
 * The count is shown because it is public and verifiable. Every storefront
 * knows how many people are waiting for a game; this is the only one that
 * writes the number to a public topic where anyone can check it. Hiding it
 * would waste the one thing about the feature nobody else can copy.
 */
export function WishlistButton({
  gameId,
  saved,
  count,
  onChange,
  className,
}: {
  gameId: string
  saved: boolean
  count: number
  onChange: (state: { wishlisted: boolean; wishlistCount: number }) => void
  className?: string
}) {
  const session = useSession()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function toggle() {
    if (!session.signedIn) {
      signIn()
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      const next = saved
        ? await removeFromWishlist(gameId)
        : await addToWishlist(gameId)
      onChange(next)
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const Icon = saved ? BookmarkCheck : Bookmark

  return (
    <div className={className}>
      <Button
        variant={saved ? 'neutral' : 'ghost'}
        size="md"
        className="w-full"
        disabled={busy}
        aria-pressed={saved}
        onClick={() => void toggle()}
      >
        <Icon size={15} strokeWidth={2.5} className={cn(saved && 'text-green')} />
        {saved ? 'On your wishlist' : 'Save for later'}
        {count > 0 ? (
          <span className="tnum ml-auto font-mono text-[11px] text-ink-soft">
            {compactCount(count)}
          </span>
        ) : null}
      </Button>

      {problem ? (
        <p role="alert" className="mt-2 font-mono text-[11px] text-red">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
