import { request } from '@/lib/api'

/**
 * Taking money out of the wallet Privy made for you.
 *
 * The same two-step shape as a purchase, for the same reason: building and
 * freezing a Hedera transfer needs a Hedera client, and the key that authorises
 * it belongs to the person sitting here. So the server prepares, the browser
 * signs, the server submits. See `auth/useWalletSigner.ts`.
 *
 * **No HBAR is needed to do this.** The operator pays the network fee, because
 * a wallet holding only USDC would otherwise be a wallet you cannot empty.
 */

export interface WithdrawRequest {
  /**
   * A Hedera account id (`0.0.x`) or an EVM address. Someone copying an address
   * out of their own wallet has no reason to know which one we wanted.
   */
  to: string
  /** Defaults to the settlement asset. `0.0.0` is HBAR. */
  asset?: string
  /** Omit to send the whole balance, which is what "take it out" usually means. */
  amountUnits?: string
  /**
   * Exchange deposit addresses are pooled accounts that work out whose deposit
   * it is from this, the same mechanic as an XRP tag. Sending to one without it
   * credits the money to nobody, so the field has to be offered.
   */
  memo?: string
}

export interface PreparedWithdrawal {
  intentId: string
  /** Sign every one. The server matches on the hash, not the order. */
  hashes: string[]
  to: string
  asset: string
  amountUnits: string
  memo: string | null
  /** Display only. What the amount comes to once decimals are applied. */
  amountDisplay: number
  assetDecimals: number
  expiresAt: string
}

export interface WithdrawalSent {
  status: 'sent'
  /** Look it up on the Mirror Node. This is the proof it left. */
  transactionId: string
  to: string
  asset: string
  amountUnits: string
}

export function prepareWithdraw(
  body: WithdrawRequest,
): Promise<PreparedWithdrawal> {
  return request<PreparedWithdrawal>('/api/me/withdraw/prepare', {
    method: 'POST',
    body,
  })
}

export function completeWithdraw(
  intentId: string,
  signatures: { hash: string; signature: string }[],
): Promise<WithdrawalSent> {
  return request<WithdrawalSent>('/api/me/withdraw/complete', {
    method: 'POST',
    body: { intentId, signatures },
  })
}

/**
 * Prepare, sign, submit.
 *
 * **Deliberately without the retry a purchase has.** A frozen transaction ages
 * out after about two minutes, and buying auto-retries on that because nothing
 * was charged. Here the expiry and a network refusal come back as the same
 * error shape on the same field, so the two cannot be told apart from the
 * outside, and one of them may have moved money. Retrying by hand is the only
 * safe answer, and the server's own message already says to start again.
 */
export async function withdraw(
  body: WithdrawRequest,
  signHashes: (
    hashes: string[],
  ) => Promise<{ hash: string; signature: string }[]>,
  onPrepared?: (prepared: PreparedWithdrawal) => void,
): Promise<WithdrawalSent> {
  const prepared = await prepareWithdraw(body)
  onPrepared?.(prepared)
  const signatures = await signHashes(prepared.hashes)
  return completeWithdraw(prepared.intentId, signatures)
}
