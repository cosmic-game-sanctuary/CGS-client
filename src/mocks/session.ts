import { useSyncExternalStore } from 'react'

/**
 * Mock session and wallet.
 *
 * Stands in for Privy until the integration phase (CLAUDE.md §3). The shape is
 * deliberately close to what Privy gives us — an email identity plus an
 * embedded wallet with a balance — so swapping it out is a change of
 * implementation, not of every call site.
 *
 * Balance starts at zero so the fund-then-buy path is the default first run.
 */

export interface SessionState {
  signedIn: boolean
  email: string | null
  /** USDC in the embedded wallet. */
  balanceUsd: number
  /** Games this wallet holds a GameKey for. */
  ownedGameIds: string[]
  /**
   * The studio you publish as, or null if you haven't made one.
   * TODO(integration): POST /api/studios, then membership from the API.
   */
  studioId: string | null
  /** Your handle inside that studio — what appears on splits and credits. */
  handle: string | null
}

let state: SessionState = {
  signedIn: false,
  email: null,
  balanceUsd: 0,
  ownedGameIds: [],
  // No studio until you make one, the same as a real new account. Browsing
  // and buying never depend on this.
  studioId: null,
  handle: null,
}

const listeners = new Set<() => void>()

function set(next: Partial<SessionState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function signIn(email: string) {
  set({ signedIn: true, email })
}

export function signOut() {
  // The wallet, its keys and the studio all hang off the account, so they go
  // together. Leaving owned games behind after a sign out would be a lie.
  set({
    signedIn: false,
    email: null,
    balanceUsd: 0,
    ownedGameIds: [],
    studioId: null,
    handle: null,
  })
}

export function fund(amountUsd: number) {
  set({ balanceUsd: Math.round((state.balanceUsd + amountUsd) * 100) / 100 })
}

/** Settles the purchase: debits the wallet and drops the key in. */
export function grantKey(gameId: string, priceUsd: number) {
  if (state.ownedGameIds.includes(gameId)) return
  set({
    balanceUsd: Math.round((state.balanceUsd - priceUsd) * 100) / 100,
    ownedGameIds: [...state.ownedGameIds, gameId],
  })
}

/** You made a studio, or accepted an invite into one. */
export function joinStudio(studioId: string, handle: string) {
  set({ studioId, handle })
}

export function ownsGame(gameId: string) {
  return state.ownedGameIds.includes(gameId)
}
