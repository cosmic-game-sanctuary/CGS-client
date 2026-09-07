import { hostExists, previewHost } from '@/lib/previewHost'
import { listSaves, readSave, writeSave } from '@/api/saves'

/**
 * Carrying a browser game's progress between machines.
 *
 * The build writes to `localStorage` on the isolated build origin, which is
 * exactly the boundary that stops an uploaded game reading this page. So the
 * app never touches that storage directly: the host frame does it, because it
 * is the one thing that lives on both sides of the line.
 *
 * The whole origin is snapshotted rather than a namespaced subset. The keys
 * belong to the game and we never parse them — the API calls the payload
 * opaque and this keeps that true. Only one build runs at a time, so a restore
 * can clear first without losing anything of anyone else's.
 *
 * Every failure here is swallowed. A save that will not load must never stop a
 * game someone owns from starting; the worst case is that they play from where
 * this browser left off, which is exactly what happened before any of this
 * existed.
 */

/** One slot, because a person picking between three is a feature nobody asked for. */
const SLOT = 0

function device(): string {
  // Enough to tell "my laptop" from "my phone" in a conflict, and nothing more.
  return /Mobi|Android/i.test(navigator.userAgent) ? 'phone' : 'computer'
}

export interface SaveSession {
  /** The version last read, so a write can detect somebody else's change. */
  baseVersion?: number
}

/**
 * Pull the newest save down and put it where the game will look, before it
 * looks. Returns what to hand back to `pushSave` afterwards.
 */
export async function pullSave(gameId: string): Promise<SaveSession> {
  try {
    const { slots } = await listSaves(gameId)
    const newest = slots.find((s) => s.slot === SLOT) ?? slots[0]
    if (!newest) return {}

    const full = await readSave(gameId, newest.slot)
    const entries = JSON.parse(full.data) as Record<string, string>

    const host = await previewHost()
    await host.send({ op: 'restore', entries })
    return { baseVersion: full.version }
  } catch {
    return {}
  }
}

/**
 * Read the game's storage back out and send it up.
 *
 * Called when the frame goes away. A conflict is not resolved here: the write
 * simply does not happen, because the alternative is guessing which of two
 * opaque blobs is the real one and there is no honest way to do that.
 */
export async function pushSave(
  gameId: string,
  session: SaveSession,
): Promise<void> {
  if (!hostExists()) return
  try {
    const host = await previewHost()
    const { entries } = await host.send({ op: 'snapshot' })
    if (!entries || Object.keys(entries).length === 0) return

    await writeSave(gameId, SLOT, {
      data: JSON.stringify(entries),
      device: device(),
      baseVersion: session.baseVersion,
    })
  } catch {
    // Includes SAVE_CONFLICT, which means a newer save exists elsewhere and
    // this one is the stale side. Refusing to overwrite is the right outcome.
  }
}
