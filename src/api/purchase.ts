import { ApiError, request, requestBytes } from '@/lib/api'
import { mountBuild, type MountStage } from '@/lib/buildPreview'
import type { TypedDataRequest } from '@/auth/useWalletSigner'

/**
 * Buying a game, and getting at the build afterwards.
 *
 * The one flow in this app that isn't ordinary REST. `GET /download` is x402
 * gated: it answers 402 with payment terms instead of the file, and you retry
 * having paid. The server does that retry for us.
 *
 * What this side does is the one step the server cannot: signing with the
 * buyer's own wallet. See `auth/useWalletSigner.ts` for why that split exists.
 *
 * **The buyer pays no network fee.** Circle's facilitator submits the transfer
 * and covers the gas, so a wallet holding exactly the price of a game can buy
 * that game.
 */

/** What you get once you're entitled to the build. */
export interface AccessGrant {
  /** Where to fetch the build zip from. Relative to the API. */
  buildPath: string
  /** What the build is on IPFS. Provenance, not where it's fetched from. */
  buildCid: string
  tokenId: string | null
  serial?: number
  /**
   * free    — the game costs nothing. A key still mints.
   * owned   — you already hold the key.
   * pending — you just paid. The key mints in the next few seconds.
   */
  keyStatus: 'free' | 'owned' | 'pending'
  settlementTxId?: string
}

/** A built, unsigned payment waiting on the wallet. */
export interface PreparedPayment {
  intentId: string
  /**
   * The EIP-3009 authorization to sign, as EIP-712 typed data. Pass it to the
   * wallet whole — see `auth/useWalletSigner.ts`.
   */
  typedData: TypedDataRequest
  expiresAt: string
  amountUnits: string
  asset: string
  /** Where the money goes: the game's own SplitVault. */
  payTo: string
}

type PrepareResponse =
  | ({ status: 'granted' } & AccessGrant)
  | ({ status: 'prepared' } & PreparedPayment)

/**
 * Where the build is, if you're allowed to have it.
 *
 * Null means "not without paying", which is a real answer rather than a
 * failure: the 402 body is x402's payment terms, not our error shape, so it is
 * translated here instead of being surfaced as a broken request.
 */
export async function getDownload(
  gameId: string,
  signal?: AbortSignal,
): Promise<AccessGrant | null> {
  try {
    return await request<AccessGrant>(`/api/games/${gameId}/download`, { signal })
  } catch (error) {
    if (error instanceof ApiError && error.status === 402) return null
    throw error
  }
}

export function preparePayment(gameId: string): Promise<PrepareResponse> {
  return request<PrepareResponse>(`/api/games/${gameId}/pay/prepare`, {
    method: 'POST',
  })
}

export function completePayment(
  gameId: string,
  intentId: string,
  signature: string,
): Promise<AccessGrant> {
  return request<AccessGrant>(`/api/games/${gameId}/pay/complete`, {
    method: 'POST',
    body: { intentId, signature },
  })
}

/**
 * Pay for a game and come back with somewhere to play it.
 *
 * Three steps, and the middle one is the only reason this isn't a single call:
 * prepare quotes the price, the wallet signs the authorization, complete
 * settles it.
 *
 * **There are two retries here and they are opposites.** Getting them the wrong
 * way round is how a buyer gets charged twice.
 *
 * `PAYMENT_INTENT_EXPIRED` means the authorization aged out and **nothing was
 * charged**, so starting over from `prepare` is safe. A buyer who leaves the tab
 * mid-purchase comes back to this. (Arc gives an authorization half an hour
 * rather than the two minutes a frozen Hedera transaction had, so it is now
 * rare rather than routine.)
 *
 * `PAYMENT_PENDING` means settlement did not resolve inside the wait window and
 * **the money may already be moving**. So the fix is the narrowest possible one:
 * complete the *same* intent again, with the *same* signature. That resubmits
 * one identical authorization under one identical idempotency key, and the
 * token's own nonce makes a second transfer impossible. Calling `prepare` again
 * here would mint a fresh authorization, which is a genuinely new payment and
 * the one way to take the money twice. Hence the inner loop, which never
 * re-prepares and never re-signs.
 *
 * Every other failure goes straight up: a payment that failed for a reason we
 * don't recognise might still have been one that went through.
 */
export async function buyGame(
  gameId: string,
  signTypedData: (request: TypedDataRequest) => Promise<string>,
): Promise<AccessGrant> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const prepared = await preparePayment(gameId)
    if (prepared.status === 'granted') return prepared

    const signature = await signTypedData(prepared.typedData)
    try {
      return await settleWithRetry(gameId, prepared.intentId, signature)
    } catch (error) {
      const expired =
        error instanceof ApiError && error.code === 'PAYMENT_INTENT_EXPIRED'
      if (!expired || attempt === 1) throw error
    }
  }
  // Unreachable: the loop either returns or throws on its second pass.
  throw new ApiError(409, 'PAYMENT_INTENT_EXPIRED', 'That payment timed out.')
}

