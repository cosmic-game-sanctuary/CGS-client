import { request } from '@/lib/api'

/**
 * The other end of the splits editor.
 *
 * An invite *is* a membership row: `/invite/:id` takes a `studio_members` id,
 * which is also what a split points at when the person it credits has no wallet
 * yet. That is why the share can exist before the account does.
 *
 * Three things about this API are easy to guess wrong:
 *
 * - **There is no decline endpoint.** Not accepting is the decline, and it is
 *   reversible by opening the link again later. Nothing is destroyed either way.
 * - **The handle is not editable here.** It was chosen by whoever did the
 *   inviting and it is already on the published splits, which are immutable. A
 *   field offering to change it would be offering something we cannot do.
 * - **Accepting settles the money in the background.** The response comes back
 *   before the transfers do, and they only go out if this wallet has a Hedera
 *   account. See `getMyEarnings` for what is still held.
 */

export interface WireInvite {
  /** What this studio calls you on its credits. Already on the splits. */
  handle: string
  /** `owner` means manager, not founder. */
  role: 'owner' | 'member'
  accepted: boolean
  studio: { id: string; name: string; slug: string }
}

export function getInvite(
  id: string,
  signal?: AbortSignal,
): Promise<WireInvite> {
  return request<WireInvite>(`/api/invites/${id}`, { signal })
}

export interface WireAcceptedInvite {
  id: string
  studioId: string
  handle: string
  role: 'owner' | 'member'
  acceptedAt: string | null
}

/**
 * Claim the wallet the share has been accruing to.
 *
 * Idempotent: an invite that was already accepted comes back unchanged rather
 * than failing, so a second click, or a link opened twice, is harmless.
 */
export function acceptInvite(id: string): Promise<WireAcceptedInvite> {
  return request<WireAcceptedInvite>(`/api/invites/${id}/accept`, {
    method: 'POST',
  })
}
