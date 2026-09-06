import { request } from '@/lib/api'
import type { WireGame } from '@/api/wire'

/**
 * Publishing, which is two calls rather than one.
 *
 * `POST /api/games` uploads and creates a **draft**: the zip is unpacked and
 * pinned to IPFS, the media goes up, the splits are written. Nothing is public
 * yet and the splits are still editable, because a draft is the only point at
 * which they are.
 *
 * `POST /api/games/:id/publish` is the irreversible half: it locks the splits,
 * creates the HTS token, and writes the listing to the public HCS topic.
 *
 * The gap between them matters to the UI. If the first succeeds and the second
 * fails, a draft exists with a real build behind it — the screen has to say so
 * rather than looking like nothing happened.
 */

/** One line of the split, as the editor knows the person. */
export interface SplitInput {
  /** For you, or anyone whose address is already known. */
  wallet?: string
  /** Someone already on the studio, picked from the roster. */
  studioMemberId?: string
  /** Someone new. The server creates the membership, and that is the invite. */
  email?: string
  handle: string
  role: string
  pct: number
}

export interface WireDraft extends WireGame {
  status: 'draft' | 'published' | 'delisted' | 'removed'
  /** Memberships this upload created. Each id is an `/invite/:id`. */
  invited: Array<{ id: string; email: string; handle: string }>
}

export interface UploadInput {
  studioId: string
  title: string
  tagline: string
  description: string
  tags: string[]
  /** Integer, smallest units. Never a float. */
  priceUnits: number
  splits: SplitInput[]
  build: File
  media?: File[]
  /** Which `media` entry is the cover. Omit for the generated art. */
  coverMediaIndex?: number
}

export function uploadGame(input: UploadInput): Promise<WireDraft> {
  const form = new FormData()
  form.append('studioId', input.studioId)
  form.append('title', input.title)
  form.append('tagline', input.tagline)
  form.append('description', input.description)
  form.append('priceUnits', String(input.priceUnits))
  form.append('splits', JSON.stringify(input.splits))

  // Repeated field rather than a JSON blob: multer parses these into an array
  // and the server's schema expects one.
  for (const tag of input.tags) form.append('tags', tag)

  form.append('build', input.build, input.build.name)
  for (const file of input.media ?? []) form.append('media', file, file.name)
  if (input.coverMediaIndex !== undefined) {
    form.append('coverMediaIndex', String(input.coverMediaIndex))
  }

  return request<WireDraft>('/api/games', { method: 'POST', form })
}

export function publishDraft(gameId: string): Promise<WireGame> {
  return request<WireGame>(`/api/games/${gameId}/publish`, { method: 'POST' })
}
