import { Flag, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { deleteReply, deleteReview, replyToReview, reportContent } from '@/api/social'
import { errorMessage } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { signIn, useSession } from '@/auth/session'
import type { Review } from '@/mocks/types'

/**
 * What people who own the game said, and what the studio said back.
 *
 * Two asymmetries here are deliberate and both are about who gets to silence
 * whom. A studio can reply to a review but never delete one. Reporting a
 * review does nothing on its own, unlike reporting a game, which delists it
 * immediately — a developer with a one-click way to hide criticism of their
 * own game is a worse failure than a bad review staying up for a day.
 */
export function ReviewList({
  reviews,
  canReply,
  onChange,
  onDeleted,
}: {
  reviews: Review[] | null
  /** True when the viewer manages the studio behind this game. */
  canReply: boolean
  onChange: (review: Review) => void
  onDeleted: (reviewId: string) => void
}) {
  if (reviews === null) {
    return (
      <div className="mt-5 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="hatch h-24 rounded-card border-2 border-ink" />
        ))}
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <p className="mt-5 rounded-card border-2 border-dashed border-ink-faint px-5 py-6 font-body text-sm text-ink-soft">
        No reviews yet. The first one has to come from someone who owns it.
      </p>
    )
  }

  return (
    <ul className="mt-5 flex list-none flex-col gap-3 p-0">
      {reviews.map((review) => (
        <ReviewRow
          key={review.id}
          review={review}
          canReply={canReply}
          onChange={onChange}
          onDeleted={onDeleted}
        />
      ))}
    </ul>
  )
}

function ReviewRow({
  review,
  canReply,
  onChange,
  onDeleted,
}: {
  review: Review
  canReply: boolean
  onChange: (review: Review) => void
  onDeleted: (reviewId: string) => void
}) {
  const session = useSession()
  const [replying, setReplying] = useState(false)
  const [draft, setDraft] = useState(review.developerReply ?? '')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [reported, setReported] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Only the reviewer. A studio can reply to criticism of its own game but
  // never remove it, which is the asymmetry the whole review gate exists for.
  const isMine =
    session.userId !== null && session.userId === review.authorUserId

  async function remove() {
    setBusy(true)
    setProblem(null)
    try {
      await deleteReview(review.id)
      onDeleted(review.id)
    } catch (error) {
      setProblem(errorMessage(error))
      setBusy(false)
    }
  }

  async function saveReply() {
    setBusy(true)
    setProblem(null)
    try {
      const updated = await replyToReview(review.id, draft.trim())
      onChange({
        ...review,
        developerReply: updated.developerReply ?? draft.trim(),
        developerReplyAt: updated.developerReplyAt ?? new Date().toISOString(),
      })
      setReplying(false)
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function clearReply() {
    setBusy(true)
    setProblem(null)
    try {
      await deleteReply(review.id)
      onChange({ ...review, developerReply: null, developerReplyAt: null })
      setDraft('')
      setReplying(false)
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function report() {
    if (!session.signedIn) {
      signIn()
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await reportContent('review', review.id, 'Reported from the listing')
      setReported(true)
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-card border-2 border-ink bg-paper p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Avatar
          src={review.authorAvatarUrl}
          name={review.author}
          size={22}
        />
        {/* The name is printed as the server resolved it. Truncating it here
            was right when it was always an address and mangles a real one. */}
        {review.authorHandle ? (
          <Link
            to={`/u/${review.authorHandle}`}
            className="font-mono text-[13px] font-semibold no-underline hover:underline"
          >
            {review.author}
          </Link>
        ) : (
          <span className="font-mono text-[13px] font-semibold">
            {review.author}
          </span>
        )}
        <span className="label-micro rounded-chip border-2 border-ink bg-green px-2 py-0.5 text-paper">
          Verified purchase
        </span>
        <span className="ml-auto font-mono text-[11px] text-ink-soft">
          {timeAgo(review.createdAt)}
        </span>
      </div>

      <div className="mt-2 flex gap-0.5" aria-label={`${review.rating} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={13}
            strokeWidth={2.5}
            className={cn(
              n <= review.rating ? 'fill-yellow text-ink' : 'text-ink-faint',
            )}
          />
        ))}
      </div>

      <p className="mt-2.5 max-w-[62ch] font-body text-[15px] leading-relaxed">
        {review.body}
      </p>

      {review.developerReply && !replying ? (
        <div className="mt-3 rounded-card border-2 border-ink bg-paper-sunk px-4 py-3">
          <span className="label-micro text-ink-soft">
            From the studio
            {review.developerReplyAt
              ? ` · ${timeAgo(review.developerReplyAt)}`
              : ''}
          </span>
          <p className="mt-1.5 max-w-[62ch] font-body text-[15px] leading-relaxed">
            {review.developerReply}
          </p>
        </div>
      ) : null}

      {replying ? (
        <div className="mt-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={1000}
            autoFocus
            aria-label="Your reply"
            placeholder="Answer them, once."
            className="w-full resize-y rounded-card border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-[15px] leading-relaxed outline-none placeholder:text-ink-faint focus:shadow-hard-sm"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={busy || draft.trim().length < 2}
              onClick={() => void saveReply()}
            >
              {review.developerReply ? 'Update reply' : 'Post reply'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
              Cancel
            </Button>
            {review.developerReply ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void clearReply()}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t-2 border-paper-deep pt-2.5">
        {isMine ? (
          confirming ? (
            <span className="flex items-center gap-2 font-mono text-[11px]">
              Delete it?
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[11px] font-bold text-red underline"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[11px] text-ink-soft underline"
              >
                Keep it
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[11px] text-ink-soft underline hover:text-ink"
            >
              Delete your review
            </button>
          )
        ) : null}

        {canReply && !replying ? (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[11px] text-ink-soft underline hover:text-ink"
          >
            {review.developerReply ? 'Edit your reply' : 'Reply as the studio'}
          </button>
        ) : null}

        {isMine ? null : reported ? (
          <span className="ml-auto font-mono text-[11px] text-ink-soft">
            Reported. A person will look at it.
          </span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void report()}
            className="ml-auto flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-mono text-[11px] text-ink-faint hover:text-ink"
          >
            <Flag size={11} strokeWidth={2.5} />
            Report
          </button>
        )}
      </div>

      {problem ? (
        <p role="alert" className="mt-2 font-mono text-[11px] text-red">
          {problem}
        </p>
      ) : null}
    </li>
  )
}
