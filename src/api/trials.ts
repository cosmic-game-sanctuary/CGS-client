import { encodeFunctionData, type Address } from 'viem'
import { request } from '@/lib/api'
import type { TransactionRequest, TypedDataRequest } from '@/auth/useWalletSigner'

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
  /**
   * What buying the game costs you right now, credit already deducted.
   *
   * The server's own number, from the same function `/download` prices a
   * purchase with. Never recompute it here as `price - credit`: a second
   * opinion on this side can only ever disagree with the one that moves money.
   */
  owedUnits: number
  owedUsd: number
  asset: string
  assetDecimals: number
  /**
   * The one-time deposit a chunk needs before it can ever settle.
   *
   * Null signed out, on a game with no trial, and when there are no chunks
   * left. All three mean "don't ask for a deposit", so a null here is never a
   * reason to prompt.
   */
  gatewayDeposit: GatewayDeposit | null
}

/**
 * Where a chunk's money actually comes from, and why there is an extra step.
 *
 * A chunk is too small to settle on chain — the gas would cost more than the
 * minute. So chunks go through Circle Gateway, which never settles one
 * individually: the buyer deposits USDC into a Gateway contract once, and every
 * chunk after that is an authorization against *that* balance, credited
 * off-chain and batched into one transaction later.
 *
 * The practical consequence is the thing to keep hold of: **the balance Gateway
 * spends is not the wallet balance.** A buyer with plenty of USDC and no deposit
 * has every chunk refused for insufficient funds, which is why this is a real
 * step in the UI and not an implementation detail. The deposit is shared across
 * every game with a trial, so it is asked for once, not once per game.
 */
export interface GatewayDeposit {
  /** The GatewayWallet contract: what gets approved, and what gets deposited into. */
  walletAddress: string
  usdcAddress: string
  chainId: number
  /** Already deposited and spendable. A string: an integer amount, not ours to round. */
  availableUnits: string
  availableUsd: number
  /** True when what's deposited won't cover one more chunk. */
  needsDeposit: boolean
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
  /** The EIP-3009 authorization to sign. Pass it to the wallet whole. */
  typedData: TypedDataRequest
  expiresAt: string
  amountUnits: string
  asset: string
  payTo: string
}

type PrepareChunkResponse =
  | ({ status: 'prepared' } & PreparedChunk)
  | ({ status: 'granted' } & Record<string, unknown>)

export interface ChunkBought {
  chunkMinutes: number
  /**
   * A Gateway transfer id, **not** a transaction hash. Don't link it to an
   * explorer: when this call answers, the chunk is yours and the money has not
   * moved on chain yet. Circle's batch does that later, on its own schedule.
   */
  gatewayTransferId: string
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
  signature: string,
): Promise<ChunkBought> {
  return request<ChunkBought>(`/api/games/${gameId}/trial/chunks/complete`, {
    method: 'POST',
    body: { intentId, signature },
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
  signTypedData: (request: TypedDataRequest) => Promise<string>,
): Promise<ChunkBought> {
  const prepared = await prepareChunk(gameId)
  if (prepared.status === 'granted') {
    // Not a path the server takes today: a chunk is always priced above zero.
    return { chunkMinutes: 0, gatewayTransferId: '' }
  }
  const signature = await signTypedData(prepared.typedData)
  return completeChunk(gameId, prepared.intentId, signature)
}

/**
 * How much to put into Gateway when asked.
 *
 * Deliberately **not** one chunk's worth. The deposit costs gas and two
 * signatures, so sizing it to a single minute would make the buyer do all of
 * this again a minute later. It is also not a charge: the money stays theirs,
 * it is spendable on any game's trial rather than this one, and what goes
 * unplayed can be taken back out.
 *
 * So the target is `worstCase`, the most this trial can ever cost, which the
 * server caps at the game's own price. Depositing that much means the meter can
 * never run dry mid-game, which is the failure worth designing out: it would
 * interrupt someone *while playing*, which is the one moment this whole feature
 * exists to keep smooth.
 *
 * Two adjustments, both to avoid asking for money that isn't there:
 *
 * - **Minus what's already deposited.** One Gateway balance covers every game,
 *   so someone who tried something else last week may need only the difference,
 *   or nothing.
 * - **Capped at the wallet.** The funding rung above only guarantees one
 *   chunk's price, so a wallet can legitimately hold less than the worst case.
 *   Asking for more than it has would strand the buyer on a rung they cannot
 *   clear. They deposit what they have, and the meter runs as far as it goes.
 */
export function depositAmountFor(
  trial: WireTrial,
  balanceUnits: number,
): bigint {
  const already = BigInt(trial.gatewayDeposit?.availableUnits ?? '0')
  const target = BigInt(trial.worstCaseUnits) - already
  const affordable = BigInt(Math.max(0, Math.floor(balanceUnits)))
  return target < affordable ? target : affordable
}

/**
 * Put USDC into Gateway so chunks can be paid from it.
 *
 * Two ordinary transactions from the buyer's own wallet, paying their own gas.
 * **This is not an x402 payment** — nothing is prepared, quoted or settled by
 * us, and the server is not involved at any point. It is the one write in this
 * whole app that talks to a contract directly.
 *
 * They have to be sequential: the deposit moves USDC via `transferFrom`, which
 * reverts until the approval it depends on has actually landed. So this waits
 * for the first receipt before sending the second, rather than firing both and
 * hoping for ordering.
 */
export async function depositToGateway(
  deposit: GatewayDeposit,
  wallet: {
    sendTransaction: (request: TransactionRequest) => Promise<string>
    waitForReceipt: (hash: string) => Promise<void>
  },
  units: bigint,
  onStage?: (stage: 'approving' | 'depositing') => void,
): Promise<void> {
  if (units <= 0n) return
  onStage?.('approving')
  const approval = await wallet.sendTransaction({
    to: deposit.usdcAddress,
    chainId: deposit.chainId,
    data: encodeFunctionData({
      abi: GATEWAY_ABI,
      functionName: 'approve',
      args: [deposit.walletAddress as Address, units],
    }),
  })
  await wallet.waitForReceipt(approval)

  onStage?.('depositing')
  const deposited = await wallet.sendTransaction({
    to: deposit.walletAddress,
    chainId: deposit.chainId,
    data: encodeFunctionData({
      abi: GATEWAY_ABI,
      functionName: 'deposit',
      args: [deposit.usdcAddress as Address, units],
    }),
  })
  await wallet.waitForReceipt(deposited)
}

/**
 * Wait for Gateway to notice a deposit that has already been mined.
 *
 * Two different systems, so the transaction landing and Gateway crediting it are
 * two events a few seconds apart. Treating the receipt as the finish line is
 * what would make the very first chunk fail for insufficient funds moments after
 * the person watched their deposit succeed.
 */
export async function waitForDeposit(
  gameId: string,
  attempts = 10,
  everyMs = 1500,
): Promise<WireTrial | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, everyMs))
    try {
      const fresh = await getTrial(gameId)
      if (fresh.gatewayDeposit && !fresh.gatewayDeposit.needsDeposit) return fresh
    } catch {
      // A failed poll says nothing about the deposit. Keep waiting.
    }
  }
  return null
}

/**
 * Just the two functions used above, encoded rather than hand-rolled.
 *
 * Both are `(address, uint256)`, so a hand-written selector would be four bytes
 * of magic number that nothing in the file could check. Letting viem derive it
 * from the signature means the signature is the thing under review.
 */
const GATEWAY_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const
