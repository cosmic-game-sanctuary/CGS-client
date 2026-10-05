import { request } from '@/lib/api'

/**
 * What was earned, and what is still owed.
 *
 * Two views of one calculation. The server computes both from the same
 * function, so a studio owner looking at a game and a collaborator looking at
 * the same game cannot be shown different numbers for the same share.
 *
 * **Nothing here is stored.** Every figure is recomputed from sales and splits
 * on each read, which is why there is no cache in this module either: a total
 * we remembered is a total that can disagree with the transfers people actually
 * received.
 */

/** Every money value the earnings API sends arrives in this shape. */
export interface WireMoney {
  /** Integer, smallest units. The truth, and the only thing to compute with. */
  units: number
  /** The same amount for printing. Never do arithmetic on it. */
  display: number
  assetDecimals: number
}

export interface WireEarningsGame {
  gameId: string
  slug: string
  title: string
  status: 'draft' | 'published' | 'delisted' | 'removed'
  priceUnits: number
  studio: { id: string; name: string; slug: string }
  sales: number
  /** What buyers paid, before it was divided. */
  gross: WireMoney
  /** Your cut of that gross. Personal report only. */
  yours?: { pct: number; role: string; earned: WireMoney }
  plays: number
  likes: number
  reviews: number
  rating: number
}

/**
 * Your share of one game's sales, as that game's vault holds it.
 *
 * Replaces the held/failed rows the Hedera build needed. There used to be three
 * states a share could be in — paid, held because the person had no account yet,
 * or failed — and all three existed because the server moved the money. It does
 * not any more: a sale credits the game's SplitVault directly and the contract
 * divides it, so a share is either still in the vault (`claimable`) or already
 * withdrawn (`claimed`). Nothing can get stuck, and there is no state where
 * someone is owed a transfer that failed.
 *
 * Every figure here is read from the contract, so it is what the chain will
 * actually pay and can be checked on the explorer.
 */
export interface WireGameClaim {
  gameId: string
  gameTitle: string
  gameSlug: string
  /** The contract holding it. Checkable on the explorer. */
  vault: string
  /** Your share of each sale, in basis points. 10000 is the whole sale. */
  bps: number
  /** Everything this game has ever owed you. */
  earned: WireMoney
  /** What you have already taken out. */
  claimed: WireMoney
  /** What is waiting for you right now. */
  claimable: WireMoney
}

export interface WirePersonalEarnings {
  totals: {
    /** Yours. */
    earned: WireMoney
    /** What the games took in altogether, your share included. */
    gross: WireMoney
    sales: number
    games: number
    /** Sitting in vaults with your name on it. Claim it to move it. */
    claimable: WireMoney
    /** Already withdrawn from the vaults. */
    claimed: WireMoney
    asset: string
  }
  games: WireEarningsGame[]
  /** One per game that pays you, newest-claimable first. */
  claims: WireGameClaim[]
}

/**
 * Everything you are credited on, across every team.
 *
 * Cross-studio deliberately. Being added to a split by email is exactly what
 * puts one person on games from several studios, so a per-studio view would
 * hide money from the people the splits feature exists for.
 */
export function getMyEarnings(
  signal?: AbortSignal,
): Promise<WirePersonalEarnings> {
  return request<WirePersonalEarnings>('/api/me/earnings', { signal })
}

export interface WireStudioPerson {
  handle: string
  role: string
  earnedUnits: number
  games: number
  /**
   * Always true now, and kept only so this shape does not change under you.
   * It used to mean "has an address, so their share can be paid"; every payee
   * has an address from the moment they are invited, because one is generated
   * for them then and the game's vault names it permanently at publish.
   */
  claimed: boolean
  earned: WireMoney
}

export interface WireStudioEarnings {
  studio: { id: string; name: string; slug: string }
  totals: {
    gross: WireMoney
    sales: number
    games: number
    published: number
    asset: string
  }
  games: WireEarningsGame[]
  /** Everyone on the studio's splits, whether or not they have an account. */
  people: WireStudioPerson[]
}

/**
 * Owner and accepted members only. Anyone else gets `NOT_OWNER`, so callers
 * should decide from the session whether to ask at all rather than fetching and
 * catching.
 */
export function getStudioEarnings(
  studioId: string,
  signal?: AbortSignal,
): Promise<WireStudioEarnings> {
  return request<WireStudioEarnings>(`/api/studios/${studioId}/earnings`, {
    signal,
  })
}

/** What a claim moved, and the transaction that moved it. */
export interface WireClaimResult {
  gameId: string
  gameTitle: string
  vault: string
  /** Where it went — your own address, and the only place it could have gone. */
  to: string
  amount: WireMoney
  txHash: string
  /**
   * Where to open the release, and the vault it came out of. Both built by the
   * server, which is the only side that knows the chain it is pointed at.
   *
   * Worth linking rather than storing quietly: "the contract paid you, not us"
   * is the claim this whole screen makes, and an unopenable hash is an assertion
   * in exactly the place the product promises evidence.
   */
  explorerUrl: string | null
  vaultUrl: string | null
}

/**
 * Take your share of one game's sales out of its vault.
 *
 * The platform pays the gas for this, which is necessity rather than generosity:
 * gas on Arc is USDC, so a developer whose first earnings are still in the vault
 * cannot afford the transaction that would release them. `SplitVault.claimFor`
 * sends only to the payee, so paying for it buys nobody any say over the money —
 * and it is callable by anyone, so a developer who would rather not involve us
 * can call `claim()` from their own wallet instead.
 *
 * Answers `409 NOTHING_TO_CLAIM` when there is nothing waiting, which is an
 * ordinary outcome rather than an error worth alarming anyone about.
 */
export function claimEarnings(gameId: string): Promise<WireClaimResult> {
  return request<WireClaimResult>(`/api/me/claim/${gameId}`, { method: 'POST' })
}
