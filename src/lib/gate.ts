import type { SessionState } from '@/auth/session'

/**
 * The two steps before any money can move: having an account, and having
 * something in it.
 *
 * A plain module rather than living beside the panels that render it, because
 * a file exporting both a component and a function breaks fast refresh. Same
 * rule that split `session.ts` from `SessionProvider.tsx` and `countdown.ts`
 * from the banner that uses it.
 */
export type GatePhase = 'signin' | 'funding' | 'ready'

/**
 * Compared in integer units, never in dollars. A wallet holding exactly the
 * price is where a float comparison decides wrong, and getting it wrong means
 * asking someone to top up a wallet that can already pay.
 */
export function gatePhaseFor(
  session: SessionState,
  needUnits: number,
): GatePhase {
  if (!session.signedIn) return 'signin'
  if (session.balanceUnits < needUnits) return 'funding'
  return 'ready'
}

/** Top-up options, so nobody has to type an amount. */
export function suggestedTopUp(shortfall: number) {
  return Math.max(5, Math.ceil(shortfall / 5) * 5)
}