/** How many times a pending settlement is re-completed before we give up. */
const PENDING_ATTEMPTS = 5
/** Between tries. The authorization is good for 30 minutes, so there's no rush. */
const PENDING_BACKOFF_MS = 2000

/**
 * Complete one prepared payment, waiting out a settlement that hasn't resolved.
 *
 * Resubmits the identical intent and signature, which is what makes this safe
 * to do at all. If it is still pending after a handful of tries the error is
 * thrown as-is, because at that point the honest answer is "we don't know yet"
 * and the buyer should be told that rather than shown a spinner forever.
 */
async function settleWithRetry(
  gameId: string,
  intentId: string,
  signature: string,
): Promise<AccessGrant> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await completePayment(gameId, intentId, signature)
    } catch (error) {
      const pending = error instanceof ApiError && error.code === 'PAYMENT_PENDING'
      if (!pending || attempt >= PENDING_ATTEMPTS - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, PENDING_BACKOFF_MS))
    }
  }
}

/**
 * Fetch a build and mount it somewhere it can run.
 *
 * The same pipeline a dropped zip goes through on the publish screen: unpack in
 * the browser, write the files onto the build origin, hand back a URL over
 * there. That origin is the whole point — an uploaded game needs
 * `allow-same-origin` to boot at all, and giving it an origin of its own is the
 * only way to have that and still be safe. See `lib/buildPreview.ts`.
 *
 * A build is cached on that origin once mounted, so this is the cost of the
 * first play rather than of every play.
 */
export async function mountGrant(
  grant: AccessGrant,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  return mountBuildFromPath(grant.buildPath, onProgress)
}

/**
 * The same thing, for a caller that has no grant to show for itself.
 *
 * A trial is the case: buying a chunk hands back a settlement id and no access
 * grant, because a chunk buys time rather than ownership. The build route
 * decides whether to serve it, from the payment record, so the path is all a
 * caller ever needs to know.
 */
export async function mountBuildFromPath(
  buildPath: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const zip = await requestBytes(buildPath, {
    // Downloading is most of the wait, so it gets most of the bar.
    onProgress: onProgress && ((loaded, total) => onProgress((loaded / total) * 0.75)),
  })

  /**
   * The unpack is **not** instant, and pretending it was is what made a
   * working mount indistinguishable from a broken one.
   *
   * A real build is ~23MB compressed and several hundred megabytes of files
   * once inflated, every one of which is written into the Cache API on the
   * other origin. That is tens of seconds of genuine work on a slow machine.
   * With nothing reported for any of it, the bar parked at the end of the
   * download and stayed there, which reads as a hang. It looked exactly like
   * the real hang it sat next to (see previewHost's COMMAND_TIMEOUT_MS), so
   * the two were impossible to tell apart from the outside.
   */
  const mounted = await mountBuild(zip, (stage) => onProgress?.(MOUNT_PROGRESS[stage]))
  onProgress?.(1)
  return mounted.entry
}

/** Where each stage of the unpack sits on the bar, after the download's 0.75. */
const MOUNT_PROGRESS: Record<MountStage, number> = {
  worker: 0.78,
  reading: 0.82,
  unzipping: 0.86,
  writing: 0.92,
  starting: 0.98,
}

/** Where a game's build lives. The route decides who may have it. */
export function buildPathFor(gameId: string): string {
  return `/api/games/${gameId}/build.zip`
}

/** Chain truth, for the moment the GameKey actually lands. */
export function isOwned(
  gameId: string,
  signal?: AbortSignal,
): Promise<{ owned: boolean; serial?: number }> {
  return request(`/api/games/${gameId}/owned`, { signal })
}

/**
 * Wait for the GameKey to land, then stop.
 *
 * Only cosmetic: the buyer is already playing by the time this runs, on the
 * strength of a settled payment. It exists so the listing's owned state and the
 * library stop depending on the optimistic local flag.
 */
export async function waitForKey(
  gameId: string,
  onOwned: () => void,
  signal?: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline && !signal?.aborted) {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    if (signal?.aborted) return
    try {
      const { owned } = await isOwned(gameId, signal)
      if (owned) {
        onOwned()
        return
      }
    } catch {
      // A mint takes a handful of chain round trips and this is a background
      // read of it. A failed poll is not worth telling anyone about.
      return
    }
  }
}

/**
 * Play sessions: what makes the play count on a listing a real number.
 *
 * Started where the frame actually mounts, ended when it goes away. Both are
 * fire and forget. A dropped session start costs one number on a listing; it
 * should never be able to stop someone playing a game they own.
 */
export async function startSession(gameId: string): Promise<string | null> {
  try {
    const { sessionId } = await request<{ sessionId: string }>(
      `/api/games/${gameId}/sessions`,
      { method: 'POST' },
    )
    return sessionId
  } catch {
    return null
  }
}

export async function endSession(gameId: string, sessionId: string): Promise<void> {
  try {
    await request(`/api/games/${gameId}/sessions/${sessionId}`, { method: 'PATCH' })
  } catch {
    // Same reasoning as above, and this one usually fires as the page is
    // already going away.
  }
}
