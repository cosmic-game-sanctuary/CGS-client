import { useSyncExternalStore } from 'react'
import { games, studios } from './games'

/**
 * Studio invites.
 *
 * The splits editor lets a dev add someone who has never used CGS by email
 * (CLAUDE.md §4). This is the other end of that: what the person receives, and
 * the one screen where they decide.
 *
 * The important thing the screen has to make true is that **the share exists
 * whether or not they accept.** The split was locked at publish; accepting
 * claims a wallet for money that is already theirs. It is not an application.
 *
 * TODO(integration): invites come from POST /api/studios/:id/members and are
 * accepted against a Privy embedded wallet the invitee claims on accept.
 */

export interface InviteGame {
  title: string
  slug: string
  role: string
  pct: number
}

export interface Invite {
  id: string
  studioId: string
  studioName: string
  studioEns?: string
  /** Who sent it. */
  fromHandle: string
  /** The address it went to. */
  email: string
  /** The handle they'd take inside the studio. Editable on accept. */
  handle: string
  /** The game whose splits they were added to, when that's where it came from. */
  game?: InviteGame
  createdAt: string
  status: 'pending' | 'accepted' | 'declined'
}

let byId: Record<string, Invite> = {}
const listeners = new Set<() => void>()
let sequence = 0

function set(next: Record<string, Invite>) {
  byId = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return byId
}

export function useInvite(id: string | undefined): Invite | null {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return (id ? all[id] : null) ?? null
}

export function createInvite(input: {
  studioId: string
  fromHandle: string
  email: string
  handle?: string
  game?: InviteGame
}): Invite {
  const studio = Object.values(studios).find(
    (candidate) => candidate.id === input.studioId,
  )
  sequence += 1
  const invite: Invite = {
    id: `iv_${sequence}`,
    studioId: input.studioId,
    studioName: studio?.name ?? 'a studio',
    studioEns: studio?.ens,
    fromHandle: input.fromHandle,
    email: input.email,
    // Default handle is the part of the address before the @, which is what
    // most people would have picked anyway.
    handle: input.handle ?? input.email.split('@')[0],
    game: input.game,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  set({ ...byId, [invite.id]: invite })
  return invite
}

function settle(id: string, status: Invite['status'], handle?: string) {
  const invite = byId[id]
  if (!invite) return null
  const next: Invite = {
    ...invite,
    status,
    handle: handle?.trim() || invite.handle,
  }
  set({ ...byId, [id]: next })
  return next
}

const SETTLE_MS = 750

/** Claims the wallet the share has been accruing to. */
export async function acceptInvite(
  id: string,
  handle: string,
): Promise<Invite | null> {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
  return settle(id, 'accepted', handle)
}

export async function declineInvite(id: string): Promise<Invite | null> {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS / 2))
  return settle(id, 'declined')
}

/**
 * TODO(demo): delete with the mocks. A new account has no way to be invited to
 * anything, so one arrives with you. It is also the only route into an existing
 * studio, which is what makes the teammate roster in the splits editor real.
 *
 * Null when one is already waiting, so signing in from an invite link doesn't
 * hand you a second copy of the thing you're looking at.
 */
export function seedIncomingInvite(email: string): Invite | null {
  const waiting = Object.values(byId).some(
    (invite) => invite.email === email && invite.status === 'pending',
  )
  if (waiting) return null

  const game = games.find((candidate) => candidate.studio.id === 'st_tinroof')
  const split = game?.splits.find((member) => member.handle === 'junart')
  return createInvite({
    studioId: 'st_tinroof',
    fromHandle: 'miracode',
    email,
    game:
      game && split
        ? {
            title: game.title,
            slug: game.slug,
            role: split.role,
            pct: split.pct,
          }
        : undefined,
  })
}
