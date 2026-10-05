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
export type GatePhase = 'signin' | 'funding' | 'deposit' | 'ready'

/**
 * Compared in integer units, never in dollars. A wallet holding exactly the
 * price is where a float comparison decides wrong, and getting it wrong means
 * asking someone to top up a wallet that can already pay.
 *
 * `deposit` is the trial's third rung and is skipped entirely for a purchase,
 * which settles straight from the wallet. It comes **after** funding on purpose:
 * depositing moves money out of the wallet, so asking for it first would walk
 * someone into a deposit they cannot afford and then ask them to fund anyway.
 */
/**
 * Two overloads, so a caller that cannot reach the deposit rung is told so by
 * the type rather than having to assert it. Checkout passes no deposit and gets
 * back a phase that provably isn't `deposit`, which is what lets its own `Phase`
 * union stay three words long.
 */
export function gatePhaseFor(
  session: SessionState,
  needUnits: number,
): Exclude<GatePhase, 'deposit'>
export function gatePhaseFor(
  session: SessionState,
  needUnits: number,
  deposit: { needsDeposit: boolean } | null | undefined,
): GatePhase
export function gatePhaseFor(
  session: SessionState,
  needUnits: number,
  /** Only a trial passes this. `needsDeposit` false, or null, skips the rung. */
  deposit?: { needsDeposit: boolean } | null,
): GatePhase {
  if (!session.signedIn) return 'signin'
  if (session.balanceUnits < needUnits) return 'funding'
  if (deposit?.needsDeposit) return 'deposit'
  return 'ready'
}

/** Top-up options, so nobody has to type an amount. */
export function suggestedTopUp(shortfall: number) {
  return Math.max(5, Math.ceil(shortfall / 5) * 5)
}
