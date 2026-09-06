import { request } from '@/lib/api'
import type { WireStudioRef } from '@/api/wire'

/**
 * `GET /api/me/library` — every game this wallet actually holds a key for.
 *
 * Checked live against the Mirror Node rather than a local flag, so it is
 * right even for a key that reached this wallet without passing through the
 * store. That is the whole ownership claim being true rather than asserted.
 *
 * Only `removed` games are excluded: a delisted game leaves the catalog but
 * stays playable for anyone already holding a key, which is the promise.
 */
export interface WireLibraryGame {
  id: string
  slug: string
  title: string
  tagline: string
  studio: WireStudioRef
  coverCid: string | null
  coverUrl: string | null
  coverSeed: number
  status: 'draft' | 'published' | 'delisted' | 'removed'
  /** The GameKey's serial number. Null while the mint is still settling. */
  serial: number | null
  myPlayCount: number
  myPlaytimeSeconds: number
}

export async function getLibrary(
  signal?: AbortSignal,
): Promise<WireLibraryGame[]> {
  const { games } = await request<{ games: WireLibraryGame[] }>(
    '/api/me/library',
    { signal },
  )
  return games
}
