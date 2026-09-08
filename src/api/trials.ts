import { request } from '@/lib/api'

/**
 * Paid trials: chunks of play that come off the price if you buy.
 *
 * Every chunk is a real x402 payment, prepared and signed the same two-step way
 * a purchase is, so `buyChunk` below is `buyGame` pointed at a different pair
 * of URLs. What a chunk buys is *time*, never ownership: no GameKey mints, and
 * what was spent becomes credit against the eventual purchase instead.
 *
 * **The credit is applied by the server, not here.** `GET /download` reduces
 * what it charges by whatever this account has spent trialling, so buying after
 * a trial needs no new call and no branch. Nothing on this side should ever
 * subtract a credit from a price itself.
 *
 * **A trial is honoured, not enforced.** The build is unpacked in the browser,
 * so once someone has it they have it. The server says as much, and the timer
 * is a promise the page keeps rather than a lock the server holds.
 */

export interface WireTrial {
  /** False, with everything else zeroed, for the games that offer no trial. */
  enabled: boolean
  chunkPriceUnits: number | null
  chunkPriceUsd: number | null
  chunkMinutes: number
  maxChunks: number | null
  /**
   * `chunkPrice × maxChunks`, and always at or below the game's price — the
   * server refuses a config where it isn't. Worth showing before the first
   * chunk: the whole anxiety a meter creates is not knowing where it stops.
   */
  worstCaseUnits: number
  worstCaseUsd: number
  /** Yours alone. Signed out, or on a game that doesn't know you, all zero. */
  chunksConsumed: number
  chunksLeft: number
  spentUnits: number
  spentUsd: number
  /** What comes off the price. `spent` minus anything already redeemed. */
  creditUnits: number
  creditUsd: number
  asset: string
  assetDecimals: number
}

/** Public. The config is anyone's to read; the numbers about you are not. */
export function getTrial(
  gameId: string,
  signal?: AbortSignal,
): Promise<WireTrial> {
  return request<WireTrial>(`/api/games/${gameId}/trial`, { signal })
}

interface PreparedChunk {
  intentId: string
  hashes: string[]
  expiresAt: string
  amountUnits: string
  asset: string
}

type PrepareChunkResponse =
  | ({ status: 'prepared' } & PreparedChunk)
  | ({ status: 'granted' } & Record<string, unknown>)

export interface ChunkBought {
  chunkMinutes: number
  /** Look it up on the Mirror Node. A chunk is a real payment, like any other. */
  settlementTxId: string
}

export function prepareChunk(gameId: string): Promise<PrepareChunkResponse> {
  return request<PrepareChunkResponse>(
    `/api/games/${gameId}/trial/chunks/prepare`,
    { method: 'POST' },
  )
}

export function completeChunk(
  gameId: string,
  intentId: string,
  signatures: { hash: string; signature: string }[],
): Promise<ChunkBought> {
  return request<ChunkBought>(`/api/games/${gameId}/trial/chunks/complete`, {
    method: 'POST',
    body: { intentId, signatures },
  })
}

/**
 * Buy one chunk: prepare, sign in the browser, settle.
 *
 * Deliberately the same shape as `buyGame`, minus the retry. A purchase retries
 * once on an expired intent because nothing was charged and the buyer is stuck
 * mid-flow; here the caller is mid-play with a timer running, and quietly
 * charging again in the background is the wrong default for money.
 *
 * `409 TRIAL_CHUNKS_EXHAUSTED` means the cap was already reached. Read
 * `chunksLeft` before offering the button rather than relying on the refusal.
 */
export async function buyChunk(
  gameId: string,
  signHashes: (
    hashes: string[],
  ) => Promise<{ hash: string; signature: string }[]>,
): Promise<ChunkBought> {
  const prepared = await prepareChunk(gameId)
  if (prepared.status === 'granted') {
    // Not a path the server takes today: a chunk is always priced above zero.
    return { chunkMinutes: 0, settlementTxId: '' }
  }
  const signatures = await signHashes(prepared.hashes)
  return completeChunk(gameId, prepared.intentId, signatures)
}
