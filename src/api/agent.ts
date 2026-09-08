import { request } from '@/lib/api'

/**
 * The one agent a person may have.
 *
 * **One agent, not one per game.** It has a wallet, a budget, and several
 * *wants* — a wishlist row upgraded with a maximum price. That shape is the
 * whole design: the buyer delegates the *budget*, never the taste. Which games
 * they want is theirs to say; what to do when three of them go on sale at once
 * and the money covers two is the agent's problem.
 *
 * So there is nothing here for setting a want. That lives on the wishlist row
 * it upgrades — see `setWant` in `api/wishlist.ts`.
 *
 * `POST /api/agents` and `GET /api/agents/:id` are gone and answer 404. This
 * module is the replacement, mounted at `/api/me/agent` beside `/api/me/library`
 * and `/api/me/wishlist`, because there is at most one per person.
 */

export type AgentStatus =
  | 'draft'
  | 'funded'
  | 'watching'
  | 'buying'
  | 'cancelled'
  | 'expired'
  | 'failed'

export interface WireAgent {
  id: string
  /**
   * Moves `draft` → `funded` → `watching` on its own once money lands and its
   * identity anchors. Nothing to poll for beyond re-reading this.
   */
  status: AgentStatus
  /** `autonomous` acts and tells you after. `ask_first` asks, when there is time. */
  mode: 'autonomous' | 'ask_first'
  /** What happens to an unanswered question once its deadline passes. */
  onTimeout: 'buy' | 'skip'
  expiresAt: string | null
  /** Where to send money. An ordinary address, funded by an ordinary transfer. */
  fundAddress: string
  /** Null until the first transfer brings the account into existence. */
  agentAccountId: string | null
  hcs14Aid: string | null
  ensLabel: string | null
  ensName: string | null
  ensTxHash: string | null
  /** A string, because it is an integer amount and not ours to round. */
  balanceUnits: string
  balanceUsd: number
  balanceAsset: string
  balanceAssetDecimals: number
  createdAt: string
}

/** 404 when there isn't one, which is the normal state for most people. */
export function getAgent(signal?: AbortSignal): Promise<WireAgent> {
  return request<WireAgent>('/api/me/agent', { signal })
}

export interface NewAgent {
  mode?: 'autonomous' | 'ask_first'
  onTimeout?: 'buy' | 'skip'
  expiresAt?: string
  /** Claims a subname on Sepolia, the same way a studio does. Slow, and optional. */
  ensLabel?: string
}

export function createAgent(body: NewAgent = {}): Promise<WireAgent> {
  return request<WireAgent>('/api/me/agent', { method: 'POST', body })
}

export function updateAgent(body: {
  mode?: 'autonomous' | 'ask_first'
  onTimeout?: 'buy' | 'skip'
  /** Explicit null clears an expiry. Omit to leave it alone. */
  expiresAt?: string | null
}): Promise<WireAgent> {
  return request<WireAgent>('/api/me/agent', { method: 'PATCH', body })
}

export interface RetiredAgent extends WireAgent {
  refundTxId: string | null
  refundedUnits: string
  refundedUsd: number
}

/**
 * Ends it and sends back whatever is left, in one step.
 *
 * No browser signature, unlike every other movement of money in this app: the
 * agent's wallet is one the server made and can sign for, which is exactly why
 * the agent can buy while nobody is watching.
 */
export function retireAgent(): Promise<RetiredAgent> {
  return request<RetiredAgent>('/api/me/agent', { method: 'DELETE' })
}

/**
 * What the agent did, and why.
 *
 * `reasoning` is null for an obvious buy and real text for a contested one:
 * the model is only ever asked when more is eligible than the balance covers.
 * `inferenceCostUnits` is reported apart from the games because it is the one
 * thing spent on thinking rather than on buying.
 */
export interface WireDecision {
  id: string
  agentId: string
  kind: 'bought' | 'held' | 'declined' | 'asked'
  consideredGameIds: string[]
  chosenGameIds: string[]
  reasoning: string | null
  inferenceCostUnits: number | null
  /** When a hold or a question stops waiting. Null on a settled row. */
  decideBy: string | null
  /** Null while a `held` or `asked` row is still live. */
  resolvedAt: string | null
  createdAt: string
}

export function getDecisions(
  signal?: AbortSignal,
): Promise<{ decisions: WireDecision[] }> {
  return request<{ decisions: WireDecision[] }>('/api/me/agent/decisions', {
    signal,
  })
}

/**
 * Answer an ask-first question.
 *
 * `buy` executes the recommendation, re-checked against the current price and
 * balance, so it can still turn out to be unaffordable or already owned.
 * `skip` and `keep` both decline this round; only `remove` also clears the
 * want. Four names for three outcomes, because that is the choice a person is
 * actually being offered.
 *
 * `409 ALREADY_RESOLVED` is a real state, not a failure: the deadline fired, or
 * a fresh price event superseded the question. Show what happened instead.
 */
export function respondToDecision(
  decisionId: string,
  action: 'buy' | 'skip' | 'remove' | 'keep',
): Promise<{ outcome: string }> {
  return request<{ outcome: string }>(
    `/api/me/agent/decisions/${decisionId}/respond`,
    { method: 'POST', body: { action } },
  )
}
