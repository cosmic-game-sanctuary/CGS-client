import { Star } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { addReview } from '@/mocks/games'
import { useSession } from '@/mocks/session'
import type { Review } from '@/mocks/types'

/**
 * Only rendered when this wallet holds the game's key. The gate is the point:
 * a review that cannot be posted by someone who never bought the game is worth
 * more than one that can, and anyone can verify that independently.
 */
export function ReviewForm({
  gameId,
  onPosted,
}: {
  gameId: string
  onPosted: (review: Review) => void
}) {
  const session = useSession()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  const shown = hover || rating
  const ready = rating > 0 && body.trim().length > 3

  function post() {
    setPosting(true)
    addReview({
      gameId,
      author: session.email?.split('@')[0] ?? 'you',
      authorIsEns: false,
      rating,
      body: body.trim(),
    })
      .then(onPosted)
      .finally(() => setPosting(false))
  }

  return (
    <div className="mt-5 rounded-card border-2 border-ink bg-paper-sunk p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl">Say something</h3>
        <span className="label-micro rounded-chip border-2 border-ink bg-green px-2 py-0.5 text-paper">
          You own this
        </span>
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <span className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} out of 5`}
              aria-pressed={rating === value}
              onMouseEnter={() => setHover(value)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(0)}
              onClick={() => setRating(value)}
              className="cursor-pointer border-0 bg-transparent p-0.5 transition-transform duration-130 ease-pop hover:scale-125"
            >
              <Star
                size={22}
                strokeWidth={2.5}
                className={cn(
                  value <= shown ? 'fill-yellow text-ink' : 'text-ink-faint',
                )}
              />
            </button>
          ))}
        </span>
        <span className="font-mono tnum text-[13px] font-bold">
          {rating ? `${rating}.0` : ''}
        </span>
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={600}
        placeholder="What was it like?"
        aria-label="Your review"
        className="mt-3.5 w-full resize-y rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-[15px] leading-relaxed outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={!ready || posting} onClick={post}>
          {posting ? 'Posting…' : 'Post review'}
        </Button>
        <span className="font-mono text-[11px] text-ink-soft">
          Posted as {session.email?.split('@')[0] ?? 'you'}. You can only review
          this once.
        </span>
      </div>
    </div>
  )
}
