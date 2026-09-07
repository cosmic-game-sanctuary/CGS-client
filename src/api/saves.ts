import { request } from '@/lib/api'

/**
 * Where a browser game's progress lives when it is not in this browser.
 *
 * A build writes to `localStorage` on its own isolated origin, so clearing site
 * data or opening the game on a phone loses everything. These four routes are
 * the somewhere-else. The data is opaque on both sides: whatever came out of
 * the game's storage goes back in unread.
 */

export interface WireSaveSlot {
  slot: number
  label: string | null
  sizeBytes: number
  checksum: string
  device: string | null
  /** Send this back as `baseVersion` to avoid overwriting somebody else. */
  version: number
  updatedAt: string
}

export interface WireSaveList {
  slots: WireSaveSlot[]
  maxSlots: number
  maxBytes: number
}

export function listSaves(
  gameRef: string,
  signal?: AbortSignal,
): Promise<WireSaveList> {
  return request<WireSaveList>(
    `/api/games/${encodeURIComponent(gameRef)}/saves`,
    { signal },
  )
}

export function readSave(
  gameRef: string,
  slot: number,
  signal?: AbortSignal,
): Promise<WireSaveSlot & { data: string }> {
  return request(
    `/api/games/${encodeURIComponent(gameRef)}/saves/${slot}`,
    { signal },
  )
}

/**
 * `baseVersion` is the one thing to get right. Send the version you last read
 * and a slot that changed elsewhere answers `409 SAVE_CONFLICT` with both
 * sides described, instead of silently losing whichever save was older.
 *
 * Omitting it means "overwrite, I know", which is correct for a first write
 * and wrong for everything after.
 */
export function writeSave(
  gameRef: string,
  slot: number,
  body: { data: string; label?: string; device?: string; baseVersion?: number },
): Promise<WireSaveSlot> {
  return request<WireSaveSlot>(
    `/api/games/${encodeURIComponent(gameRef)}/saves/${slot}`,
    { method: 'PUT', body },
  )
}

export function deleteSave(gameRef: string, slot: number): Promise<void> {
  return request(`/api/games/${encodeURIComponent(gameRef)}/saves/${slot}`, {
    method: 'DELETE',
  })
}
