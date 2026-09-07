import { request } from '@/lib/api'
import type { WireStudio } from '@/api/wire'

/**
 * Making a studio, and checking a name before you commit to it.
 *
 * Both of these touch Sepolia. The availability check is a simulated call, so
 * it costs nothing but a round trip; creating with a name is a real
 * transaction and takes ten seconds or more. Every caller has to be written
 * for that rather than for the usual sub-second API.
 */

export interface WireEnsAvailability {
  name: string
  /** The full name being claimed, so nothing here hardcodes the parent. */
  fullName: string | null
  available: boolean
  /** True since the check became a live subregistry call rather than a lookup. */
  checkedOnChain: boolean
}

export function checkEnsName(
  name: string,
  signal?: AbortSignal,
): Promise<WireEnsAvailability> {
  return request<WireEnsAvailability>('/api/studios/ens-availability', {
    query: { name },
    signal,
  })
}

export interface WireCreatedStudio extends WireStudio {
  handle: string
  /** The Sepolia transaction that claimed the name, when one was claimed. */
  ensTxHash: string | null
}

export function createStudio(body: {
  name: string
  handle?: string
  bio?: string
  ensSubname?: string
}): Promise<WireCreatedStudio> {
  return request<WireCreatedStudio>('/api/studios', { method: 'POST', body })
}

// --- the roster --------------------------------------------------------
//
// The team and the credit ledger are separate, and that separation is the only
// reason removing someone is safe to offer at all. `splits` is permanent: every
// share ever paid or held stays exactly where it is. Membership says who is on
// the team right now; it never says what anyone earned.

export interface WireMemberOutcome {
  /**
   * deleted          — nobody had credited them, so the row is simply gone.
   * deactivated      — they are on a split or a held payout, so the row
   *                    survives and only drops off rosters and permissions.
   * already-inactive — remove called twice. Not an error.
   */
  outcome: 'deleted' | 'deactivated' | 'already-inactive'
  member: { id: string; handle: string; active: boolean }
}

/** Manager-gated. `IS_FOUNDER` if aimed at the studio's founder. */
export function removeMember(
  studioId: string,
  memberId: string,
): Promise<WireMemberOutcome> {
  return request<WireMemberOutcome>(
    `/api/studios/${studioId}/members/${memberId}`,
    { method: 'DELETE' },
  )
}

/** Yourself. A founder cannot leave; they transfer the studio first. */
export function leaveStudio(studioId: string): Promise<WireMemberOutcome> {
  return request<WireMemberOutcome>(`/api/studios/${studioId}/leave`, {
    method: 'POST',
  })
}

/**
 * `owner` here means **manager**, not founder. A manager can edit listings,
 * invite people and manage the roster, but cannot transfer the studio.
 */
export function setMemberRole(
  studioId: string,
  memberId: string,
  role: 'owner' | 'member',
): Promise<{ id: string; handle: string; role: 'owner' | 'member' }> {
  return request(`/api/studios/${studioId}/members/${memberId}`, {
    method: 'PATCH',
    body: { role },
  })
}

export function resendInvite(
  studioId: string,
  memberId: string,
): Promise<{ sent: boolean }> {
  return request(`/api/studios/${studioId}/members/${memberId}/resend-invite`, {
    method: 'POST',
  })
}

/**
 * Hand the studio over. Founder-only, even though a manager can do nearly
 * everything else, and the target must already be an accepted active member.
 * The old founder stays on as a manager afterwards.
 */
export function transferStudio(
  studioId: string,
  toMemberId: string,
): Promise<{ ownerUserId: string }> {
  return request(`/api/studios/${studioId}/transfer`, {
    method: 'POST',
    body: { toMemberId },
  })
}
