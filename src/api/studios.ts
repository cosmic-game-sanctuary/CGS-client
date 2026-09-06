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
