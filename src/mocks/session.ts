import { useSyncExternalStore } from 'react'
import { games } from './games'
import { seedIncomingInvite } from './invites'
import { clearInbox, notify, seedStudioActivity } from './notifications'

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

  // TODO(demo): a real account's inbox arrives from the server. This one
  // starts with the invite, because being invited is how most people get a
  // studio and there's no other way to receive one in a mock.
  const invite = seedIncomingInvite(email)
  if (invite) {
    notify({
      kind: 'invite',
      title: `${invite.fromHandle} added you to ${invite.studioName}`,
      detail: invite.game
        ? `${invite.game.pct}% of ${invite.game.title}, for ${invite.game.role}.`
        : 'They want you on the team.',
      to: `/invite/${invite.id}`,
    })
  }
}

export function signOut() {
  clearInbox()
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

  // TODO(demo): a studio that already ships has sales behind it, and seeing
  // them is the point of the inbox. A studio you just created gets nothing,
  // which is correct.
  const backCatalogue = games.filter((game) => game.studio.id === studioId)
  seedStudioActivity(
    backCatalogue.map((game) => ({ title: game.title, slug: game.slug })),
    (index) => [1.35, 0.9, 2.25][index] ?? 1,
  )
}

export function ownsGame(gameId: string) {
  return state.ownedGameIds.includes(gameId)
}
