import { useSyncExternalStore } from 'react'
import { games } from './games'
import { notify } from './notifications'
import { grantKey } from '@/auth/session'

/**
 * Mock wishlist agent.
 *
 * Two things here are the actual pitch, not implementation detail, so the UI
 * has to keep saying them:
 *
 * 1. **The cap is the wallet balance.** Not a policy field, not a setting.
 *    Nobody can overspend what isn't in the wallet, which is why the agent
 *    gets its own wallet and never the buyer's.
 * 2. **It reads the public listings feed**, not an internal flag. That is the
 *    difference between an app with a bot in it and a public action anyone
 *    could independently build on.
 *
 * TODO(integration): POST /api/agents returns a fundable address; the real
 * watcher reads the HCS listings topic through the Mirror Node.
 */

export interface AgentEvent {
  id: string
  at: string
  kind: 'created' | 'funded' | 'checked' | 'fired' | 'stopped'
  text: string
  amountUsd?: number
}

export interface Agent {
  id: string
  gameId: string
  triggerUsd: number
  balanceUsd: number
  status: 'watching' | 'fired' | 'stopped'
  walletAddress: string
  createdAt: string
  events: AgentEvent[]
}

/** Agents are per game: you can watch several listings at once. */
interface AgentState {
  byGame: Record<string, Agent>
}

let state: AgentState = { byGame: {} }
const listeners = new Set<() => void>()
let sequence = 0

function set(next: AgentState) {
  state = next
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

/** Every agent you've set, newest first. */
export function useAgents(): Agent[] {
  const byGame = useSyncExternalStore(subscribe, getSnapshot, getSnapshot).byGame
  return Object.values(byGame).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
}

export function useAgentFor(gameId: string): Agent | null {
  return (
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot).byGame[gameId] ??
    null
  )
}

function event(
  kind: AgentEvent['kind'],
  text: string,
  amountUsd?: number,
): AgentEvent {
  sequence += 1
  return {
    id: `ev_${sequence}`,
    at: new Date().toISOString(),
    kind,
    text,
    amountUsd,
  }
}

export function createAgent(input: {
  gameId: string
  triggerUsd: number
  fundUsd: number
}): Agent {
  const agent: Agent = {
    id: `ag_${Date.now().toString(36)}`,
    gameId: input.gameId,
    triggerUsd: input.triggerUsd,
    balanceUsd: input.fundUsd,
    status: 'watching',
    // TODO(integration): this address comes back from POST /api/agents.
    walletAddress: '0xA9E7c4213B6F0daD9017Cc1a8bE2fD3105c7b0F4',
    createdAt: new Date().toISOString(),
    events: [
      event('created', 'Agent created with its own wallet and identity'),
      event('funded', 'Wallet funded', input.fundUsd),
      event('checked', 'Reading the public listings feed'),
    ],
  }
  set({ byGame: { ...state.byGame, [agent.gameId]: agent } })
  return agent
}

function update(gameId: string, patch: (agent: Agent) => Agent) {
  const agent = state.byGame[gameId]
  if (!agent) return
  set({ byGame: { ...state.byGame, [gameId]: patch(agent) } })
}

export function fundAgent(gameId: string, amountUsd: number) {
  update(gameId, (agent) => ({
    ...agent,
    balanceUsd: Math.round((agent.balanceUsd + amountUsd) * 100) / 100,
    events: [event('funded', 'Wallet topped up', amountUsd), ...agent.events],
  }))
}

export function stopAgent(gameId: string) {
  update(gameId, (agent) => ({
    ...agent,
    status: 'stopped',
    events: [event('stopped', 'Stopped by you'), ...agent.events],
  }))
}

export function clearAgent(gameId: string) {
  const next = { ...state.byGame }
  delete next[gameId]
  set({ byGame: next })
}

/**
 * Demo control: drops a game's price and lets the agent react, exactly as the
 * real watcher would when the listing feed changes.
 * TODO(integration): delete this. The real trigger is a price change published
 * to the HCS topic, seen by the watcher through the Mirror Node.
 */
export function simulatePriceDrop(
  gameId: string,
  newPrice: number,
): 'fired' | 'no-match' | 'broke' {
  const agent = state.byGame[gameId]
  const game = games.find((candidate) => candidate.id === gameId)
  if (!game) return 'no-match'

  game.priceUsd = newPrice
  if (!agent || agent.status !== 'watching') return 'no-match'

  if (newPrice > agent.triggerUsd) {
    update(gameId, (current) => ({
      ...current,
      events: [
        event('checked', `Saw ${game.title} at $${newPrice.toFixed(2)}, holding`),
        ...current.events,
      ],
    }))
    return 'no-match'
  }

  // The cap is the balance. Nothing else stops an overspend.
  if (newPrice > agent.balanceUsd) {
    update(gameId, (current) => ({
      ...current,
      events: [
        event(
          'checked',
          `Trigger hit at $${newPrice.toFixed(2)} but the wallet holds $${current.balanceUsd.toFixed(2)}`,
        ),
        ...current.events,
      ],
    }))
    return 'broke'
  }

  grantKey(game.id) // the agent paid, not the buyer's own wallet
  notify({
    kind: 'agent',
    title: `Your agent bought ${game.title}`,
    detail: `It hit $${newPrice.toFixed(2)}, under your $${agent.triggerUsd.toFixed(2)} trigger. The key is in your wallet.`,
    amountUsd: newPrice,
    to: `/game/${game.slug}`,
  })
  update(gameId, (current) => ({
    ...current,
    status: 'fired',
    balanceUsd: Math.round((current.balanceUsd - newPrice) * 100) / 100,
    events: [
      event('fired', `Bought ${game.title}. Key is in your wallet`, newPrice),
      ...current.events,
    ],
  }))
  return 'fired'
}
