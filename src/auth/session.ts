import { createContext, use } from 'react'
import { faucet } from '@/api/me'

/**
 * Who you are, and what your wallet holds.
 *
 * This replaces the mock store that stood in for Privy. The shape is
 * deliberately the same, because the mock was written to Privy's shape in the
 * first place: an email identity plus an embedded wallet with a balance.
 *
 * Two sources, answering different questions. **Privy** owns whether you are
 * signed in and which wallet is yours; it restores itself on reload, so there
 * is no session to persist here. **`GET /api/me`** owns everything that
 * depends on the chain or the database: the Hedera account, the balance, the
 * studio you publish as. Anything derived from money asks the server, because
 * a balance we cached is a balance that is already wrong.
 *
 * The provider lives in `SessionProvider.tsx`; this file is the context, the
 * hook, and the handful of actions callers trigger imperatively.
 */

export interface SessionState {
  /** False until Privy has finished restoring any existing session. */
  ready: boolean
  signedIn: boolean
  email: string | null
  /** The embedded wallet Privy made for you. */
  address: string | null
  /** Null until that wallet has received value. See the funding step. */
  hederaAccountId: string | null
  /** Display only. `balanceUnits` is the integer everything else uses. */
  balanceUsd: number
  balanceUnits: number
  /** Games this wallet holds a key for. */
  ownedGameIds: string[]
  studioId: string | null
  studioName: string | null
  /** Your handle inside that studio: what appears on splits and credits. */
  handle: string | null
  /**
   * Why `/api/me` could not be read, when it could not.
   *
   * Worth surfacing rather than swallowing: a failed read leaves every field
   * above at its empty value, and an empty wallet and an unreadable one look
   * identical on screen while meaning completely different things.
   */
  error: string | null
}

export const EMPTY_SESSION: SessionState = {
  ready: false,
  signedIn: false,
  email: null,
  address: null,
  hederaAccountId: null,
  balanceUsd: 0,
  balanceUnits: 0,
  ownedGameIds: [],
  studioId: null,
  studioName: null,
  handle: null,
  error: null,
}

export const SessionContext = createContext<SessionState>(EMPTY_SESSION)

export function useSession(): SessionState {
  return use(SessionContext)
}

/**
 * Imperative handles for actions triggered from outside a component that could
 * hold the hook. Same pattern as `setTokenSource` in `lib/api.ts`: React owns
 * the state, and a module-level caller reaches it through a registered
 * function rather than keeping a second copy of the truth.
 */
export const sessionBridge: {
  login?: () => void
  logout?: () => Promise<void>
  refresh?: () => void
  grantKey?: (gameId: string) => void
} = {}

/**
 * Opens Privy's login modal. Privy owns the whole flow, including which
 * methods are offered, so there is nothing to pass in.
 * TODO(W5): `useLoginWithEmail` would let checkout keep its own email field
 * and skip the modal, which is worth doing on the critical path.
 */
export function signIn() {
  sessionBridge.login?.()
}

export function signOut() {
  void sessionBridge.logout?.()
}

/** Re-read `/api/me`. Call after anything that moves money or makes a studio. */
export function refreshSession() {
  sessionBridge.refresh?.()
}

/**
 * Mark a game as owned before the server can confirm it. Payment settles
 * before the GameKey mints, and the buyer is entitled to play in that gap.
 */
export function grantKey(gameId: string) {
  sessionBridge.grantKey?.(gameId)
  sessionBridge.refresh?.()
}

/**
 * Put a test balance in this wallet.
 *
 * Real money moved by the server, not a number bumped locally: a Privy wallet
 * has no Hedera account until it first receives value, so this is also what
 * brings the account into existence. Development only, and the route is not
 * even mounted unless the server was started with DEV_FAUCET=on.
 * TODO(integration): Privy's own funding UI replaces this before any deploy.
 */
export async function fund(amountUsd?: number): Promise<void> {
  await faucet(amountUsd === undefined ? {} : { amount: amountUsd })
  sessionBridge.refresh?.()
}

/**
 * You made a studio, or accepted an invite into one. Both are server-side
 * facts now, so there is nothing to set locally, only something to re-read.
 */
export function joinStudio() {
  sessionBridge.refresh?.()
}
