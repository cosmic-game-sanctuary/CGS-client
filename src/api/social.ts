import { request } from '@/lib/api'
import { adaptReview } from '@/api/adapt'
import type { WireReview, WireReviewPage } from '@/api/wire'
import type { Review } from '@/mocks/types'

/**
 * What people say about a game, and what a studio says back.
 *
 * Reviews and comments are deliberately different things. A review is
 * ownership-gated and carries a rating, so the badge on it means something a
 * stranger can check. A comment is anyone signed in, with no rating and no
 * gate. Building one and calling it the other is how a verified-purchase mark
 * stops being worth anything.
 */

export async function getReviews(
  gameRef: string,
  signal?: AbortSignal,
): Promise<Review[]> {
  const page = await request<WireReviewPage>(
    `/api/games/${encodeURIComponent(gameRef)}/reviews`,
    { query: { limit: 50 }, signal },
  )
  return page.reviews.map(adaptReview)
}

/** Only works if this wallet holds the key. The server checks, not us. */
export function postReview(
  gameId: string,
  body: { rating: number; body: string },
): Promise<WireReview> {
  return request<WireReview>(`/api/games/${gameId}/reviews`, {
    method: 'POST',
    body,
  })
}

export function editReview(
  reviewId: string,
  body: { rating?: number; body?: string },
): Promise<WireReview> {
  return request<WireReview>(`/api/reviews/${reviewId}`, {
    method: 'PATCH',
    body,
  })
}

/** The reviewer only. A studio cannot delete criticism of its own game. */
export function deleteReview(reviewId: string): Promise<void> {
  return request(`/api/reviews/${reviewId}`, { method: 'DELETE' })
}

/**
 * The studio's answer. One per review, manager-gated, and posting again
 * overwrites rather than starting a thread.
 *
 * The reviewer is notified on the first reply only, not on an edit of it,
 * which is the right shape: an author fixing a typo should not ping anyone.
 */
export function replyToReview(reviewId: string, body: string): Promise<WireReview> {
  return request<WireReview>(`/api/reviews/${reviewId}/reply`, {
    method: 'POST',
    body: { body },
  })
}

export function deleteReply(reviewId: string): Promise<WireReview> {
  return request<WireReview>(`/api/reviews/${reviewId}/reply`, {
    method: 'DELETE',
  })
}

// --- reporting ---------------------------------------------------------

export type ReportReason = string

/**
 * Reporting a game delists it immediately, before anyone looks, because a
 * false positive there is cheap to undo.
 */
export function reportGame(
  gameId: string,
  reason: ReportReason,
): Promise<{ id: string }> {
  return request<{ id: string }>('/api/reports', {
    method: 'POST',
    body: { gameId, reason },
  })
}

/**
 * Reporting a review or a comment does **nothing** automatically, and the
 * asymmetry is deliberate. Hiding a review the instant it is reported would
 * hand any developer a one-click way to silence honest criticism of their own
 * game, so this only queues it for a person.
 */
export function reportContent(
  targetType: 'review' | 'comment',
  targetId: string,
  reason: ReportReason,
): Promise<{ id: string }> {
  return request<{ id: string }>('/api/reports/content', {
    method: 'POST',
    body: { targetType, targetId, reason },
  })
}

// --- comments ----------------------------------------------------------

export interface WireComment {
  id: string
  gameId: string
  userId: string
  body: string
  createdAt: string
  editedAt: string | null
  author: string
  authorIsEns: boolean
  authorProfile?: {
    handle: string | null
    displayName: string | null
    avatarUrl: string | null
    address: string
    label: string
  } | null
}

export async function getComments(
  gameRef: string,
  signal?: AbortSignal,
): Promise<WireComment[]> {
  const page = await request<{ comments: WireComment[] }>(
    `/api/games/${encodeURIComponent(gameRef)}/comments`,
    { query: { limit: 50 }, signal },
  )
  return page.comments
}

export function postComment(gameId: string, body: string): Promise<WireComment> {
  return request<WireComment>(`/api/games/${gameId}/comments`, {
    method: 'POST',
    body: { body },
  })
}

/** The author, or a manager of the game's studio. Moderation-lite. */
export function deleteComment(commentId: string): Promise<void> {
  return request(`/api/comments/${commentId}`, { method: 'DELETE' })
}
