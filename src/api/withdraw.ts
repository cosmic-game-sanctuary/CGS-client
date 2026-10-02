import { request } from '@/lib/api'
import type { TransactionRequest } from '@/auth/useWalletSigner'

/**
 * Taking money out of the wallet Privy made for you.
 *
 * **Much smaller than it was.** On Hedera the server had to build, freeze and
 * submit the transfer so the *operator* could pay the network fee — a wallet
 * holding only USDC and no HBAR was otherwise a wallet you could not empty. On
 * Arc the fee is paid in USDC, the same asset being withdrawn, so a wallet with
 * money in it can always afford to move that money.
 *
 * So the server validates and hands back the transaction, the browser sends it
 * with the owner's own key, and the server confirms it from the chain. A little
 * is held back from "send everything" to cover the fee.
 *
 * A developer's *share of sales* is not withdrawn here at all: it accrues in
 * the game's SplitVault and they claim it from there.
 */

export interface WithdrawRequest {
  /** An EVM address. */
  to: string
  /** Omit to send everything the wallet can afford to send. */
  amountUnits?: string
}

export interface PreparedWithdrawal {
  intentId: string
  to: string
  asset: string
  amountUnits: string
  /** Display only. What the amount comes to once decimals are applied. */
  amountDisplay: number
  assetDecimals: number
  /** Held back so the transfer itself can be paid for. */
  reservedForGasUnits: string
  /** Send this from the owner's wallet. */
  transaction: TransactionRequest
  expiresAt: string
}

export interface WithdrawalSent {
  status: 'sent'
  /** Look it up on the explorer. This is the proof it left. */
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
  txHash: string,
): Promise<WithdrawalSent> {
  return request<WithdrawalSent>('/api/me/withdraw/complete', {
    method: 'POST',
    body: { intentId, txHash },
  })
}

/**
 * Prepare, send, confirm.
 *
 * **Deliberately without the retry a purchase has.** By the time `complete`
 * runs the money has already moved — the browser sent the transaction itself —
 * so a failure here is a failure to *record* a withdrawal that happened, never
 * a reason to send a second one. The transaction hash is the receipt either
 * way, and it is returned in the error path's own message.
 */
export async function withdraw(
  body: WithdrawRequest,
  sendTransaction: (request: TransactionRequest) => Promise<string>,
  onPrepared?: (prepared: PreparedWithdrawal) => void,
): Promise<WithdrawalSent> {
  const prepared = await prepareWithdraw(body)
  onPrepared?.(prepared)
  const txHash = await sendTransaction(prepared.transaction)
  return completeWithdraw(prepared.intentId, txHash)
}
